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
import { uploadFileItems, type UploadFileItem } from '@/lib/api-client'
import { useToast } from '@/components/Toast/useToast'

function hasFileDrag(event: DragEvent<HTMLDivElement>): boolean {
	return Array.from(event.dataTransfer.types).includes('Files')
}

function formatPath(path: string): string {
	return path ? `/${path}` : '/'
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

export function ExplorerPane({ paneId }: ExplorerPaneProps) {
	const activePaneId = useFileStore((s) => s.activePaneId)
	const setActivePane = useFileStore((s) => s.setActivePane)
	const showToast = useToast((s) => s.showToast)
	const isActive = activePaneId === paneId
	const [isDragOver, setIsDragOver] = useState(false)
	const dragDepthRef = useRef(0)

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
		if (!hasFileDrag(event)) return

		event.preventDefault()
		event.stopPropagation()
		dragDepthRef.current += 1
		setIsDragOver(true)
		if (!isActive) {
			setActivePane(paneId)
		}
	}

	const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
		if (!hasFileDrag(event)) return

		event.preventDefault()
		event.stopPropagation()
		event.dataTransfer.dropEffect = 'copy'
		if (!isDragOver) {
			setIsDragOver(true)
		}
		if (!isActive) {
			setActivePane(paneId)
		}
	}

	const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
		if (!hasFileDrag(event)) return

		event.preventDefault()
		event.stopPropagation()
		dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
		if (dragDepthRef.current === 0) {
			setIsDragOver(false)
		}
	}

	const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
		if (!hasFileDrag(event)) return

		event.preventDefault()
		event.stopPropagation()
		dragDepthRef.current = 0
		setIsDragOver(false)
		setActivePane(paneId)

		const uploadItems = await collectDroppedUploadItems(event)
		if (uploadItems.length === 0) {
			showToast('No files found to upload', 'error')
			return
		}

		const uploadPath = getPaneCurrentPath(paneId)
		try {
			await uploadFileItems(uploadPath, uploadItems)
			await refreshPaneById(paneId)
			showToast(
				`Uploaded ${uploadItems.length} file${uploadItems.length === 1 ? '' : 's'} to ${formatPath(uploadPath)}`,
			)
		} catch (err) {
			showToast((err as Error).message, 'error')
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
				<div className="explorer-pane-drop-indicator">Drop files or folders to upload</div>
			) : null}
		</div>
	)
}
