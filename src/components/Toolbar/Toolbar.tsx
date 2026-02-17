import { useMemo, useRef, useState, type ReactNode } from "react";
import {
	LayoutGrid,
	List,
	FolderPlus,
	Upload,
	RefreshCw,
	Copy,
	Scissors,
	ArrowUpDown,
	ArrowUp,
	Home,
	ChevronRight,
	Pencil,
	Image,
	Trash2,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Theme, Tooltip } from "@radix-ui/themes";
import {
	useFileStore,
	selectCurrentPath,
	selectEntries,
	selectLoading,
	useExplorerPaneId,
} from "@/store/file-store";
import {
	checkUploadConflicts,
	emptyTrash,
	isUploadConflictError,
	uploadFileItems,
	type UploadConflictStrategy,
} from "@/lib/api-client";
import { useToast } from "@/components/Toast/useToast";
import { NewFolderDialog } from "@/components/Dialogs/NewFolderDialog";
import { UploadConflictDialog } from "@/components/Dialogs/UploadConflictDialog";
import type { SortField, SortDirection, TaskOperation } from "@/types";
import { isTrashFilesPath } from "@/lib/trash";
import {
	getDirectChildName,
	runCopyMoveTask,
	resolveTransferNames,
} from "@/lib/copy-move-task";

function normalizePathInput(input: string): string {
	const normalized = input.replace(/\\/g, "/").trim();
	const withoutLeadingSlash = normalized.replace(/^\/+/, "");
	const collapsedSlashes = withoutLeadingSlash.replace(/\/{2,}/g, "/");
	return collapsedSlashes.replace(/\/+$/, "");
}

interface PendingUploadConflict {
	uploadPath: string;
	files: File[];
	conflictingNames: string[];
}

function formatPathForInput(path: string): string {
	return path ? `/${path}` : "/";
}

function IconHelpTooltip({
	content,
	children,
}: {
	content: string;
	children: ReactNode;
}) {
	return (
		<Tooltip content={content} side="top" delayDuration={120}>
			<span style={{ display: "inline-flex" }}>{children}</span>
		</Tooltip>
	);
}

