import { createCopyMoveTask, getTask } from '@/lib/api-client'
import {
	getPaneCurrentPath,
	refreshPaneById,
	type PaneId,
} from '@/store/file-store'
import type { TaskOperation, TaskStatus } from '@/types'

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

function formatPathForToast(path: string): string {
	return path ? `/${path}` : '/'
}

export function getTargetPaneId(sourcePaneId: PaneId): PaneId {
	return sourcePaneId === 'left' ? 'right' : 'left'
}

export function getDirectChildName(
	basePath: string,
	entryPath: string,
): string | null {
	if (basePath === '') {
		if (!entryPath || entryPath.includes('/')) return null
		return entryPath
	}

	const prefix = `${basePath}/`
	if (!entryPath.startsWith(prefix)) return null

	const relativePath = entryPath.slice(prefix.length)
	if (!relativePath || relativePath.includes('/')) return null

	return relativePath
}

interface ResolveTransferNamesOptions {
	sourcePath: string
	candidatePaths: Iterable<string>
	currentEntryPathSet: Set<string>
}

export interface ResolveTransferNamesResult {
	names: string[]
	skippedOutsideCurrentDir: number
	skippedMissingInCurrentDir: number
}

export function resolveTransferNames({
	sourcePath,
	candidatePaths,
	currentEntryPathSet,
}: ResolveTransferNamesOptions): ResolveTransferNamesResult {
	const selectedNameSet = new Set<string>()
	let skippedOutsideCurrentDir = 0
	let skippedMissingInCurrentDir = 0

	for (const selectedPath of candidatePaths) {
		if (!currentEntryPathSet.has(selectedPath)) {
			skippedMissingInCurrentDir += 1
			continue
		}

		const directChildName = getDirectChildName(sourcePath, selectedPath)
		if (!directChildName) {
			skippedOutsideCurrentDir += 1
			continue
		}

		selectedNameSet.add(directChildName)
	}

	return {
		names: Array.from(selectedNameSet),
		skippedOutsideCurrentDir,
		skippedMissingInCurrentDir,
	}
}

type ShowToast = (message: string, variant?: 'success' | 'error') => void

interface RunCopyMoveTaskOptions {
	operation: TaskOperation
	sourcePath: string
	sourcePaneId: PaneId
	names: string[]
	showToast: ShowToast
}

export async function runCopyMoveTask({
	operation,
	sourcePath,
	sourcePaneId,
	names,
	showToast,
}: RunCopyMoveTaskOptions): Promise<void> {
	if (names.length === 0) {
		showToast('No files selected', 'error')
		return
	}

	const targetPaneId = getTargetPaneId(sourcePaneId)
	const targetPath = getPaneCurrentPath(targetPaneId)

	if (sourcePath === targetPath) {
		showToast('Source and target directories cannot be the same', 'error')
		return
	}

	try {
		const { taskId } = await createCopyMoveTask(
			operation,
			sourcePath,
			targetPath,
			names,
		)

		showToast(
			`${operation === 'copy' ? 'Copy' : 'Move'} task started (${names.length} items)`,
		)

		let status: TaskStatus = 'queued'
		let errorMessage = ''

		while (status === 'queued' || status === 'running') {
			const { task } = await getTask(taskId)
			status = task.status
			errorMessage = task.error || ''
			if (status === 'queued' || status === 'running') {
				await sleep(1000)
			}
		}

		await Promise.all([
			refreshPaneById(sourcePaneId),
			refreshPaneById(targetPaneId),
		])

		if (status === 'completed') {
			showToast(
				`${operation === 'copy' ? 'Copied' : 'Moved'} ${names.length} items to ${formatPathForToast(targetPath)}`,
			)
			return
		}

		if (status === 'cancelled') {
			showToast('Task cancelled', 'error')
			return
		}

		if (status === 'interrupted') {
			showToast('Task interrupted by server restart', 'error')
			return
		}

		showToast(errorMessage || 'Task failed', 'error')
	} catch (err) {
		showToast((err as Error).message, 'error')
	}
}
