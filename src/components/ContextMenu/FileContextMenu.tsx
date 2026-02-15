import { useState } from "react";
import { ContextMenu } from "radix-ui";
import { Theme } from "@radix-ui/themes";
import { Download, Pencil, Trash2, FolderOpen, Eye } from "lucide-react";
import type { FileEntry } from "@/types";
import { useFileStore, selectCurrentPath } from "@/store/file-store";
import { getDownloadUrl } from "@/lib/api-client";
import { RenameDialog } from "@/components/Dialogs/RenameDialog";
import { DeleteConfirmDialog } from "@/components/Dialogs/DeleteConfirmDialog";

interface FileContextMenuProps {
	entry: FileEntry;
	children: React.ReactNode;
}

export function FileContextMenu({ entry, children }: FileContextMenuProps) {
	const { navigate, openPreview } = useFileStore();
	const currentPath = useFileStore(selectCurrentPath);
	const [renameOpen, setRenameOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [renameTargetPath, setRenameTargetPath] = useState<string | null>(null);
	const [deleteTargetPath, setDeleteTargetPath] = useState<string | null>(null);

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
