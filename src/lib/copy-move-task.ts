import { createCopyMoveTask, getTask } from '@/lib/api-client'
import {
	getPaneCurrentPath,
	refreshPaneById,
	type PaneId,
} from '@/store/file-store'
import type { TaskOperation, TaskStatus } from '@/types'

export const PANE_TRANSFER_DRAG_MIME = 'application/x-file-desk-pane-transfer'

const paneTransferDragToken =
	typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
		? crypto.randomUUID()
		: `pane-transfer-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`

interface PaneTransferDragWirePayload {
	sourcePaneId: PaneId
	sourcePath: string
	names: string[]
	dragToken: string
}

export interface PaneTransferDragPayload {
	sourcePaneId: PaneId
	sourcePath: string
	names: string[]
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

function formatPathForToast(path: string): string {
	return path ? `/${path}` : '/'
}

function uniqueValidNames(names: Iterable<string>): string[] {
	const nameSet = new Set<string>()
	for (const name of names) {
		if (!name || name.includes('/') || name.includes('\\')) continue
		nameSet.add(name)
	}
	return Array.from(nameSet)
}

export function writePaneTransferDragPayload(
	dataTransfer: DataTransfer,
	payload: PaneTransferDragPayload,
): void {
	const names = uniqueValidNames(payload.names)
	if (names.length === 0) {
		return
	}

	const normalizedPayload: PaneTransferDragPayload = {
		sourcePaneId: payload.sourcePaneId,
		sourcePath: payload.sourcePath,
		names,
	}
	const wirePayload: PaneTransferDragWirePayload = {
		...normalizedPayload,
		dragToken: paneTransferDragToken,
	}

	dataTransfer.setData(PANE_TRANSFER_DRAG_MIME, JSON.stringify(wirePayload))
	dataTransfer.setData('text/plain', names.join('\n'))
}

export function readPaneTransferDragPayload(
	dataTransfer: DataTransfer,
): PaneTransferDragPayload | null {
	const rawValue = dataTransfer.getData(PANE_TRANSFER_DRAG_MIME)
	if (!rawValue) return null

	try {
		const parsed = JSON.parse(rawValue) as Partial<PaneTransferDragWirePayload>
		if (parsed.sourcePaneId !== 'left' && parsed.sourcePaneId !== 'right') {
			return null
		}
		if (typeof parsed.sourcePath !== 'string' || !Array.isArray(parsed.names)) {
			return null
		}
		if (typeof parsed.dragToken !== 'string') {
			return null
		}
		if (parsed.dragToken !== paneTransferDragToken) {
			return null
		}

		const names = uniqueValidNames(parsed.names)
		if (names.length === 0) return null

		return {
			sourcePaneId: parsed.sourcePaneId,
			sourcePath: parsed.sourcePath,
			names,
		}
	} catch {
		return null
	}
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
	targetPaneId?: PaneId
	targetPath?: string
	names: string[]
	overwriteNames?: string[]
	showToast: ShowToast
}

export async function runCopyMoveTask({
	operation,
	sourcePath,
	sourcePaneId,
	targetPaneId,
	targetPath,
	names,
	overwriteNames,
	showToast,
}: RunCopyMoveTaskOptions): Promise<void> {
	if (names.length === 0) {
		showToast('No files selected', 'error')
		return
	}

	const resolvedTargetPaneId = targetPaneId ?? getTargetPaneId(sourcePaneId)
	const resolvedTargetPath =
		targetPath ?? getPaneCurrentPath(resolvedTargetPaneId)

	if (sourcePath === resolvedTargetPath) {
		showToast('Source and target directories cannot be the same', 'error')
		return
	}

	try {
		const { taskId } = await createCopyMoveTask(
			operation,
			sourcePath,
			resolvedTargetPath,
			names,
			{ overwriteNames },
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
			refreshPaneById(resolvedTargetPaneId),
		])

		if (status === 'completed') {
			showToast(
				`${operation === 'copy' ? 'Copied' : 'Moved'} ${names.length} items to ${formatPathForToast(resolvedTargetPath)}`,
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
