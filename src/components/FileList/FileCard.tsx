import type { FileEntry } from "@/types";
import {
	selectCurrentPath,
	useExplorerPaneId,
	useFileStore,
} from "@/store/file-store";
import { FileIcon } from "./FileIcon";
import { FileContextMenu } from "@/components/ContextMenu/FileContextMenu";
import {
	resolveTransferNames,
	writePaneTransferDragPayload,
} from "@/lib/copy-move-task";

interface FileCardProps {
	entry: FileEntry;
}

export function FileCard({ entry }: FileCardProps) {
	const { navigate, selectedPaths, toggleSelection, setSelectedPaths, openPreview } =
		useFileStore();
	const entries = useFileStore((s) => s.entries);
	const currentPath = useFileStore(selectCurrentPath);
	const activePaneId = useFileStore((s) => s.activePaneId);
	const paneId = useExplorerPaneId();
	const isSelected = selectedPaths.has(entry.path);

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		toggleSelection(entry.path, e.metaKey || e.ctrlKey);
	};

	const handleDoubleClick = () => {
		if (entry.isDirectory) {
			navigate(entry.path);
		} else {
			openPreview(entry);
		}
	};

	const handleContextMenu = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (selectedPaths.has(entry.path)) {
			return;
		}

		setSelectedPaths(new Set([entry.path]));
	};

	const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
		const transferCandidatePaths = selectedPaths.has(entry.path)
			? selectedPaths
			: new Set([entry.path]);
		const currentEntryPathSet = new Set(entries.map((item) => item.path));
		const { names } = resolveTransferNames({
			sourcePath: currentPath,
			candidatePaths: transferCandidatePaths,
			currentEntryPathSet,
		});

		if (names.length === 0) {
			e.preventDefault();
			return;
		}

		e.dataTransfer.effectAllowed = "copyMove";
		writePaneTransferDragPayload(e.dataTransfer, {
			sourcePaneId: paneId ?? activePaneId,
			sourcePath: currentPath,
			names,
		});
	};

	return (
		<FileContextMenu entry={entry}>
			<div
				className={`file-card ${isSelected ? "selected" : ""}`}
				draggable
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				onDoubleClick={handleDoubleClick}
				onDragStart={handleDragStart}
			>
				<div className="file-card-icon">
					<FileIcon
						extension={entry.extension}
						isDirectory={entry.isDirectory}
						size={40}
					/>
				</div>
				<div className="file-card-name" title={entry.name}>
					{entry.name}
				</div>
			</div>
		</FileContextMenu>
	);
}
