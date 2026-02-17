import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { Button, Flex, Theme } from "@radix-ui/themes";
import { X } from "lucide-react";
import type { FileEntry } from "@/types";
import { listFilesRecursive } from "@/lib/api-client";
import { formatDateTime, formatFileSize } from "@/lib/format";

interface PropertiesDialogProps {
	entry: FileEntry;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface DirectoryStats {
	fileCount: number;
	folderCount: number;
	totalSize: number;
}

type DirectoryStatsState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; stats: DirectoryStats }
	| { status: "error"; message: string };

type DirectoryStatsResult =
	| { path: string; status: "ready"; stats: DirectoryStats }
	| { path: string; status: "error"; message: string }
	| null;

function formatPath(path: string): string {
	return path ? `/${path}` : "/";
}

function getParentPath(filePath: string): string {
	const segments = filePath.split("/").filter(Boolean);
	if (segments.length <= 1) {
		return "";
	}

	return segments.slice(0, -1).join("/");
}

function formatSize(bytes: number): string {
	const exact = `${bytes.toLocaleString()} bytes`;
	if (bytes === 0) {
		return `0 B (${exact})`;
	}

	return `${formatFileSize(bytes)} (${exact})`;
}

function resolveFileType(entry: FileEntry): string {
	if (entry.isDirectory) {
		return "File folder";
	}

	if (!entry.extension) {
		return "File";
	}

	return `${entry.extension.toUpperCase()} File`;
}

export function PropertiesDialog({
	entry,
	open,
	onOpenChange,
}: PropertiesDialogProps) {
	const [directoryStatsResult, setDirectoryStatsResult] =
		useState<DirectoryStatsResult>(null);

	useEffect(() => {
		if (!open || !entry.isDirectory) {
			return;
		}

		let cancelled = false;

		void (async () => {
			try {
				const response = await listFilesRecursive(entry.path);
				if (cancelled) return;

				const stats = response.files.reduce<DirectoryStats>(
					(acc, item) => {
						if (item.isDirectory) {
							acc.folderCount += 1;
							return acc;
						}

						acc.fileCount += 1;
						acc.totalSize += item.size;
						return acc;
					},
					{ fileCount: 0, folderCount: 0, totalSize: 0 },
				);

				setDirectoryStatsResult({ path: entry.path, status: "ready", stats });
			} catch (err) {
				if (cancelled) return;
				setDirectoryStatsResult({
					path: entry.path,
					status: "error",
					message: (err as Error).message,
				});
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [entry.isDirectory, entry.path, open]);

	const directoryStatsState: DirectoryStatsState = !open || !entry.isDirectory
		? { status: "idle" }
		: directoryStatsResult && directoryStatsResult.path === entry.path
			? directoryStatsResult.status === "ready"
				? { status: "ready", stats: directoryStatsResult.stats }
				: { status: "error", message: directoryStatsResult.message }
			: { status: "loading" };

	const location = formatPath(getParentPath(entry.path));
	const sizeValue = entry.isDirectory
		? directoryStatsState.status === "ready"
			? formatSize(directoryStatsState.stats.totalSize)
			: directoryStatsState.status === "error"
				? "Unable to calculate"
				: "Calculating..."
		: formatSize(entry.size);

	const containsValue = entry.isDirectory
		? directoryStatsState.status === "ready"
			? `${directoryStatsState.stats.fileCount.toLocaleString()} files, ${directoryStatsState.stats.folderCount.toLocaleString()} folders`
			: directoryStatsState.status === "error"
				? "Unable to calculate"
				: "Calculating..."
		: "-";

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
					<Dialog.Content className="dialog-content properties-dialog-content">
						<Dialog.Title className="dialog-title">Properties</Dialog.Title>
						<div className="properties-grid">
							<div className="properties-label">Name</div>
							<div className="properties-value" title={entry.name}>
								{entry.name}
							</div>

							<div className="properties-label">Type</div>
							<div className="properties-value">{resolveFileType(entry)}</div>

							<div className="properties-label">Location</div>
							<div className="properties-value" title={location}>
								{location}
							</div>

							<div className="properties-label">Path</div>
							<div className="properties-value properties-path" title={entry.path}>
								{formatPath(entry.path)}
							</div>

							<div className="properties-label">Size</div>
							<div className="properties-value">{sizeValue}</div>

							<div className="properties-label">Contains</div>
							<div className="properties-value">{containsValue}</div>

							<div className="properties-label">Created</div>
							<div className="properties-value">
								{formatDateTime(entry.createdAt)}
							</div>

							<div className="properties-label">Modified</div>
							<div className="properties-value">
								{formatDateTime(entry.modifiedAt)}
							</div>
						</div>
						{directoryStatsState.status === "error" && entry.isDirectory ? (
							<p className="properties-error">{directoryStatsState.message}</p>
						) : null}
						<Flex className="dialog-actions" gap="2" justify="end">
							<Button onClick={() => onOpenChange(false)}>Close</Button>
						</Flex>
						<Dialog.Close asChild>
							<button className="dialog-close" title="Close" aria-label="Close">
								<X size={16} />
							</button>
						</Dialog.Close>
					</Dialog.Content>
				</Theme>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
