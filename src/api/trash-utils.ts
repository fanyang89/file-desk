import fs from "fs/promises";
import path from "path";
import { safePath } from "./fs-utils";

export const TRASH_ROOT_RELATIVE_PATH = ".file-desk-trash";
export const TRASH_FILES_RELATIVE_PATH = `${TRASH_ROOT_RELATIVE_PATH}/files`;
const TRASH_META_RELATIVE_PATH = `${TRASH_ROOT_RELATIVE_PATH}/meta`;

interface TrashMetadata {
	originalPath: string;
	deletedAt: string;
}

function normalizeRelativePath(value: string): string {
	return value
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/+/g, "/")
		.replace(/\/+$/, "");
}

function splitNameAndExtension(name: string): { baseName: string; extension: string } {
	const dotIndex = name.lastIndexOf(".");
	if (dotIndex <= 0) {
		return { baseName: name, extension: "" };
	}

	return {
		baseName: name.slice(0, dotIndex),
		extension: name.slice(dotIndex),
	};
}

async function pathExists(relativePath: string): Promise<boolean> {
	try {
		await fs.access(safePath(relativePath));
		return true;
	} catch {
		return false;
	}
}

function getMetadataPathForTrashPath(trashPath: string): string {
	const encodedPath = Buffer.from(trashPath, "utf8").toString("base64url");
	return `${TRASH_META_RELATIVE_PATH}/${encodedPath}.json`;
}

export async function ensureTrashDirectories(): Promise<void> {
	await fs.mkdir(safePath(TRASH_FILES_RELATIVE_PATH), { recursive: true });
	await fs.mkdir(safePath(TRASH_META_RELATIVE_PATH), { recursive: true });
}

export function isPathInsideTrash(relativePath: string): boolean {
	const normalizedPath = normalizeRelativePath(relativePath);
	return (
		normalizedPath === TRASH_ROOT_RELATIVE_PATH ||
		normalizedPath.startsWith(`${TRASH_ROOT_RELATIVE_PATH}/`)
	);
}

export function isPathInsideTrashFiles(relativePath: string): boolean {
	const normalizedPath = normalizeRelativePath(relativePath);
	return (
		normalizedPath === TRASH_FILES_RELATIVE_PATH ||
		normalizedPath.startsWith(`${TRASH_FILES_RELATIVE_PATH}/`)
	);
}

export async function createAvailableTrashPath(entryName: string): Promise<string> {
	await ensureTrashDirectories();

	const { baseName, extension } = splitNameAndExtension(entryName);
	let attempt = 0;

	while (true) {
		const candidateName =
			attempt === 0
				? `${baseName}${extension}`
				: `${baseName} (${attempt})${extension}`;
		const candidatePath = `${TRASH_FILES_RELATIVE_PATH}/${candidateName}`;
		if (!(await pathExists(candidatePath))) {
			return candidatePath;
		}
		attempt += 1;
	}
}

export async function writeTrashMetadata(
	trashPath: string,
	originalPath: string,
): Promise<void> {
	const normalizedTrashPath = normalizeRelativePath(trashPath);
	const normalizedOriginalPath = normalizeRelativePath(originalPath);
	const metadataPath = getMetadataPathForTrashPath(normalizedTrashPath);
	const metadata: TrashMetadata = {
		originalPath: normalizedOriginalPath,
		deletedAt: new Date().toISOString(),
	};

	await fs.writeFile(safePath(metadataPath), JSON.stringify(metadata), "utf8");
}

export async function readTrashMetadata(
	trashPath: string,
): Promise<TrashMetadata | null> {
	const normalizedTrashPath = normalizeRelativePath(trashPath);
	const metadataPath = getMetadataPathForTrashPath(normalizedTrashPath);

	try {
		const content = await fs.readFile(safePath(metadataPath), "utf8");
		const parsed = JSON.parse(content) as Partial<TrashMetadata>;
		if (
			typeof parsed.originalPath !== "string" ||
			typeof parsed.deletedAt !== "string"
		) {
			return null;
		}

		return {
			originalPath: normalizeRelativePath(parsed.originalPath),
			deletedAt: parsed.deletedAt,
		};
	} catch {
		return null;
	}
}

export async function removeTrashMetadata(trashPath: string): Promise<void> {
	const normalizedTrashPath = normalizeRelativePath(trashPath);
	const metadataPath = getMetadataPathForTrashPath(normalizedTrashPath);

	try {
		await fs.unlink(safePath(metadataPath));
	} catch {
		// Ignore missing metadata files.
	}
}

export async function emptyTrash(): Promise<void> {
	await fs.rm(safePath(TRASH_FILES_RELATIVE_PATH), {
		recursive: true,
		force: true,
	});
	await fs.rm(safePath(TRASH_META_RELATIVE_PATH), {
		recursive: true,
		force: true,
	});
	await ensureTrashDirectories();
}

export function joinRelativePath(basePath: string, name: string): string {
	const normalizedBase = normalizeRelativePath(basePath);
	const normalizedName = normalizeRelativePath(name);
	if (!normalizedBase) return normalizedName;
	return path.posix.join(normalizedBase, normalizedName);
}
