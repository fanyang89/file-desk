import { HardDrive } from "lucide-react";
import { useFileStore, selectCurrentPath } from "@/store/file-store";

export function Sidebar() {
	const navigate = useFileStore((s) => s.navigate);
	const currentPath = useFileStore(selectCurrentPath);

	return (
		<aside className="sidebar">
			<div className="sidebar-header">
				<HardDrive size={24} />
				<span className="sidebar-title">File Desk</span>
			</div>
			<nav className="sidebar-nav">
				<button
					className={`sidebar-item ${currentPath === "" ? "active" : ""}`}
					onClick={() => navigate("")}
				>
					<HardDrive size={18} />
					<span>My Files</span>
				</button>
			</nav>
		</aside>
	);
}
