import { useRef, useState, type DragEvent } from 'react'
import { Toolbar } from '@/components/Toolbar/Toolbar'
import { FileList } from '@/components/FileList/FileList'
import {
	ExplorerPaneProvider,
	getPaneCurrentPath,
	refreshPaneById,
	useFileStore,
	type PaneId,
} from '@/store/file-store'
import {
	checkUploadConflicts,
	isUploadConflictError,
	listFiles,
	uploadFileItems,
	type UploadFileItem,
	type UploadConflictStrategy,
} from '@/lib/api-client'
import { useToast } from '@/components/Toast/useToast'
import {
	PANE_TRANSFER_DRAG_MIME,
	readPaneTransferDragPayload,
	runCopyMoveTask,
} from '@/lib/copy-move-task'
import { TransferConflictDialog } from '@/components/Dialogs/TransferConflictDialog'
import { UploadConflictDialog } from '@/components/Dialogs/UploadConflictDialog'
import type { TaskOperation } from '@/types'

function hasFileDrag(event: DragEvent<HTMLDivElement>): boolean {
	return Array.from(event.dataTransfer.types).includes('Files')
}

function hasPaneTransferDrag(event: DragEvent<HTMLDivElement>): boolean {
	return Array.from(event.dataTransfer.types).includes(PANE_TRANSFER_DRAG_MIME)
}

type DropIntent = 'upload' | 'transfer-copy' | 'transfer-move'

function resolveDropIntent(event: DragEvent<HTMLDivElement>): DropIntent | null {
	if (hasPaneTransferDrag(event)) {
		return event.altKey ? 'transfer-copy' : 'transfer-move'
	}

	if (hasFileDrag(event)) {
		return 'upload'
	}

	return null
}

function resolveTransferOperation(intent: DropIntent): TaskOperation {
	return intent === 'transfer-copy' ? 'copy' : 'move'
}

function getDropIndicatorLabel(intent: DropIntent | null): string {
	if (intent === 'transfer-copy') {
		return 'Drop to copy to this pane'
	}
	if (intent === 'transfer-move') {
		return 'Drop to move to this pane'
	}
	return 'Drop files or folders to upload'
}

function formatPath(path: string): string {
	return path ? `/${path}` : '/'
}

function normalizeNameForConflict(name: string, caseInsensitive: boolean): string {
	return caseInsensitive ? name.toLowerCase() : name
}

function normalizeRelativePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/')
}

function joinRelativePath(basePath: string, segment: string): string {
	return basePath ? `${basePath}/${segment}` : segment
}

function getRelativePathForFile(file: File, parentPath: string): string {
	const relativePath = normalizeRelativePath(file.webkitRelativePath)
	if (relativePath) {
		return relativePath
	}

	return normalizeRelativePath(joinRelativePath(parentPath, file.name))
}

function readFileFromEntry(entry: FileSystemFileEntry): Promise<File> {
	return new Promise((resolve, reject) => {
		entry.file(resolve, reject)
	})
}

function readEntryBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
	return new Promise((resolve, reject) => {
		reader.readEntries(resolve, reject)
	})
}

async function readAllEntries(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
	const reader = entry.createReader()
	const entries: FileSystemEntry[] = []

	while (true) {
		const batch = await readEntryBatch(reader)
		if (batch.length === 0) break
		entries.push(...batch)
	}

	return entries
}

async function collectUploadItemsFromEntry(
	entry: FileSystemEntry,
	parentPath = '',
): Promise<UploadFileItem[]> {
	if (entry.isFile) {
		const file = await readFileFromEntry(entry as FileSystemFileEntry)
		return [
			{
				file,
				relativePath: getRelativePathForFile(file, parentPath),
			},
		]
	}

	if (!entry.isDirectory) {
		return []
	}

	const directoryEntry = entry as FileSystemDirectoryEntry
	const nextParentPath = joinRelativePath(parentPath, entry.name)
	const childEntries = await readAllEntries(directoryEntry)
	const childUploadItems = await Promise.all(
		childEntries.map((childEntry) =>
			collectUploadItemsFromEntry(childEntry, nextParentPath),
		),
	)

	return childUploadItems.flat()
}

async function collectDroppedUploadItems(
	event: DragEvent<HTMLDivElement>,
): Promise<UploadFileItem[]> {
	const itemsWithEntry = Array.from(event.dataTransfer.items)
		.map(
			(item) =>
				(
					item as DataTransferItem & {
						webkitGetAsEntry?: () => FileSystemEntry | null
					}
				).webkitGetAsEntry?.() ?? null,
		)
		.filter((entry): entry is FileSystemEntry => entry !== null)

	if (itemsWithEntry.length > 0) {
		const nestedItems = await Promise.all(
			itemsWithEntry.map((entry) => collectUploadItemsFromEntry(entry)),
		)
		return nestedItems.flat()
	}

	return Array.from(event.dataTransfer.files).map((file) => ({
		file,
		relativePath: normalizeRelativePath(file.name),
	}))
}

interface ExplorerPaneProps {
	paneId: PaneId
}

