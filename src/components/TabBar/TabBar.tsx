import { Plus, X } from "lucide-react";
import { useFileStore } from "@/store/file-store";

function getTabLabel(path: string): string {
	if (!path) return "My Files";
	const segments = path.split("/").filter(Boolean);
	return segments[segments.length - 1] || "My Files";
}

export function TabBar() {
	const tabs = useFileStore((s) => s.tabs);
	const activeTabId = useFileStore((s) => s.activeTabId);
	const addTab = useFileStore((s) => s.addTab);
	const closeTab = useFileStore((s) => s.closeTab);
	const switchTab = useFileStore((s) => s.switchTab);

	const handleCloseTab = (e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		closeTab(id);
	};

	const handleMiddleClick = (e: React.MouseEvent, id: string) => {
		if (e.button === 1) {
			e.preventDefault();
			closeTab(id);
		}
	};

	return (
		<div className="tab-bar">
			<button className="tab-add-btn" onClick={() => addTab()} title="New Tab">
				<Plus size={16} />
			</button>
			<div className="tab-list">
				{tabs.map((tab) => (
					<div
						key={tab.id}
						className={`tab-item ${tab.id === activeTabId ? "active" : ""}`}
						onClick={() => switchTab(tab.id)}
						onMouseDown={(e) => handleMiddleClick(e, tab.id)}
					>
						<span className="tab-label">{getTabLabel(tab.path)}</span>
						{tabs.length > 1 && (
							<button
								className="tab-close-btn"
								onClick={(e) => handleCloseTab(e, tab.id)}
								title="Close Tab"
							>
								<X size={14} />
							</button>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
