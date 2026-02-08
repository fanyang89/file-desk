import { useState } from "react";
import { Dialog } from "radix-ui";
import { Button, Flex, TextField, Theme } from "@radix-ui/themes";
import { X } from "lucide-react";
import { useFileStore } from "@/store/file-store";
import { createFolder } from "@/lib/api-client";
import { useToast } from "@/components/Toast/useToast";

interface NewFolderDialogProps {
	targetPath: string | null;
	targetTabId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function NewFolderDialog({
	targetPath,
	targetTabId,
	open,
	onOpenChange,
}: NewFolderDialogProps) {
	const [name, setName] = useState("");
	const refreshTab = useFileStore((s) => s.refreshTab);
	const { showToast } = useToast();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		if (targetPath === null || targetTabId === null) {
			showToast("No target directory selected", "error");
			return;
		}

		try {
			await createFolder(targetPath, name.trim());
			showToast(`Folder "${name.trim()}" created`);
			await refreshTab(targetTabId);
			onOpenChange(false);
			setName("");
		} catch (err) {
			showToast((err as Error).message, "error");
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Theme
					appearance="light"
					accentColor="indigo"
					grayColor="slate"
					panelBackground="solid"
					radius="large"
					scaling="100%"
				>
					<Dialog.Overlay className="dialog-overlay" />
					<Dialog.Content className="dialog-content">
						<Dialog.Title className="dialog-title">New Folder</Dialog.Title>
						<form onSubmit={handleSubmit}>
							<div className="dialog-field">
								<TextField.Root
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Folder name"
									size="3"
									autoFocus
								/>
							</div>
							<Flex className="dialog-actions" gap="2" justify="end">
								<Button
									type="button"
									variant="soft"
									color="gray"
									onClick={() => onOpenChange(false)}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={!name.trim()}>
									Create
								</Button>
							</Flex>
						</form>
						<Dialog.Close asChild>
							<button className="dialog-close" aria-label="Close">
								<X size={16} />
							</button>
						</Dialog.Close>
					</Dialog.Content>
				</Theme>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