interface PendingTransferConflict {
	operation: TaskOperation
	sourcePaneId: PaneId
	sourcePath: string
	targetPath: string
	names: string[]
	conflictingNames: string[]
}

interface PendingUploadConflict {
	uploadPath: string
	uploadItems: UploadFileItem[]
	conflictingNames: string[]
}

export function ExplorerPane({ paneId }: ExplorerPaneProps) {
	const activePaneId = useFileStore((s) => s.activePaneId)
	const setActivePane = useFileStore((s) => s.setActivePane)
	const showToast = useToast((s) => s.showToast)
	const isActive = activePaneId === paneId
	const [dropIntent, setDropIntent] = useState<DropIntent | null>(null)
	const [transferBusy, setTransferBusy] = useState(false)
	const [uploadBusy, setUploadBusy] = useState(false)
	const [pendingTransferConflict, setPendingTransferConflict] =
		useState<PendingTransferConflict | null>(null)
	const [pendingUploadConflict, setPendingUploadConflict] =
		useState<PendingUploadConflict | null>(null)
	const dragDepthRef = useRef(0)
	const isDragOver = dropIntent !== null

	const executeUpload = async ({
		uploadPath,
		uploadItems,
		strategy,
	}: {
		uploadPath: string
		uploadItems: UploadFileItem[]
		strategy: UploadConflictStrategy
	}) => {
		const { files: uploadedFiles } = await uploadFileItems(uploadPath, uploadItems, {
			onConflict: strategy,
		})
		await refreshPaneById(paneId)
		showToast(
			`Uploaded ${uploadedFiles.length} file${uploadedFiles.length === 1 ? '' : 's'} to ${formatPath(uploadPath)}`,
		)
	}

	const executePaneTransfer = async ({
		names,
		overwriteNames,
		sourcePath,
		sourcePaneId,
		targetPath,
		operation,
	}: {
		names: string[]
		overwriteNames: string[]
		sourcePath: string
		sourcePaneId: PaneId
		targetPath: string
		operation: TaskOperation
	}) => {
		if (names.length === 0) {
			showToast('All selected items already exist in target directory', 'error')
			return
		}

		await runCopyMoveTask({
			operation,
			sourcePath,
			sourcePaneId,
			targetPath,
			names,
			overwriteNames,
			showToast,
		})
	}

	const handleResolveConflict = async (strategy: 'overwrite' | 'skip') => {
		if (!pendingTransferConflict || transferBusy) return

		setTransferBusy(true)
		try {
			const conflictingNameSet = new Set(
				pendingTransferConflict.conflictingNames,
			)
			const names =
				strategy === 'skip'
					? pendingTransferConflict.names.filter(
							(name) => !conflictingNameSet.has(name),
						)
					: pendingTransferConflict.names
			const overwriteNames =
				strategy === 'overwrite' ? pendingTransferConflict.conflictingNames : []

			await executePaneTransfer({
				names,
				overwriteNames,
				sourcePath: pendingTransferConflict.sourcePath,
				sourcePaneId: pendingTransferConflict.sourcePaneId,
				targetPath: pendingTransferConflict.targetPath,
				operation: pendingTransferConflict.operation,
			})
			setPendingTransferConflict(null)
		} catch (err) {
			showToast((err as Error).message, 'error')
		} finally {
			setTransferBusy(false)
		}
	}

	const handleTransferConflictOpenChange = (open: boolean) => {
		if (open || transferBusy) return
		setPendingTransferConflict(null)
	}

	const handleUploadConflictOpenChange = (open: boolean) => {
		if (open || uploadBusy) return
		setPendingUploadConflict(null)
	}

	const handleResolveUploadConflict = async (strategy: UploadConflictStrategy) => {
		if (!pendingUploadConflict || uploadBusy) return

		setUploadBusy(true)
		try {
			await executeUpload({
				uploadPath: pendingUploadConflict.uploadPath,
				uploadItems: pendingUploadConflict.uploadItems,
				strategy,
			})
			setPendingUploadConflict(null)
		} catch (err) {
			showToast((err as Error).message, 'error')
		} finally {
			setUploadBusy(false)
		}
	}

	const handleActivate = () => {
		if (!isActive) {
			setActivePane(paneId)
		}
	}

	const handleFocusCapture = () => {
		if (!isActive) {
			setActivePane(paneId)
		}
	}

	const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
		const nextDropIntent = resolveDropIntent(event)
		if (!nextDropIntent) return

		event.preventDefault()
		event.stopPropagation()
		dragDepthRef.current += 1
		setDropIntent(nextDropIntent)
		if (!isActive) {
			setActivePane(paneId)
		}
	}

	const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
		const nextDropIntent = resolveDropIntent(event)
		if (!nextDropIntent) return

		event.preventDefault()
		event.stopPropagation()
		event.dataTransfer.dropEffect =
			nextDropIntent === 'transfer-move' ? 'move' : 'copy'
		if (dropIntent !== nextDropIntent) {
			setDropIntent(nextDropIntent)
		}
		if (!isActive) {
			setActivePane(paneId)
		}
	}

	const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
		if (!resolveDropIntent(event)) return

		event.preventDefault()
		event.stopPropagation()
		dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
		if (dragDepthRef.current === 0) {
			setDropIntent(null)
		}
	}

	const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
		const nextDropIntent = resolveDropIntent(event)
		if (!nextDropIntent) return

		event.preventDefault()
		event.stopPropagation()
		dragDepthRef.current = 0
		setDropIntent(null)
		setActivePane(paneId)

		if (nextDropIntent === 'upload') {
			if (uploadBusy) {
				showToast('Another upload is in progress', 'error')
				return
			}

			const uploadPath = getPaneCurrentPath(paneId)
			let uploadItems: UploadFileItem[] = []

			setUploadBusy(true)
			try {
				uploadItems = await collectDroppedUploadItems(event)
				if (uploadItems.length === 0) {
					showToast('No files found to upload', 'error')
					return
				}

				const { conflicts } = await checkUploadConflicts(
					uploadPath,
					uploadItems.map((item) => item.relativePath || item.file.name),
				)
				if (conflicts.length > 0) {
					setPendingUploadConflict({
						uploadPath,
						uploadItems,
						conflictingNames: conflicts,
					})
					return
				}

				await executeUpload({
					uploadPath,
					uploadItems,
					strategy: 'cancel',
				})
			} catch (err) {
				if (
					isUploadConflictError(err) &&
					err.conflicts.length > 0 &&
					uploadItems.length > 0
				) {
					setPendingUploadConflict({
						uploadPath,
						uploadItems,
						conflictingNames: err.conflicts,
					})
					return
				}

				showToast((err as Error).message, 'error')
			} finally {
				setUploadBusy(false)
			}

			return
		}

		if (transferBusy) {
			showToast('Another transfer is in progress', 'error')
			return
		}

		const payload = readPaneTransferDragPayload(event.dataTransfer)
		if (!payload) {
			showToast('Unable to read dragged items', 'error')
			return
		}

		const names = Array.from(new Set(payload.names))
		if (names.length === 0) {
			showToast('No files selected', 'error')
			return
		}

		const targetPath = getPaneCurrentPath(paneId)
		const operation = resolveTransferOperation(nextDropIntent)

		if (payload.sourcePath === targetPath) {
			showToast('Source and target directories cannot be the same', 'error')
			return
		}

		setTransferBusy(true)
		try {
			const {
				files: targetEntries,
				caseSensitiveNames,
			} = await listFiles(targetPath)
			const caseInsensitiveConflict = caseSensitiveNames === false
			const targetNameSet = new Set(
				targetEntries.map((entry) =>
					normalizeNameForConflict(entry.name, caseInsensitiveConflict),
				),
			)
			const conflictingNames = names.filter((name) =>
				targetNameSet.has(
					normalizeNameForConflict(name, caseInsensitiveConflict),
				),
			)

			if (conflictingNames.length > 0) {
				setPendingTransferConflict({
					operation,
					sourcePaneId: payload.sourcePaneId,
					sourcePath: payload.sourcePath,
					targetPath,
					names,
					conflictingNames,
				})
				return
			}

			await executePaneTransfer({
				names,
				overwriteNames: [],
				sourcePath: payload.sourcePath,
				sourcePaneId: payload.sourcePaneId,
				targetPath,
				operation,
			})
		} catch (err) {
			showToast((err as Error).message, 'error')
		} finally {
			setTransferBusy(false)
		}
	}

	return (
		<div
			className={`explorer-pane ${isActive ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
			onMouseDown={handleActivate}
			onFocusCapture={handleFocusCapture}
			onDragEnter={handleDragEnter}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<ExplorerPaneProvider paneId={paneId}>
				<Toolbar />
				<FileList />
			</ExplorerPaneProvider>
			{isDragOver ? (
				<div className="explorer-pane-drop-indicator">
					{getDropIndicatorLabel(dropIntent)}
				</div>
			) : null}
			<TransferConflictDialog
				open={pendingTransferConflict !== null}
				busy={transferBusy}
				operation={pendingTransferConflict?.operation ?? 'move'}
				targetPath={pendingTransferConflict?.targetPath ?? ''}
				conflictingNames={pendingTransferConflict?.conflictingNames ?? []}
				onOpenChange={handleTransferConflictOpenChange}
				onConfirmOverwrite={() => void handleResolveConflict('overwrite')}
				onConfirmSkip={() => void handleResolveConflict('skip')}
			/>
			<UploadConflictDialog
				open={pendingUploadConflict !== null}
				busy={uploadBusy}
				targetPath={pendingUploadConflict?.uploadPath ?? ''}
				conflictingNames={pendingUploadConflict?.conflictingNames ?? []}
				onOpenChange={handleUploadConflictOpenChange}
				onConfirmAutoRename={() => void handleResolveUploadConflict('auto-rename')}
				onConfirmOverwrite={() => void handleResolveUploadConflict('overwrite')}
			/>
		</div>
	)
}
