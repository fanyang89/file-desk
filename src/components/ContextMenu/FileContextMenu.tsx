import { useMemo, useState } from "react";
import { ContextMenu } from "radix-ui";
import { Theme } from "@radix-ui/themes";
import {
	Copy,
	Download,
	Pencil,
	Trash2,
	FolderOpen,
	Eye,
	Scissors,
} from "lucide-react";
import type { FileEntry } from "@/types";
import {
	useExplorerPaneId,
	useFileStore,
	selectCurrentPath,
} from "@/store/file-store";
import { getDownloadUrl } from "@/lib/api-client";
import { RenameDialog } from "@/components/Dialogs/RenameDialog";
import { DeleteConfirmDialog } from "@/components/Dialogs/DeleteConfirmDialog";
import { useToast } from "@/components/Toast/useToast";
import {
	runCopyMoveTask,
	resolveTransferNames,
} from "@/lib/copy-move-task";

interface FileContextMenuProps {
	entry: FileEntry;
	children: React.ReactNode;
}

export function FileContextMenu({ entry, children }: FileContextMenuProps) {
	const { navigate, openPreview } = useFileStore();
	const currentPath = useFileStore(selectCurrentPath);
	const selectedPaths = useFileStore((s) => s.selectedPaths);
	const entries = useFileStore((s) => s.entries);
	const activePaneId = useFileStore((s) => s.activePaneId);
	const loading = useFileStore((s) => s.loading);
	const paneId = useExplorerPaneId();
	const { showToast } = useToast();
	const [renameOpen, setRenameOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [transferBusy, setTransferBusy] = useState(false);
	const [renameTargetPath, setRenameTargetPath] = useState<string | null>(null);
	const [deleteTargetPath, setDeleteTargetPath] = useState<string | null>(null);

	const currentEntryPathSet = useMemo(
		() => new Set(entries.map((item) => item.path)),
		[entries],
	);

	const transferCandidatePaths = useMemo(() => {
		if (selectedPaths.has(entry.path)) {
			return selectedPaths;
		}
		return new Set([entry.path]);
	}, [entry.path, selectedPaths]);

	const transferSelection = useMemo(
		() =>
			resolveTransferNames({
				sourcePath: currentPath,
				candidatePaths: transferCandidatePaths,
				currentEntryPathSet,
			}),
		[currentEntryPathSet, currentPath, transferCandidatePaths],
	);

	const canTransfer = !loading && !transferBusy && transferSelection.names.length > 0;

	const handleDownload = () => {
		const url = getDownloadUrl(entry.path);
		const a = document.createElement("a");
		a.href = url;
		a.download = entry.name;
		a.click();
	};

	const handleRenameOpen = () => {
		setRenameTargetPath(currentPath);
		setRenameOpen(true);
	};

	const handleDeleteOpen = () => {
		setDeleteTargetPath(currentPath);
		setDeleteOpen(true);
	};

	const handleTransfer = async (operation: "copy" | "move") => {
		if (transferBusy) return;

		const { names, skippedOutsideCurrentDir, skippedMissingInCurrentDir } =
			transferSelection;

		if (names.length === 0) {
			if (skippedMissingInCurrentDir > 0) {
				showToast("Selected items are no longer in the current folder", "error");
				return;
			}
			if (skippedOutsideCurrentDir > 0) {
				showToast("Copy/Move only supports items in current folder", "error");
				return;
			}
			showToast("No files selected", "error");
			return;
		}

		if (skippedOutsideCurrentDir > 0) {
			showToast(`Ignoring ${skippedOutsideCurrentDir} items outside current folder`);
		}
		if (skippedMissingInCurrentDir > 0) {
			showToast(
				`Ignoring ${skippedMissingInCurrentDir} items missing from current folder`,
			);
		}

		const sourcePaneId = paneId ?? activePaneId;

		setTransferBusy(true);
		try {
			await runCopyMoveTask({
				operation,
				sourcePath: currentPath,
				sourcePaneId,
				names,
				showToast,
			});
		} finally {
			setTransferBusy(false);
		}
	};

	const handleRenameOpenChange = (open: boolean) => {
		setRenameOpen(open);
		if (!open) {
			setRenameTargetPath(null);
		}
	};

	const handleDeleteOpenChange = (open: boolean) => {
		setDeleteOpen(open);
		if (!open) {
			setDeleteTargetPath(null);
		}
	};

	return (
		<>
			<ContextMenu.Root>
				<ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
				<ContextMenu.Portal>
					<Theme
						appearance="light"
						accentColor="indigo"
						grayColor="slate"
						panelBackground="solid"
						radius="large"
						scaling="100%"
					>
						<ContextMenu.Content className="context-menu-content">
							{entry.isDirectory && (
								<ContextMenu.Item
									className="context-menu-item"
									onSelect={() => navigate(entry.path)}
								>
									<FolderOpen size={14} />
									<span>Open</span>
								</ContextMenu.Item>
							)}
							{!entry.isDirectory && (
								<>
									<ContextMenu.Item
										className="context-menu-item"
										onSelect={() => openPreview(entry)}
									>
										<Eye size={14} />
										<span>Preview</span>
									</ContextMenu.Item>
									<ContextMenu.Item
										className="context-menu-item"
										onSelect={handleDownload}
									>
										<Download size={14} />
									<span>Download</span>
								</ContextMenu.Item>
							</>
						)}
						<ContextMenu.Item
							className="context-menu-item"
							onSelect={() => void handleTransfer("copy")}
							disabled={!canTransfer}
						>
							<Copy size={14} />
							<span>Copy to other pane</span>
						</ContextMenu.Item>
						<ContextMenu.Item
							className="context-menu-item"
							onSelect={() => void handleTransfer("move")}
							disabled={!canTransfer}
						>
							<Scissors size={14} />
							<span>Move to other pane</span>
						</ContextMenu.Item>
							<ContextMenu.Separator className="context-menu-separator" />
							<ContextMenu.Item
								className="context-menu-item"
								onSelect={handleRenameOpen}
							>
								<Pencil size={14} />
								<span>Rename</span>
							</ContextMenu.Item>
							<ContextMenu.Item
								className="context-menu-item destructive"
								onSelect={handleDeleteOpen}
							>
								<Trash2 size={14} />
								<span>Delete</span>
							</ContextMenu.Item>
						</ContextMenu.Content>
					</Theme>
				</ContextMenu.Portal>
			</ContextMenu.Root>

			<RenameDialog
				entry={entry}
				targetPath={renameTargetPath}
				open={renameOpen}
				onOpenChange={handleRenameOpenChange}
			/>
			<DeleteConfirmDialog
				entry={entry}
				targetPath={deleteTargetPath}
				open={deleteOpen}
				onOpenChange={handleDeleteOpenChange}
			/>
		</>
	);
}
