import { useEffect } from 'react'
import { Loader2, FolderOpen } from 'lucide-react'
import {
	useFileStore,
	selectEntries,
	selectLoading,
	selectError,
	selectCurrentPath,
	useExplorerPaneId,
} from '@/store/file-store'
import { ListView } from './ListView'
import { GridView } from './GridView'
import { PhotoView } from './PhotoView'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

export function FileList() {
	const entries = useFileStore(selectEntries)
	const loading = useFileStore(selectLoading)
	const error = useFileStore(selectError)
	const currentPath = useFileStore(selectCurrentPath)
	const viewMode = useFileStore((s) => s.viewMode)
	const navigate = useFileStore((s) => s.navigate)
	const clearSelection = useFileStore((s) => s.clearSelection)
	const activePaneId = useFileStore((s) => s.activePaneId)
	const paneId = useExplorerPaneId()
	const isActivePane = paneId ? paneId === activePaneId : true

	useKeyboardShortcuts(isActivePane)

	useEffect(() => {
		void navigate('')
	}, [navigate])

	const handleBackgroundClick = () => {
		clearSelection()
	}

	if (loading) {
		return (
			<div className="file-list-empty" onClick={handleBackgroundClick}>
				<Loader2 size={32} className="spinner" />
				<p>Loading...</p>
			</div>
		)
	}

	if (error) {
		return (
			<div className="file-list-empty" onClick={handleBackgroundClick}>
				<p className="error-text">Error: {error}</p>
			</div>
		)
	}

	if (viewMode !== "photo" && entries.length === 0) {
		return (
			<div className="file-list-empty" onClick={handleBackgroundClick}>
				<FolderOpen size={48} strokeWidth={1} />
				<p>This folder is empty</p>
			</div>
		)
	}

	return (
		<div className="file-list" onClick={handleBackgroundClick}>
			{viewMode === "list" ? (
				<ListView entries={entries} />
			) : viewMode === "grid" ? (
				<GridView entries={entries} />
			) : (
				<PhotoView path={currentPath} />
			)}
		</div>
	)
}
