import { useEffect, useMemo, useState } from "react";
import { AlertDialog } from "radix-ui";
import { Button, Flex, TextField, Theme } from "@radix-ui/themes";
import type { FileEntry } from "@/types";
import { useFileStore } from "@/store/file-store";
import {
	deleteEntry,
	getDeleteImpact,
	type DeleteImpactResponse,
} from "@/lib/api-client";
import { formatFileSize } from "@/lib/format";
import { useToast } from "@/components/Toast/useToast";
import { isTrashPath } from "@/lib/trash";

const LARGE_DELETE_ITEM_THRESHOLD = 1000;
const LARGE_DELETE_BYTES_THRESHOLD = 1024 * 1024 * 1024;

type DeleteImpactState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; impact: DeleteImpactResponse }
	| { status: "error"; message: string };

function formatPath(path: string): string {
	const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
	return normalized ? `/${normalized}` : "/";
}

function isLargeDelete(impact: DeleteImpactResponse): boolean {
	return (
		impact.totalItems >= LARGE_DELETE_ITEM_THRESHOLD ||
		impact.totalBytes >= LARGE_DELETE_BYTES_THRESHOLD
	);
}

function getDeletePhrase(name: string): string {
	return `DELETE ${name}`;
}

interface DeleteConfirmDialogProps {
	entry: FileEntry;
	targetPath: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function DeleteConfirmDialog({
	entry,
	targetPath,
	open,
	onOpenChange,
}: DeleteConfirmDialogProps) {
	const refresh = useFileStore((s) => s.refresh);
	const clearSelection = useFileStore((s) => s.clearSelection);
	const { showToast } = useToast();
	const [impactState, setImpactState] = useState<DeleteImpactState>({
		status: "idle",
	});
	const [requiresSecondClick, setRequiresSecondClick] = useState(false);
	const [deletePhraseInput, setDeletePhraseInput] = useState("");
	const [isDeleting, setIsDeleting] = useState(false);

	const objectLabel = entry.isDirectory ? "folder" : "file";
	const isPermanentDelete = targetPath !== null && isTrashPath(targetPath);
	const deletePhrase = useMemo(() => getDeletePhrase(entry.name), [entry.name]);
	const impact = impactState.status === "ready" ? impactState.impact : null;
	const isImpactLoading = impactState.status === "loading";
	const isHighRiskDelete = impact ? isLargeDelete(impact) : false;
	const requiresPhraseConfirm =
		!isImpactLoading &&
		(impactState.status === "error" || isHighRiskDelete);
	const phraseMatches = deletePhraseInput === deletePhrase;
	const isDeleteButtonDisabled =
		isDeleting ||
		targetPath === null ||
		isImpactLoading ||
		(requiresPhraseConfirm && !phraseMatches);

	const deleteButtonLabel = (() => {
		if (isDeleting) {
			return isPermanentDelete ? "Deleting..." : "Moving...";
		}

		if (requiresPhraseConfirm && impact) {
			return isPermanentDelete
				? `Delete ${impact.totalItems.toLocaleString()} items`
				: `Move ${impact.totalItems.toLocaleString()} items to trash`;
		}

		if (requiresPhraseConfirm) {
			return isPermanentDelete
				? `Delete ${objectLabel}`
				: `Move ${objectLabel} to trash`;
		}

		if (requiresSecondClick) {
			return isPermanentDelete ? "Confirm delete" : "Confirm move";
		}

		return isPermanentDelete
			? `Delete ${objectLabel}`
			: `Move ${objectLabel} to trash`;
	})();

	useEffect(() => {
		if (!open) {
			setImpactState({ status: "idle" });
			setRequiresSecondClick(false);
			setDeletePhraseInput("");
			setIsDeleting(false);
			return;
		}

		setRequiresSecondClick(false);
		setDeletePhraseInput("");

		if (targetPath === null) {
			setImpactState({
				status: "error",
				message: "No target directory selected",
			});
			return;
		}

		let cancelled = false;
		setImpactState({ status: "loading" });

		void getDeleteImpact(targetPath, entry.name)
			.then((result) => {
				if (cancelled) return;
				setImpactState({ status: "ready", impact: result });
			})
			.catch((err) => {
				if (cancelled) return;
				setImpactState({
					status: "error",
					message: (err as Error).message,
				});
			});

		return () => {
			cancelled = true;
		};
	}, [open, targetPath, entry.name, entry.path]);

	const handleDeleteConfirm = async () => {
		if (targetPath === null) {
			showToast("No target directory selected", "error");
			return;
		}

		setIsDeleting(true);

		try {
			await deleteEntry(targetPath, entry.name);
			showToast(
				isPermanentDelete
					? `"${entry.name}" permanently deleted`
					: `"${entry.name}" moved to trash`,
			);
			clearSelection();
			await refresh();
			onOpenChange(false);
		} catch (err) {
			showToast((err as Error).message, "error");
		} finally {
			setIsDeleting(false);
		}
	};

	const handleDeleteClick = () => {
		if (targetPath === null) {
			showToast("No target directory selected", "error");
			return;
		}

		if (isImpactLoading || isDeleting) {
			return;
		}

		if (requiresPhraseConfirm) {
			if (!phraseMatches) {
				return;
			}
			void handleDeleteConfirm();
			return;
		}

		if (!requiresSecondClick) {
			setRequiresSecondClick(true);
			return;
		}

		void handleDeleteConfirm();
	};

	const handleOpenChange = (nextOpen: boolean) => {
		if (isDeleting && !nextOpen) {
			return;
		}

		onOpenChange(nextOpen);
	};

	const warningText = isPermanentDelete
		? entry.isDirectory
			? "All files and subfolders inside will be permanently deleted."
			: "The selected file will be permanently deleted."
		: entry.isDirectory
			? "All files and subfolders inside will be moved to trash."
			: "The selected file will be moved to trash.";

	return (
		<AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
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
					<AlertDialog.Content className="dialog-content delete-dialog-content">
						<AlertDialog.Title className="dialog-title">
							{isPermanentDelete ? "Delete permanently" : "Move to trash"}?
						</AlertDialog.Title>
						<AlertDialog.Description className="dialog-description delete-dialog-description">
							Review the impact before {isPermanentDelete ? "deleting" : "moving"}{" "}
							this {objectLabel}.
						</AlertDialog.Description>
						<div className="delete-impact-card">
							<div className="delete-impact-name" title={entry.name}>
								{entry.name}
							</div>
							<div className="delete-impact-path" title={formatPath(entry.path)}>
								{formatPath(entry.path)}
							</div>
							<div className="delete-impact-warning">{warningText}</div>

							{isImpactLoading && (
								<div className="delete-impact-loading">
									Calculating delete impact...
								</div>
							)}

							{impact && (
								<div className="delete-impact-stats">
									<div className="delete-impact-stat">
										<span>Files</span>
										<strong>{impact.fileCount.toLocaleString()}</strong>
									</div>
									<div className="delete-impact-stat">
										<span>Folders</span>
										<strong>{impact.directoryCount.toLocaleString()}</strong>
									</div>
									<div className="delete-impact-stat">
										<span>Total items</span>
										<strong>{impact.totalItems.toLocaleString()}</strong>
									</div>
									<div className="delete-impact-stat">
										<span>Estimated size</span>
										<strong>{formatFileSize(impact.totalBytes)}</strong>
									</div>
								</div>
							)}

							{impactState.status === "error" && (
								<div className="delete-impact-error">
									{impactState.message}. Use phrase confirmation to proceed safely.
								</div>
							)}
						</div>

						<div className="delete-warning-line">
							{isPermanentDelete
								? "This action cannot be undone."
								: "You can restore this item from Trash."}
						</div>

						{requiresPhraseConfirm ? (
							<div className="delete-phrase-wrap">
								<label className="delete-phrase-label" htmlFor="delete-phrase-input">
									Type <code>{deletePhrase}</code> to confirm {isPermanentDelete ? "deletion" : "move"}.
								</label>
								<TextField.Root
									id="delete-phrase-input"
									value={deletePhraseInput}
									onChange={(event) => setDeletePhraseInput(event.target.value)}
									placeholder={deletePhrase}
									autoFocus
									disabled={isDeleting}
								/>
								{deletePhraseInput.length > 0 && !phraseMatches ? (
									<div className="delete-phrase-error">
										Phrase must match exactly, including uppercase letters.
									</div>
								) : null}
							</div>
						) : (
							<div
								className={
									requiresSecondClick
										? "delete-double-confirm-note is-armed"
										: "delete-double-confirm-note"
								}
							>
								{requiresSecondClick
									? isPermanentDelete
										? "Click Delete again to permanently remove it."
										: "Click Move again to send it to trash."
									: isPermanentDelete
										? "Two-step confirmation enabled: first click arms deletion."
										: "Two-step confirmation enabled: first click arms move to trash."}
							</div>
						)}

						<Flex className="dialog-actions" gap="2" justify="end">
							<AlertDialog.Cancel asChild>
								<Button variant="soft" color="gray" disabled={isDeleting}>
									Cancel
								</Button>
							</AlertDialog.Cancel>
							<Button
								color="red"
								disabled={isDeleteButtonDisabled}
								onClick={handleDeleteClick}
							>
								{deleteButtonLabel}
							</Button>
						</Flex>
					</AlertDialog.Content>
				</Theme>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	);
}
