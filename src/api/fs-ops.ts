import { constants as fsConstants } from "fs";
import fs from "fs/promises";
import path from "path";
import { safePath } from "./fs-utils";

export type CopyMoveOperation = "copy" | "move";

export interface CopyMoveProgress {
	processedItems: number;
	totalItems: number;
	currentItem: string | null;
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

async function copyNode(
	sourceAbsPath: string,
	targetAbsPath: string,
	isDirectory: boolean,
): Promise<void> {
	if (isDirectory) {
		await fs.cp(sourceAbsPath, targetAbsPath, {
			recursive: true,
			errorOnExist: true,
			force: false,
			dereference: false,
		});
		return;
	}

	await fs.copyFile(sourceAbsPath, targetAbsPath, fsConstants.COPYFILE_EXCL);
}

async function moveNode(
	sourceAbsPath: string,
	targetAbsPath: string,
	isDirectory: boolean,
): Promise<void> {
	try {
		await fs.rename(sourceAbsPath, targetAbsPath);
		return;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "EXDEV") {
			throw err;
		}
	}

	await copyNode(sourceAbsPath, targetAbsPath, isDirectory);
	try {
		if (isDirectory) {
			await fs.rm(sourceAbsPath, { recursive: true, force: false });
		} else {
			await fs.unlink(sourceAbsPath);
		}
	} catch (err) {
		throw new MoveSourceCleanupError(
			`Failed to clean up source after move: ${(err as Error).message}`,
		);
	}
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
	isDirectory,
	name,
}: {
	operation: CopyMoveOperation;
	sourceAbsPath: string;
	targetAbsPath: string;
	isDirectory: boolean;
	name: string;
}): Promise<void> {
	const backupAbsPath = await createBackupPath(targetAbsPath);
	await fs.rename(targetAbsPath, backupAbsPath);

	try {
		if (operation === "copy") {
			await copyNode(sourceAbsPath, targetAbsPath, isDirectory);
		} else {
			await moveNode(sourceAbsPath, targetAbsPath, isDirectory);
		}
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

	if (onProgress) {
		await onProgress({
			processedItems: 0,
			totalItems: uniqueNames.length,
			currentItem: null,
		});
	}

	for (let i = 0; i < uniqueNames.length; i += 1) {
		if (shouldCancel && (await shouldCancel())) {
			throw new TaskCancelledError();
		}

		const name = uniqueNames[i];
		const sourceAbsPath = safePath(path.join(sourcePath || "", name));
		const targetAbsPath = safePath(path.join(targetPath || "", name));

		if (!(await pathExists(sourceAbsPath))) {
			throw new Error(`"${name}" does not exist`);
		}

		const sourceStat = await fs.lstat(sourceAbsPath);
		if (sourceStat.isSymbolicLink()) {
			throw new Error(`Symbolic links are not supported: "${name}"`);
		}

		if (sourceStat.isDirectory() && isSubPath(sourceAbsPath, targetAbsPath)) {
			throw new Error(`Cannot ${operation} "${name}" into its own subdirectory`);
		}

		const targetExists = await pathExists(targetAbsPath);
		if (targetExists && !overwriteNameSet.has(name)) {
			throw new Error(`"${name}" already exists in target directory`);
		}

		if (targetExists) {
			await transferWithOverwrite({
				operation,
				sourceAbsPath,
				targetAbsPath,
				isDirectory: sourceStat.isDirectory(),
				name,
			});
		} else if (operation === "copy") {
			await copyNode(sourceAbsPath, targetAbsPath, sourceStat.isDirectory());
		} else {
			await moveNode(sourceAbsPath, targetAbsPath, sourceStat.isDirectory());
		}

		if (onProgress) {
			await onProgress({
				processedItems: i + 1,
				totalItems: uniqueNames.length,
				currentItem: name,
			});
		}
	}
}
