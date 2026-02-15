import { Toolbar } from '@/components/Toolbar/Toolbar'
import { FileList } from '@/components/FileList/FileList'
import {
	ExplorerPaneProvider,
	useFileStore,
	type PaneId,
} from '@/store/file-store'

interface ExplorerPaneProps {
	paneId: PaneId
}

export function ExplorerPane({ paneId }: ExplorerPaneProps) {
	const activePaneId = useFileStore((s) => s.activePaneId)
	const setActivePane = useFileStore((s) => s.setActivePane)
	const isActive = activePaneId === paneId

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

	return (
		<div
			className={`explorer-pane ${isActive ? 'active' : ''}`}
			onMouseDown={handleActivate}
			onFocusCapture={handleFocusCapture}
		>
			<ExplorerPaneProvider paneId={paneId}>
				<Toolbar />
				<FileList />
			</ExplorerPaneProvider>
		</div>
	)
}
