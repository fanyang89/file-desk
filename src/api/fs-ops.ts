import { constants as fsConstants, type Dirent, type Stats } from "fs";
import fs from "fs/promises";
import path from "path";
import { safePath } from "./fs-utils";

export type CopyMoveOperation = "copy" | "move";

export interface CopyMoveProgress {
	processedItems: number;
	totalItems: number;
	currentItem: string | null;
}

type TransferNodeKind = "file" | "directory" | "symlink";

interface PreparedTransferItem {
	name: string;
	sourceAbsPath: string;
	targetAbsPath: string;
	nodeKind: TransferNodeKind;
	targetExists: boolean;
	subtreeSize: number;
}

interface RunCopyMoveTaskInput {
	operation: CopyMoveOperation;
	sourcePath: string;
	targetPath: string;
	names: string[];
	overwriteNames?: string[];
	onProgress?: (progress: CopyMoveProgress) => Promise<void> | void;
	shouldCancel?: () => Promise<boolean> | boolean;
}

export class TaskCancelledError extends Error {
	constructor() {
		super("Task cancelled");
		this.name = "TaskCancelledError";
	}
}

class MoveSourceCleanupError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MoveSourceCleanupError";
	}
}

function assertValidName(name: string): string {
	if (name.length === 0) {
		throw new Error("Name is required");
	}
	if (name === "." || name === "..") {
		throw new Error(`Invalid name: "${name}"`);
	}
	if (name.includes("/") || name.includes("\\")) {
		throw new Error(`Invalid name: "${name}"`);
	}
	return name;
}

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function removeNode(filePath: string): Promise<void> {
	const stat = await fs.lstat(filePath);
	if (stat.isDirectory()) {
		await fs.rm(filePath, { recursive: true, force: false });
		return;
	}

	await fs.unlink(filePath);
}

function isSubPath(parentPath: string, candidatePath: string): boolean {
	const relative = path.relative(parentPath, candidatePath);
	return (
		relative.length > 0 &&
		!relative.startsWith("..") &&
		!path.isAbsolute(relative)
	);
}

function joinRelativePath(base: string, name: string): string {
	return base ? `${base}/${name}` : name;
}

function isExdevError(err: unknown): boolean {
	return (err as NodeJS.ErrnoException).code === "EXDEV";
}

async function ensureTaskNotCancelled(
	shouldCancel?: () => Promise<boolean> | boolean,
): Promise<void> {
	if (shouldCancel && (await shouldCancel())) {
		throw new TaskCancelledError();
	}
}

function getNodeKindFromStats(stats: Stats): TransferNodeKind {
	if (stats.isSymbolicLink()) {
		return "symlink";
	}
	if (stats.isDirectory()) {
		return "directory";
	}
	if (stats.isFile()) {
		return "file";
	}

	throw new Error("Unsupported file type");
}

async function getNodeKindFromDirent(
	dirent: Dirent,
	fullPath: string,
): Promise<TransferNodeKind> {
	if (dirent.isSymbolicLink()) {
		return "symlink";
	}
	if (dirent.isDirectory()) {
		return "directory";
	}
	if (dirent.isFile()) {
		return "file";
	}

	const childStat = await fs.lstat(fullPath);
	return getNodeKindFromStats(childStat);
}

async function copySymlink(
	sourceAbsPath: string,
	targetAbsPath: string,
): Promise<void> {
	const linkTarget = await fs.readlink(sourceAbsPath);
	await fs.symlink(linkTarget, targetAbsPath);
}

async function countDirectoryUnits(directoryAbsPath: string): Promise<number> {
	let count = 1;
	const entries = await fs.readdir(directoryAbsPath, { withFileTypes: true });

	for (const entry of entries) {
		const childAbsPath = path.join(directoryAbsPath, entry.name);
		const nodeKind = await getNodeKindFromDirent(entry, childAbsPath);

		if (nodeKind === "directory") {
			count += await countDirectoryUnits(childAbsPath);
			continue;
		}

		if (nodeKind === "file" || nodeKind === "symlink") {
			count += 1;
			continue;
		}

		throw new Error(`Unsupported file type: "${entry.name}"`);
	}

	return count;
}

