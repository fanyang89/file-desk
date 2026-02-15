import { Sidebar } from '@/components/Sidebar/Sidebar'
import { PreviewDialog } from '@/components/Preview/PreviewDialog'
import { ExplorerPane } from '@/components/Layout/ExplorerPane'

export function Layout() {
	return (
		<div className="layout">
			<Sidebar />
			<div className="layout-main">
				<div className="explorer-split">
					<ExplorerPane paneId="left" />
					<ExplorerPane paneId="right" />
				</div>
			</div>
			<PreviewDialog />
		</div>
	)
}
