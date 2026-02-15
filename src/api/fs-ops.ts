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
	onProgress?: (progress: CopyMoveProgress) => Promise<void> | void;
	shouldCancel?: () => Promise<boolean> | boolean;
}

export class TaskCancelledError extends Error {
	constructor() {
		super("Task cancelled");
		this.name = "TaskCancelledError";
	}
}

function assertValidName(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) {
		throw new Error("Name is required");
	}
	if (trimmed === "." || trimmed === "..") {
		throw new Error(`Invalid name: "${name}"`);
	}
	if (trimmed.includes("/") || trimmed.includes("\\")) {
		throw new Error(`Invalid name: "${name}"`);
	}
	return trimmed;
}

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
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
	if (isDirectory) {
		await fs.rm(sourceAbsPath, { recursive: true, force: false });
	} else {
		await fs.unlink(sourceAbsPath);
	}
}

export async function runCopyMoveTask({
	operation,
	sourcePath,
	targetPath,
	names,
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

		if (await pathExists(targetAbsPath)) {
			throw new Error(`"${name}" already exists in target directory`);
		}

		const sourceStat = await fs.lstat(sourceAbsPath);
		if (sourceStat.isSymbolicLink()) {
			throw new Error(`Symbolic links are not supported: "${name}"`);
		}

		if (sourceStat.isDirectory() && isSubPath(sourceAbsPath, targetAbsPath)) {
			throw new Error(`Cannot ${operation} "${name}" into its own subdirectory`);
		}

		if (operation === "copy") {
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