async function countTransferUnits(
	sourceAbsPath: string,
	nodeKind: TransferNodeKind,
): Promise<number> {
	if (nodeKind !== "directory") {
		return 1;
	}

	return countDirectoryUnits(sourceAbsPath);
}

type MarkProgress = (currentItem: string, increment?: number) => Promise<void>;

interface CopyNodeWithProgressInput {
	sourceAbsPath: string;
	targetAbsPath: string;
	nodeKind: TransferNodeKind;
	relativePath: string;
	markProgress: MarkProgress;
	shouldCancel?: () => Promise<boolean> | boolean;
}

async function copyNodeWithProgress({
	sourceAbsPath,
	targetAbsPath,
	nodeKind,
	relativePath,
	markProgress,
	shouldCancel,
}: CopyNodeWithProgressInput): Promise<void> {
	await ensureTaskNotCancelled(shouldCancel);

	if (nodeKind === "file") {
		await fs.copyFile(sourceAbsPath, targetAbsPath, fsConstants.COPYFILE_EXCL);
		await markProgress(relativePath);
		return;
	}

	if (nodeKind === "symlink") {
		await copySymlink(sourceAbsPath, targetAbsPath);
		await markProgress(relativePath);
		return;
	}

	await fs.mkdir(targetAbsPath);
	await markProgress(relativePath);

	const entries = await fs.readdir(sourceAbsPath, { withFileTypes: true });
	for (const entry of entries) {
		await ensureTaskNotCancelled(shouldCancel);

		const childSourceAbsPath = path.join(sourceAbsPath, entry.name);
		const childTargetAbsPath = path.join(targetAbsPath, entry.name);
		const childRelativePath = joinRelativePath(relativePath, entry.name);
		const childNodeKind = await getNodeKindFromDirent(entry, childSourceAbsPath);

		if (childNodeKind === "directory") {
			await copyNodeWithProgress({
				sourceAbsPath: childSourceAbsPath,
				targetAbsPath: childTargetAbsPath,
				nodeKind: "directory",
				relativePath: childRelativePath,
				markProgress,
				shouldCancel,
			});
			continue;
		}

		if (childNodeKind === "file") {
			await fs.copyFile(
				childSourceAbsPath,
				childTargetAbsPath,
				fsConstants.COPYFILE_EXCL,
			);
			await markProgress(childRelativePath);
			continue;
		}

		if (childNodeKind === "symlink") {
			await copySymlink(childSourceAbsPath, childTargetAbsPath);
			await markProgress(childRelativePath);
			continue;
		}

		throw new Error(`Unsupported file type: "${entry.name}"`);
	}
}

interface MoveNodeWithProgressInput {
	sourceAbsPath: string;
	targetAbsPath: string;
	nodeKind: TransferNodeKind;
	relativePath: string;
	subtreeSize: number;
	markProgress: MarkProgress;
	shouldCancel?: () => Promise<boolean> | boolean;
}