export function Toolbar() {
	const activePaneId = useFileStore((s) => s.activePaneId);
	const viewMode = useFileStore((s) => s.viewMode);
	const setViewMode = useFileStore((s) => s.setViewMode);
	const sort = useFileStore((s) => s.sort);
	const setSort = useFileStore((s) => s.setSort);
	const loading = useFileStore(selectLoading);
	const currentPath = useFileStore(selectCurrentPath);
	const entries = useFileStore(selectEntries);
	const selectedPaths = useFileStore((s) => s.selectedPaths);
	const clearSelection = useFileStore((s) => s.clearSelection);
	const navigate = useFileStore((s) => s.navigate);
	const refresh = useFileStore((s) => s.refresh);
	const paneId = useExplorerPaneId();
	const { showToast } = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [newFolderOpen, setNewFolderOpen] = useState(false);
	const [newFolderTargetPath, setNewFolderTargetPath] = useState<string | null>(
		null,
	);
	const [isEditingPath, setIsEditingPath] = useState(false);
	const [pathInput, setPathInput] = useState("");
	const [transferBusy, setTransferBusy] = useState(false);
	const [emptyingTrash, setEmptyingTrash] = useState(false);
	const isTrashView = isTrashFilesPath(currentPath);
	const [uploadBusy, setUploadBusy] = useState(false);
	const [pendingUploadConflict, setPendingUploadConflict] =
		useState<PendingUploadConflict | null>(null);
	const parentPath = currentPath
		.split("/")
		.filter(Boolean)
		.slice(0, -1)
		.join("/");
	const canGoUp = currentPath !== "" && !loading;
	const segments = currentPath ? currentPath.split("/").filter(Boolean) : [];
	const currentEntryPathSet = useMemo(
		() => new Set(entries.map((entry) => entry.path)),
		[entries],
	);

	const uploadWithStrategy = async (
		uploadPath: string,
		files: File[],
		strategy: UploadConflictStrategy,
	) => {
		const { files: uploadedFiles } = await uploadFileItems(
			uploadPath,
			files.map((file) => ({ file, relativePath: file.name })),
			{ onConflict: strategy },
		);

		showToast(
			`Uploaded ${uploadedFiles.length} file${uploadedFiles.length === 1 ? "" : "s"}`,
		);
		await refresh();
	};

	const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		e.target.value = "";
		if (!files || files.length === 0 || uploadBusy) return;

		const uploadPath = currentPath;
		const selectedFiles = Array.from(files);

		setUploadBusy(true);
		try {
			const { conflicts } = await checkUploadConflicts(
				uploadPath,
				selectedFiles.map((file) => file.name),
			);
			if (conflicts.length > 0) {
				setPendingUploadConflict({
					uploadPath,
					files: selectedFiles,
					conflictingNames: conflicts,
				});
				return;
			}

			await uploadWithStrategy(uploadPath, selectedFiles, "cancel");
		} catch (err) {
			if (isUploadConflictError(err) && err.conflicts.length > 0) {
				setPendingUploadConflict({
					uploadPath,
					files: selectedFiles,
					conflictingNames: err.conflicts,
				});
				return;
			}

			showToast((err as Error).message, "error");
		} finally {
			setUploadBusy(false);
		}
	};

	const handleUploadConflictOpenChange = (open: boolean) => {
		if (open || uploadBusy) return;
		setPendingUploadConflict(null);
	};

	const handleResolveUploadConflict = async (
		strategy: UploadConflictStrategy,
	) => {
		if (!pendingUploadConflict || uploadBusy) return;

		setUploadBusy(true);
		try {
			await uploadWithStrategy(
				pendingUploadConflict.uploadPath,
				pendingUploadConflict.files,
				strategy,
			);
			setPendingUploadConflict(null);
		} catch (err) {
			showToast((err as Error).message, "error");
		} finally {
			setUploadBusy(false);
		}
	};

	const handleSort = (field: SortField) => {
		const direction: SortDirection =
			sort.field === field && sort.direction === "asc" ? "desc" : "asc";
		setSort({ field, direction });
	};

	const handleRefresh = async () => {
		if (loading) return;
		try {
			await refresh();
		} catch (err) {
			showToast((err as Error).message, "error");
		}
	};

	const handleEmptyTrash = async () => {
		if (emptyingTrash) return;
		const confirmed = window.confirm(
			"Empty trash permanently deletes all items. Continue?",
		);
		if (!confirmed) return;

		setEmptyingTrash(true);
		try {
			await emptyTrash();
			showToast("Trash emptied");
			clearSelection();
			await refresh();
		} catch (err) {
			showToast((err as Error).message, "error");
		} finally {
			setEmptyingTrash(false);
		}
	};

	const handleNewFolderOpen = () => {
		setNewFolderTargetPath(currentPath);
		setNewFolderOpen(true);
	};

	const handleNewFolderOpenChange = (open: boolean) => {
		setNewFolderOpen(open);
		if (!open) {
			setNewFolderTargetPath(null);
		}
	};

	const handlePathSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		await navigate(normalizePathInput(pathInput));
		setIsEditingPath(false);
	};

	const handlePathBlur = () => {
		setIsEditingPath(false);
	};

	const handlePathKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key !== "Escape") return;
		setIsEditingPath(false);
		e.currentTarget.blur();
	};

	const handlePathEdit = () => {
		if (loading) return;
		setPathInput(formatPathForInput(currentPath));
		setIsEditingPath(true);
	};

	const handlePathBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (isEditingPath || loading) return;
		const target = e.target as HTMLElement;
		if (target.closest("button")) return;
		handlePathEdit();
	};

	const handleGoUp = async () => {
		if (!canGoUp) return;
		await navigate(parentPath);
	};

	const handleTransfer = async (operation: TaskOperation) => {
		if (transferBusy) return;
		const sourcePath = currentPath;
		const {
			names,
			skippedOutsideCurrentDir,
			skippedMissingInCurrentDir,
		} = resolveTransferNames({
			sourcePath,
			candidatePaths: selectedPaths,
			currentEntryPathSet,
		});

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
				sourcePath,
				sourcePaneId,
				names,
				showToast,
			});
		} finally {
			setTransferBusy(false);
		}
	};

	const hasTransferSelection = useMemo(() => {
		for (const selectedPath of selectedPaths) {
			if (!currentEntryPathSet.has(selectedPath)) continue;
			if (getDirectChildName(currentPath, selectedPath)) {
				return true;
			}
		}
		return false;
	}, [currentEntryPathSet, currentPath, selectedPaths]);

	const canTransfer = !loading && !transferBusy && hasTransferSelection;

	return (
		<div className="toolbar">
			<div className="toolbar-top">
				<div className="toolbar-nav">
					<IconHelpTooltip content="Go up one level">
						<button
							className="toolbar-btn"
							onClick={handleGoUp}
							aria-label="Go up one level"
							disabled={!canGoUp}
						>
							<ArrowUp size={18} />
						</button>
					</IconHelpTooltip>
					<div
						className={`path-bar ${isEditingPath ? "editing" : ""}`}
						onClick={handlePathBarClick}
					>
						{isEditingPath ? (
							<form className="path-form" onSubmit={handlePathSubmit}>
								<input
									className="path-input"
									type="text"
									value={pathInput}
									onChange={(e) => setPathInput(e.target.value)}
									onBlur={handlePathBlur}
									onKeyDown={handlePathKeyDown}
									spellCheck={false}
									autoComplete="off"
									aria-label="Path"
									title="Enter path and press Enter"
									disabled={loading}
									autoFocus
								/>
							</form>
						) : (
							<>
							<div className="path-breadcrumbs">
									<IconHelpTooltip content="Root">
										<button
											className="path-segment path-home"
											onClick={() => navigate("")}
											disabled={loading}
										>
											<Home size={14} />
										</button>
									</IconHelpTooltip>
									{segments.map((segment, i) => {
										const path = segments.slice(0, i + 1).join("/");
										return (
											<span key={path} className="path-segment-wrap">
												<ChevronRight size={14} className="path-separator" />
												<button
													className="path-segment"
													onClick={() => navigate(path)}
													title={path}
													disabled={loading}
												>
													{segment}
												</button>
											</span>
										);
									})}
								</div>
								<IconHelpTooltip content="Edit path">
									<button
										className="path-edit-btn"
										onClick={handlePathEdit}
										aria-label="Edit path"
										disabled={loading}
									>
										<Pencil size={14} />
									</button>
								</IconHelpTooltip>
							</>
						)}
					</div>
				</div>
			</div>

			<div className="toolbar-bottom">
				<div className="toolbar-actions toolbar-actions-primary">
					<IconHelpTooltip content="New Folder">
						<button className="toolbar-btn" onClick={handleNewFolderOpen}>
							<FolderPlus size={18} />
						</button>
					</IconHelpTooltip>

					<IconHelpTooltip content="Upload">
						<button
							className="toolbar-btn"
							onClick={() => fileInputRef.current?.click()}
						>
							<Upload size={18} />
						</button>
					</IconHelpTooltip>

					<IconHelpTooltip content="Refresh">
						<button
							className="toolbar-btn"
							onClick={() => void handleRefresh()}
							aria-label="Refresh current pane"
							disabled={loading}
						>
							<RefreshCw size={18} className={loading ? "spinner" : undefined} />
						</button>
					</IconHelpTooltip>
					{isTrashView ? (
						<IconHelpTooltip content="Empty trash">
							<button
								className="toolbar-btn"
								onClick={() => void handleEmptyTrash()}
								aria-label="Empty trash"
								disabled={emptyingTrash}
							>
								<Trash2 size={18} />
							</button>
						</IconHelpTooltip>
					) : null}
					<input
						ref={fileInputRef}
						type="file"
						multiple
						onChange={handleUpload}
						style={{ display: "none" }}
					/>

					<IconHelpTooltip content="Copy selected to other pane">
						<button
							className="toolbar-btn"
							onClick={() => handleTransfer("copy")}
							disabled={!canTransfer}
						>
							<Copy size={18} />
						</button>
					</IconHelpTooltip>

					<IconHelpTooltip content="Move selected to other pane">
						<button
							className="toolbar-btn"
							onClick={() => handleTransfer("move")}
							disabled={!canTransfer}
						>
							<Scissors size={18} />
						</button>
					</IconHelpTooltip>
				</div>

				<div className="toolbar-actions toolbar-actions-secondary">
					<DropdownMenu.Root>
						<Tooltip content="Sort" side="top" delayDuration={120}>
							<DropdownMenu.Trigger asChild>
								<button className="toolbar-btn">
									<ArrowUpDown size={18} />
								</button>
							</DropdownMenu.Trigger>
						</Tooltip>
						<DropdownMenu.Portal>
							<Theme
								appearance="light"
								accentColor="indigo"
								grayColor="slate"
								panelBackground="solid"
								radius="large"
								scaling="100%"
							>
								<DropdownMenu.Content className="dropdown-content" sideOffset={5}>
									<DropdownMenu.Item
										className="dropdown-item"
										onSelect={() => handleSort("name")}
									>
										Name{" "}
										{sort.field === "name" &&
											(sort.direction === "asc" ? "↑" : "↓")}
									</DropdownMenu.Item>
									<DropdownMenu.Item
										className="dropdown-item"
										onSelect={() => handleSort("size")}
									>
										Size{" "}
										{sort.field === "size" &&
											(sort.direction === "asc" ? "↑" : "↓")}
									</DropdownMenu.Item>
									<DropdownMenu.Item
										className="dropdown-item"
										onSelect={() => handleSort("modifiedAt")}
									>
										Modified{" "}
										{sort.field === "modifiedAt" &&
											(sort.direction === "asc" ? "↑" : "↓")}
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</Theme>
						</DropdownMenu.Portal>
					</DropdownMenu.Root>

					<div className="view-toggle">
						<IconHelpTooltip content="List view">
							<button
								className={`toolbar-btn ${viewMode === "list" ? "active" : ""}`}
								onClick={() => setViewMode("list")}
							>
								<List size={18} />
							</button>
						</IconHelpTooltip>
						<IconHelpTooltip content="Grid view">
							<button
								className={`toolbar-btn ${viewMode === "grid" ? "active" : ""}`}
								onClick={() => setViewMode("grid")}
							>
								<LayoutGrid size={18} />
							</button>
						</IconHelpTooltip>
						<IconHelpTooltip content="Photo view">
							<button
								className={`toolbar-btn ${viewMode === "photo" ? "active" : ""}`}
								onClick={() => setViewMode("photo")}
							>
								<Image size={18} />
							</button>
						</IconHelpTooltip>
					</div>
				</div>
			</div>

			<NewFolderDialog
				targetPath={newFolderTargetPath}
				open={newFolderOpen}
				onOpenChange={handleNewFolderOpenChange}
			/>
			<UploadConflictDialog
				open={pendingUploadConflict !== null}
				busy={uploadBusy}
				targetPath={pendingUploadConflict?.uploadPath ?? ""}
				conflictingNames={pendingUploadConflict?.conflictingNames ?? []}
				onOpenChange={handleUploadConflictOpenChange}
				onConfirmAutoRename={() =>
					void handleResolveUploadConflict("auto-rename")
				}
				onConfirmOverwrite={() =>
					void handleResolveUploadConflict("overwrite")
				}
			/>
		</div>
	);
}
