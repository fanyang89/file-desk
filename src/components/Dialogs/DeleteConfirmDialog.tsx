import { AlertDialog } from "radix-ui";
import { Button, Flex, Theme } from "@radix-ui/themes";
import type { FileEntry } from "@/types";
import { useFileStore } from "@/store/file-store";
import { deleteEntry } from "@/lib/api-client";
import { useToast } from "@/components/Toast/useToast";

interface DeleteConfirmDialogProps {
	entry: FileEntry;
	targetPath: string | null;
	targetTabId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function DeleteConfirmDialog({
	entry,
	targetPath,
	targetTabId,
	open,
	onOpenChange,
}: DeleteConfirmDialogProps) {
	const activeTabId = useFileStore((s) => s.activeTabId);
	const refreshTab = useFileStore((s) => s.refreshTab);
	const clearSelection = useFileStore((s) => s.clearSelection);
	const { showToast } = useToast();

	const handleDelete = async () => {
		if (targetPath === null || targetTabId === null) {
			showToast("No target directory selected", "error");
			return;
		}

		try {
			await deleteEntry(targetPath, entry.name);
			showToast(`"${entry.name}" deleted`);
			if (activeTabId === targetTabId) {
				clearSelection();
			}
			await refreshTab(targetTabId);
			onOpenChange(false);
		} catch (err) {
			showToast((err as Error).message, "error");
		}
	};

	return (
		<AlertDialog.Root open={open} onOpenChange={onOpenChange}>
			<AlertDialog.Portal>
				<Theme
					appearance="light"
					accentColor="indigo"
					grayColor="slate"
					panelBackground="solid"
					radius="large"
					scaling="100%"
				>
					<AlertDialog.Overlay className="dialog-overlay" />
					<AlertDialog.Content className="dialog-content">
						<AlertDialog.Title className="dialog-title">
							Delete
						</AlertDialog.Title>
						<AlertDialog.Description className="dialog-description">
							Are you sure you want to delete "{entry.name}"?
							{entry.isDirectory && " This will delete all contents inside."}
							This action cannot be undone.
						</AlertDialog.Description>
						<Flex className="dialog-actions" gap="2" justify="end">
							<AlertDialog.Cancel asChild>
								<Button variant="soft" color="gray">
									Cancel
								</Button>
							</AlertDialog.Cancel>
							<AlertDialog.Action asChild>
								<Button color="red" onClick={handleDelete}>
									Delete
								</Button>
							</AlertDialog.Action>
						</Flex>
					</AlertDialog.Content>
				</Theme>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	);
}