async function moveNodeWithProgress({
	sourceAbsPath,
	targetAbsPath,
	nodeKind,
	relativePath,
	subtreeSize,
	markProgress,
	shouldCancel,
}: MoveNodeWithProgressInput): Promise<void> {
	await ensureTaskNotCancelled(shouldCancel);

	try {
		await fs.rename(sourceAbsPath, targetAbsPath);
		await markProgress(relativePath, subtreeSize);
		return;
	} catch (err) {
		if (!isExdevError(err)) {
			throw err;
		}
	}

	if (nodeKind === "file") {
		await fs.copyFile(sourceAbsPath, targetAbsPath, fsConstants.COPYFILE_EXCL);
		try {
			await fs.unlink(sourceAbsPath);
		} catch (err) {
			throw new MoveSourceCleanupError(
				`Failed to clean up source after move: ${(err as Error).message}`,
			);
		}

		await markProgress(relativePath);
		return;
	}

	if (nodeKind === "symlink") {
		await copySymlink(sourceAbsPath, targetAbsPath);
		try {
			await fs.unlink(sourceAbsPath);
		} catch (err) {
			throw new MoveSourceCleanupError(
				`Failed to clean up source after move: ${(err as Error).message}`,
			);
		}

		await markProgress(relativePath);
		return;
	}

	await copyNodeWithProgress({
		sourceAbsPath,
		targetAbsPath,
		nodeKind: "directory",
		relativePath,
		markProgress,
		shouldCancel,
	});

	try {
		await fs.rm(sourceAbsPath, { recursive: true, force: false });
	} catch (err) {
		throw new MoveSourceCleanupError(
			`Failed to clean up source after move: ${(err as Error).message}`,
		);
	}
}

interface TransferNodeWithProgressInput {
	operation: CopyMoveOperation;
	sourceAbsPath: string;
	targetAbsPath: string;
	nodeKind: TransferNodeKind;
	relativePath: string;
	subtreeSize: number;
	markProgress: MarkProgress;
	shouldCancel?: () => Promise<boolean> | boolean;
}

async function transferNodeWithProgress({
	operation,
	sourceAbsPath,
	targetAbsPath,
	nodeKind,
	relativePath,
	subtreeSize,
	markProgress,
	shouldCancel,
}: TransferNodeWithProgressInput): Promise<void> {
	if (operation === "copy") {
		await copyNodeWithProgress({
			sourceAbsPath,
			targetAbsPath,
			nodeKind,
			relativePath,
			markProgress,
			shouldCancel,
		});
		return;
	}

	await moveNodeWithProgress({
		sourceAbsPath,
		targetAbsPath,
		nodeKind,
		relativePath,
		subtreeSize,
		markProgress,
		shouldCancel,
	});
}

async function createBackupPath(targetAbsPath: string): Promise<string> {
	const targetDirAbsPath = path.dirname(targetAbsPath);
	let attempt = 0;

	while (true) {
		const candidateName = `.file-desk-backup-${Date.now().toString(36)}-${attempt.toString(36)}`;
		const candidateAbsPath = path.join(targetDirAbsPath, candidateName);
		if (!(await pathExists(candidateAbsPath))) {
			return candidateAbsPath;
		}
		attempt += 1;
	}
}

async function cleanupOverwriteBackup(
	backupAbsPath: string,
	name: string,
): Promise<void> {
	try {
		await removeNode(backupAbsPath);
	} catch (err) {
		console.warn(
			`Failed to clean up overwrite backup for "${name}": ${(err as Error).message}`,
		);
	}
}

async function transferWithOverwrite({
	operation,
	sourceAbsPath,
	targetAbsPath,
	nodeKind,
	name,
	relativePath,
	subtreeSize,
	markProgress,
	shouldCancel,
}: {
	operation: CopyMoveOperation;
	sourceAbsPath: string;
	targetAbsPath: string;
	nodeKind: TransferNodeKind;
	name: string;
	relativePath: string;
	subtreeSize: number;
	markProgress: MarkProgress;
	shouldCancel?: () => Promise<boolean> | boolean;
}): Promise<void> {
	const backupAbsPath = await createBackupPath(targetAbsPath);
	await fs.rename(targetAbsPath, backupAbsPath);

	try {
		await transferNodeWithProgress({
			operation,
			sourceAbsPath,
			targetAbsPath,
			nodeKind,
			relativePath,
			subtreeSize,
			markProgress,
			shouldCancel,
		});
	} catch (err) {
		const targetExists = await pathExists(targetAbsPath);
		if (
			err instanceof MoveSourceCleanupError &&
			operation === "move" &&
			targetExists
		) {
			await cleanupOverwriteBackup(backupAbsPath, name);
			throw new Error(
				`${err.message}. Destination data was kept to avoid data loss.`,
			);
		}

		try {
			if (targetExists) {
				await removeNode(targetAbsPath);
			}
		} catch {
			// Ignore rollback cleanup failure and continue restoring backup.
		}

		if (await pathExists(backupAbsPath)) {
			await fs.rename(backupAbsPath, targetAbsPath);
		}

		throw err;
	}

	await cleanupOverwriteBackup(backupAbsPath, name);
}

