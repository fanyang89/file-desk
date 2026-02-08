import { Sidebar } from "@/components/Sidebar/Sidebar";
import { Toolbar } from "@/components/Toolbar/Toolbar";
import { TabBar } from "@/components/TabBar/TabBar";
import { FileList } from "@/components/FileList/FileList";
import { PreviewDialog } from "@/components/Preview/PreviewDialog";

export function Layout() {
	return (
		<div className="layout">
			<Sidebar />
			<div className="layout-main">
				<Toolbar />
				<TabBar />
				<FileList />
			</div>
			<PreviewDialog />
		</div>
	);
}