export async function runCopyMoveTask({
	operation,
	sourcePath,
	targetPath,
	names,
	overwriteNames = [],
	onProgress,
	shouldCancel,
}: RunCopyMoveTaskInput): Promise<void> {
	const sourceBaseAbsPath = safePath(sourcePath || "");
	const targetBaseAbsPath = safePath(targetPath || "");

	const sourceBaseStat = await fs.stat(sourceBaseAbsPath);
	if (!sourceBaseStat.isDirectory()) {
		throw new Error("Source path must be a directory");
	}

	const targetBaseStat = await fs.stat(targetBaseAbsPath);
	if (!targetBaseStat.isDirectory()) {
		throw new Error("Target path must be a directory");
	}

	const uniqueNames = Array.from(new Set(names.map(assertValidName)));
	const overwriteNameSet = new Set(overwriteNames.map(assertValidName));
	if (uniqueNames.length === 0) {
		throw new Error("No files selected");
	}

	if (sourceBaseAbsPath === targetBaseAbsPath) {
		throw new Error("Source and target directories cannot be the same");
	}

	const preparedItems: PreparedTransferItem[] = [];
	let totalItems = 0;

	for (const name of uniqueNames) {
		const sourceAbsPath = safePath(path.join(sourcePath || "", name));
		const targetAbsPath = safePath(path.join(targetPath || "", name));

		if (!(await pathExists(sourceAbsPath))) {
			throw new Error(`"${name}" does not exist`);
		}

		const sourceStat = await fs.lstat(sourceAbsPath);
		const nodeKind = getNodeKindFromStats(sourceStat);

		if (nodeKind === "directory" && isSubPath(sourceAbsPath, targetAbsPath)) {
			throw new Error(`Cannot ${operation} "${name}" into its own subdirectory`);
		}

		const targetExists = await pathExists(targetAbsPath);
		if (targetExists && !overwriteNameSet.has(name)) {
			throw new Error(`"${name}" already exists in target directory`);
		}

		const subtreeSize = await countTransferUnits(sourceAbsPath, nodeKind);
		totalItems += subtreeSize;

		preparedItems.push({
			name,
			sourceAbsPath,
			targetAbsPath,
			nodeKind,
			targetExists,
			subtreeSize,
		});
	}

	let processedItems = 0;
	const markProgress: MarkProgress = async (currentItem, increment = 1) => {
		processedItems = Math.min(totalItems, processedItems + Math.max(1, increment));
		if (onProgress) {
			await onProgress({
				processedItems,
				totalItems,
				currentItem,
			});
		}
	};

	if (onProgress) {
		await onProgress({
			processedItems: 0,
			totalItems,
			currentItem: null,
		});
	}

	for (const item of preparedItems) {
		await ensureTaskNotCancelled(shouldCancel);

		if (item.targetExists) {
			await transferWithOverwrite({
				operation,
				sourceAbsPath: item.sourceAbsPath,
				targetAbsPath: item.targetAbsPath,
				nodeKind: item.nodeKind,
				name: item.name,
				relativePath: item.name,
				subtreeSize: item.subtreeSize,
				markProgress,
				shouldCancel,
			});
		} else {
			await transferNodeWithProgress({
				operation,
				sourceAbsPath: item.sourceAbsPath,
				targetAbsPath: item.targetAbsPath,
				nodeKind: item.nodeKind,
				relativePath: item.name,
				subtreeSize: item.subtreeSize,
				markProgress,
				shouldCancel,
			});
		}
	}

	if (onProgress) {
		await onProgress({
			processedItems,
			totalItems,
			currentItem: null,
		});
	}
}
