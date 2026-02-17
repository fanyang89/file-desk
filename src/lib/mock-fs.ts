import type {
	BackgroundTask,
	FileEntry,
	TaskOperation,
	TaskStatus,
} from "@/types";

interface MockDir {
	kind: "dir";
	name: string;
	createdAt: string;
	modifiedAt: string;
	children: Map<string, MockNode>;
}

interface MockFile {
	kind: "file";
	name: string;
	createdAt: string;
	modifiedAt: string;
	content: string;
	extension: string;
	mimeType: string;
}

type MockNode = MockDir | MockFile;

const TEXT_EXTENSIONS = new Set([
	"txt",
	"md",
	"json",
	"js",
	"ts",
	"tsx",
	"jsx",
	"css",
	"html",
	"xml",
	"yaml",
	"yml",
	"toml",
	"sh",
	"py",
	"rb",
	"go",
	"rs",
	"java",
	"c",
	"cpp",
	"h",
	"log",
	"sql",
	"graphql",
]);

const IMAGE_EXTENSIONS = new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"svg",
	"webp",
	"bmp",
]);

const root = createDir("");

const TRASH_ROOT_NAME = ".file-desk-trash";
const TRASH_FILES_PATH = `${TRASH_ROOT_NAME}/files`;
const TRASH_META_PATH = `${TRASH_ROOT_NAME}/meta`;

interface MockTrashMetadata {
	originalPath: string;
	deletedAt: string;
}

const mockTrashMetadataByPath = new Map<string, MockTrashMetadata>();

function nowIso(): string {
	return new Date().toISOString();
}

function createDir(name: string): MockDir {
	const timestamp = nowIso();
	return {
		kind: "dir",
		name,
		createdAt: timestamp,
		modifiedAt: timestamp,
		children: new Map(),
	};
}

function getExtension(filename: string): string {
	const dotIndex = filename.lastIndexOf(".");
	if (dotIndex <= 0) return "";
	return filename.slice(dotIndex + 1).toLowerCase();
}

function inferMimeType(filename: string, fallback = "text/plain"): string {
	const extension = getExtension(filename);
	switch (extension) {
		case "svg":
			return "image/svg+xml";
		case "md":
		case "txt":
			return "text/plain";
		case "json":
			return "application/json";
		case "ts":
		case "tsx":
		case "js":
		case "jsx":
		case "css":
		case "html":
			return "text/plain";
		default:
			return fallback;
	}
}

function createFile(
	name: string,
	content: string,
	mimeType?: string,
): MockFile {
	const timestamp = nowIso();
	return {
		kind: "file",
		name,
		createdAt: timestamp,
		modifiedAt: timestamp,
		content,
		extension: getExtension(name),
		mimeType: mimeType || inferMimeType(name),
	};
}

function normalizePath(path: string): string {
	return path.replace(/\\/g, "/").split("/").filter(Boolean).join("/");
}

function joinPath(parentPath: string, name: string): string {
	return parentPath ? `${parentPath}/${name}` : name;
}

function splitPath(path: string): string[] {
	const normalized = normalizePath(path);
	return normalized ? normalized.split("/") : [];
}

function isPathInsideTrash(filePath: string): boolean {
	const normalizedPath = normalizePath(filePath);
	return (
		normalizedPath === TRASH_ROOT_NAME ||
		normalizedPath.startsWith(`${TRASH_ROOT_NAME}/`)
	);
}

function isPathInsideTrashFiles(filePath: string): boolean {
	const normalizedPath = normalizePath(filePath);
	return (
		normalizedPath === TRASH_FILES_PATH ||
		normalizedPath.startsWith(`${TRASH_FILES_PATH}/`)
	);
}

function getNode(path: string): MockNode | null {
	const segments = splitPath(path);
	let current: MockNode = root;
	for (const segment of segments) {
		if (current.kind !== "dir") return null;
		const nextNode = current.children.get(segment);
		if (!nextNode) return null;
		current = nextNode;
	}
	return current;
}

function getDir(path: string): MockDir | null {
	const node = getNode(path);
	return node?.kind === "dir" ? node : null;
}

function getOrCreateDirByPath(dirPath: string): MockDir {
	const segments = splitPath(dirPath);
	let currentDir = root;

	for (const segment of segments) {
		const nextNode = currentDir.children.get(segment);
		if (!nextNode) {
			const nextDir = createDir(segment);
			currentDir.children.set(segment, nextDir);
			currentDir = nextDir;
			continue;
		}

		if (nextNode.kind !== "dir") {
			throw new Error(`Path is not a directory: /${dirPath}`);
		}

		currentDir = nextNode;
	}

	return currentDir;
}

function ensureMockTrashDirs(): void {
	getOrCreateDirByPath(TRASH_FILES_PATH);
	getOrCreateDirByPath(TRASH_META_PATH);
}

function touchDir(path: string): void {
	const dir = getDir(path);
	if (dir) dir.modifiedAt = nowIso();
}

function assertValidName(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) throw new Error("Name is required");
	if (trimmed.includes("/")) throw new Error('Name cannot contain "/"');
	return trimmed;
}

function assertValidTransferName(name: string): string {
	if (!name) throw new Error("Name is required");
	if (name === "." || name === "..") throw new Error(`Invalid name: "${name}"`);
	if (name.includes("/") || name.includes("\\")) {
		throw new Error(`Invalid name: "${name}"`);
	}
	return name;
}

function splitNameAndExtension(name: string): {
	baseName: string;
	extension: string;
} {
	const dotIndex = name.lastIndexOf(".");
	if (dotIndex <= 0) {
		return { baseName: name, extension: "" };
	}

	return {
		baseName: name.slice(0, dotIndex),
		extension: name.slice(dotIndex),
	};
}

function createUniqueChildName(parentDir: MockDir, entryName: string): string {
	const { baseName, extension } = splitNameAndExtension(entryName);
	let attempt = 0;

	while (true) {
		const candidateName =
			attempt === 0
				? `${baseName}${extension}`
				: `${baseName} (${attempt})${extension}`;
		if (!parentDir.children.has(candidateName)) {
			return candidateName;
		}
		attempt += 1;
	}
}

function getParentPath(filePath: string): string {
	const segments = splitPath(filePath);
	if (segments.length <= 1) return "";
	return segments.slice(0, -1).join("/");
}

function isTextFile(file: MockFile): boolean {
	if (file.mimeType.startsWith("text/")) return true;
	if (file.mimeType === "application/json") return true;
	return TEXT_EXTENSIONS.has(file.extension);
}

function makeDataUrl(content: string, mimeType: string): string {
	return `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
}

function isImageExtension(extension: string): boolean {
	return IMAGE_EXTENSIONS.has(extension.toLowerCase());
}

function isSubPath(parentPath: string, candidatePath: string): boolean {
	if (!parentPath) return false;
	if (parentPath === candidatePath) return false;
	return candidatePath.startsWith(`${parentPath}/`);
}

function cloneNode(node: MockNode): MockNode {
	if (node.kind === "file") {
		return {
			kind: "file",
			name: node.name,
			createdAt: node.createdAt,
			modifiedAt: nowIso(),
			content: node.content,
			extension: node.extension,
			mimeType: node.mimeType,
		};
	}

	const clonedChildren = new Map<string, MockNode>();
	for (const [childName, childNode] of node.children) {
		clonedChildren.set(childName, cloneNode(childNode));
	}

	return {
		kind: "dir",
		name: node.name,
		createdAt: node.createdAt,
		modifiedAt: nowIso(),
		children: clonedChildren,
	};
}

function toEntry(parentPath: string, node: MockNode): FileEntry {
	const fullPath = joinPath(parentPath, node.name);
	if (node.kind === "dir") {
		return {
			name: node.name,
			path: fullPath,
			isDirectory: true,
			size: 0,
			modifiedAt: node.modifiedAt,
			createdAt: node.createdAt,
			extension: "",
		};
	}

	return {
		name: node.name,
		path: fullPath,
		isDirectory: false,
		size: new Blob([node.content]).size,
		modifiedAt: node.modifiedAt,
		createdAt: node.createdAt,
		extension: node.extension,
	};
}

function seedMockData() {
	const documents = createDir("Documents");
	const projects = createDir("Projects");
	const images = createDir("Images");
	const notes = createDir("Notes");

	documents.children.set(
		"README.md",
		createFile(
			"README.md",
			`# File Desk (Mock)\n\nThis preview is running with a browser mock API.\n`,
		),
	);
	documents.children.set(
		"todo.txt",
		createFile(
			"todo.txt",
			`- review PR preview\n- verify upload flow\n- test pane sorting\n`,
		),
	);
	notes.children.set(
		"meeting-2026-02-08.md",
		createFile(
			"meeting-2026-02-08.md",
			`## Notes\n\n- Added path bar mock fallback\n- Verified in Vercel preview\n`,
		),
	);

	const projectDir = createDir("file-desk");
	projectDir.children.set(
		"package.json",
		createFile(
			"package.json",
			`{\n  "name": "file-desk",\n  "private": true\n}\n`,
			"application/json",
		),
	);
	projectDir.children.set(
		"main.tsx",
		createFile(
			"main.tsx",
			`import { createRoot } from 'react-dom/client'\n\nconsole.log('mock preview')\n`,
		),
	);
	projects.children.set("file-desk", projectDir);

	images.children.set(
		"logo.svg",
		createFile(
			"logo.svg",
			`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="120" viewBox="0 0 220 120"><rect width="220" height="120" rx="16" fill="#0f172a"/><text x="110" y="68" fill="#f8fafc" text-anchor="middle" font-family="monospace" font-size="20">Mock API</text></svg>`,
			"image/svg+xml",
		),
	);

	root.children.set(documents.name, documents);
	root.children.set(projects.name, projects);
	root.children.set(images.name, images);
	root.children.set(notes.name, notes);
	ensureMockTrashDirs();
}

seedMockData();

interface MockListFilesOptions {
	recursive?: boolean;
	imagesOnly?: boolean;
	includeHidden?: boolean;
}

export interface MockUploadFileItem {
	file: File;
	relativePath?: string;
}

export type MockUploadConflictStrategy = "cancel" | "overwrite" | "auto-rename";

function collectListEntries(
	dir: MockDir,
	parentPath: string,
	options: MockListFilesOptions,
	files: FileEntry[],
): void {
	for (const node of dir.children.values()) {
		if (!options.includeHidden && node.name.startsWith(".")) continue;

		if (node.kind === "dir") {
			if (!options.imagesOnly) {
				files.push(toEntry(parentPath, node));
			}
			if (options.recursive) {
				collectListEntries(
					node,
					joinPath(parentPath, node.name),
					options,
					files,
				);
			}
			continue;
		}

		if (options.imagesOnly && !isImageExtension(node.extension)) {
			continue;
		}

		files.push(toEntry(parentPath, node));
	}
}

export function mockListFiles(
	path: string,
	options: MockListFilesOptions = {},
): { files: FileEntry[]; currentPath: string; caseSensitiveNames: boolean } {
	const normalizedPath = normalizePath(path);
	const dir = getDir(normalizedPath);
	if (!dir) throw new Error(`Directory not found: /${normalizedPath}`);
	const includeHidden = isPathInsideTrashFiles(normalizedPath);

	const files: FileEntry[] = [];
	collectListEntries(dir, normalizedPath, { ...options, includeHidden }, files);
	return { files, currentPath: normalizedPath, caseSensitiveNames: true };
}

export function mockCreateFolder(
	path: string,
	name: string,
): { success: boolean } {
	const normalizedPath = normalizePath(path);
	const dir = getDir(normalizedPath);
	if (!dir) throw new Error(`Directory not found: /${normalizedPath}`);

	const nextName = assertValidName(name);
	if (dir.children.has(nextName)) {
		throw new Error(`"${nextName}" already exists`);
	}

	dir.children.set(nextName, createDir(nextName));
	touchDir(normalizedPath);
	return { success: true };
}

export function mockRenameEntry(
	path: string,
	oldName: string,
	newName: string,
): { success: boolean } {
	const normalizedPath = normalizePath(path);
	const dir = getDir(normalizedPath);
	if (!dir) throw new Error(`Directory not found: /${normalizedPath}`);

	const fromName = assertValidName(oldName);
	const toName = assertValidName(newName);
	if (fromName === toName) return { success: true };
	if (dir.children.has(toName)) throw new Error(`"${toName}" already exists`);

	const node = dir.children.get(fromName);
	if (!node) throw new Error(`"${fromName}" does not exist`);

	dir.children.delete(fromName);
	node.name = toName;
	node.modifiedAt = nowIso();
	dir.children.set(toName, node);
	touchDir(normalizedPath);
	return { success: true };
}

export function mockDeleteEntry(
	path: string,
	name: string,
): { success: boolean } {
	const normalizedPath = normalizePath(path);
	const dir = getDir(normalizedPath);
	if (!dir) throw new Error(`Directory not found: /${normalizedPath}`);

	const targetName = assertValidName(name);
	const targetNode = dir.children.get(targetName);
	if (!targetNode)
		throw new Error(`"${targetName}" does not exist`);
	const targetPath = joinPath(normalizedPath, targetName);

	if (isPathInsideTrash(targetPath)) {
		dir.children.delete(targetName);
		for (const metadataPath of Array.from(mockTrashMetadataByPath.keys())) {
			if (
				metadataPath === targetPath ||
				metadataPath.startsWith(`${targetPath}/`)
			) {
				mockTrashMetadataByPath.delete(metadataPath);
			}
		}
		touchDir(normalizedPath);
		return { success: true };
	}

	ensureMockTrashDirs();
	const trashDir = getDir(TRASH_FILES_PATH);
	if (!trashDir) {
		throw new Error("Trash directory is unavailable");
	}

	const trashName = createUniqueChildName(trashDir, targetName);
	dir.children.delete(targetName);
	targetNode.name = trashName;
	targetNode.modifiedAt = nowIso();
	trashDir.children.set(trashName, targetNode);

	const trashPath = joinPath(TRASH_FILES_PATH, trashName);
	mockTrashMetadataByPath.set(trashPath, {
		originalPath: targetPath,
		deletedAt: nowIso(),
	});

	touchDir(normalizedPath);
	touchDir(TRASH_FILES_PATH);
	return { success: true };
}

export function mockRestoreTrashEntry(
	trashPath: string,
): { success: boolean; restoredPath: string } {
	const normalizedTrashPath = normalizePath(trashPath);
	if (!isPathInsideTrashFiles(normalizedTrashPath)) {
		throw new Error("trashPath must be inside trash files");
	}

	const metadata = mockTrashMetadataByPath.get(normalizedTrashPath);
	if (!metadata) {
		throw new Error("Trash metadata not found");
	}

	const trashParentPath = getParentPath(normalizedTrashPath);
	const trashParentDir = getDir(trashParentPath);
	if (!trashParentDir) {
		throw new Error("Trash item no longer exists");
	}

	const trashName = splitPath(normalizedTrashPath).pop() || "";
	const node = trashParentDir.children.get(trashName);
	if (!node) {
		throw new Error("Trash item no longer exists");
	}

	const originalPath = normalizePath(metadata.originalPath);
	const destinationParentPath = getParentPath(originalPath);
	const destinationName = splitPath(originalPath).pop() || "";
	if (!destinationName) {
		throw new Error("Invalid trash metadata");
	}

	const destinationDir = getOrCreateDirByPath(destinationParentPath);
	if (destinationDir.children.has(destinationName)) {
		throw new Error(`"${destinationName}" already exists`);
	}

	trashParentDir.children.delete(trashName);
	node.name = destinationName;
	node.modifiedAt = nowIso();
	destinationDir.children.set(destinationName, node);
	mockTrashMetadataByPath.delete(normalizedTrashPath);

	touchDir(trashParentPath);
	touchDir(destinationParentPath);

	return { success: true, restoredPath: originalPath };
}

export function mockEmptyTrash(): { success: boolean } {
	ensureMockTrashDirs();
	const trashFilesDir = getDir(TRASH_FILES_PATH);
	if (!trashFilesDir) {
		throw new Error("Trash directory is unavailable");
	}

	trashFilesDir.children.clear();
	trashFilesDir.modifiedAt = nowIso();
	mockTrashMetadataByPath.clear();
	return { success: true };
}

function collectMockDeleteImpact(node: MockNode): {
	fileCount: number;
	directoryCount: number;
	totalBytes: number;
} {
	if (node.kind === "file") {
		return {
			fileCount: 1,
			directoryCount: 0,
			totalBytes: node.content.length,
		};
	}

	let fileCount = 0;
	let directoryCount = 1;
	let totalBytes = 0;

	for (const childNode of node.children.values()) {
		const childImpact = collectMockDeleteImpact(childNode);
		fileCount += childImpact.fileCount;
		directoryCount += childImpact.directoryCount;
		totalBytes += childImpact.totalBytes;
	}

	return {
		fileCount,
		directoryCount,
		totalBytes,
	};
}

export function mockGetDeleteImpact(path: string, name: string): {
	targetName: string;
	isDirectory: boolean;
	fileCount: number;
	directoryCount: number;
	totalItems: number;
	totalBytes: number;
} {
	const normalizedPath = normalizePath(path);
	const dir = getDir(normalizedPath);
	if (!dir) throw new Error(`Directory not found: /${normalizedPath}`);

	const targetName = assertValidName(name);
	const node = dir.children.get(targetName);
	if (!node) throw new Error(`"${targetName}" does not exist`);

	const impact = collectMockDeleteImpact(node);
	return {
		targetName,
		isDirectory: node.kind === "dir",
		fileCount: impact.fileCount,
		directoryCount: impact.directoryCount,
		totalItems: impact.fileCount + impact.directoryCount,
		totalBytes: impact.totalBytes,
	};
}

function transferMockEntries(
	operation: TaskOperation,
	sourcePath: string,
	targetPath: string,
	names: string[],
	overwriteNames: string[] = [],
): void {
	const normalizedSourcePath = normalizePath(sourcePath);
	const normalizedTargetPath = normalizePath(targetPath);

	if (normalizedSourcePath === normalizedTargetPath) {
		throw new Error("Source and target directories cannot be the same");
	}

	const sourceDir = getDir(normalizedSourcePath);
	if (!sourceDir) {
		throw new Error(`Directory not found: /${normalizedSourcePath}`);
	}

	const targetDir = getDir(normalizedTargetPath);
	if (!targetDir) {
		throw new Error(`Directory not found: /${normalizedTargetPath}`);
	}

	const uniqueNames = Array.from(new Set(names.map(assertValidTransferName)));
	const overwriteNameSet = new Set(
		overwriteNames.map(assertValidTransferName),
	);
	if (uniqueNames.length === 0) {
		throw new Error("No files selected");
	}

	for (const name of uniqueNames) {
		const sourceNode = sourceDir.children.get(name);
		if (!sourceNode) {
			throw new Error(`"${name}" does not exist`);
		}

		if (targetDir.children.has(name) && !overwriteNameSet.has(name)) {
			throw new Error(`"${name}" already exists in target directory`);
		}

		if (sourceNode.kind === "dir") {
			const sourceNodePath = joinPath(normalizedSourcePath, name);
			if (isSubPath(sourceNodePath, normalizedTargetPath)) {
				throw new Error(`Cannot ${operation} "${name}" into its own subdirectory`);
			}
		}

		if (operation === "copy") {
			targetDir.children.set(name, cloneNode(sourceNode));
			continue;
		}

		sourceDir.children.delete(name);
		sourceNode.modifiedAt = nowIso();
		targetDir.children.set(name, sourceNode);
	}

	touchDir(normalizedSourcePath);
	touchDir(normalizedTargetPath);
}

export function mockCopyEntries(
	sourcePath: string,
	targetPath: string,
	names: string[],
	overwriteNames: string[] = [],
): { success: boolean } {
	transferMockEntries("copy", sourcePath, targetPath, names, overwriteNames);
	return { success: true };
}

export function mockMoveEntries(
	sourcePath: string,
	targetPath: string,
	names: string[],
	overwriteNames: string[] = [],
): { success: boolean } {
	transferMockEntries("move", sourcePath, targetPath, names, overwriteNames);
	return { success: true };
}

function assertValidPathSegment(segment: string): string {
	if (!segment) throw new Error("Invalid upload path");
	if (segment === "." || segment === "..") {
		throw new Error(`Invalid upload path segment: "${segment}"`);
	}
	if (segment.includes("/") || segment.includes("\\")) {
		throw new Error(`Invalid upload path segment: "${segment}"`);
	}
	return segment;
}

function normalizeUploadRelativePath(relativePath: string, fallbackName: string): string {
	const raw = (relativePath || fallbackName).replace(/\\/g, "/");
	const segments = raw
		.split("/")
		.filter(Boolean)
		.map((segment) => assertValidPathSegment(segment));

	if (segments.length === 0) {
		segments.push(assertValidPathSegment(assertValidName(fallbackName)));
	}

	return segments.join("/");
}

function splitBaseNameAndExtension(fileName: string): {
	baseName: string;
	extension: string;
} {
	const dotIndex = fileName.lastIndexOf(".");
	if (dotIndex <= 0) {
		return { baseName: fileName, extension: "" };
	}

	return {
		baseName: fileName.slice(0, dotIndex),
		extension: fileName.slice(dotIndex),
	};
}

function buildAutoRenameName(fileName: string, index: number): string {
	const { baseName, extension } = splitBaseNameAndExtension(fileName);
	return `${baseName}_${index}${extension}`;
}

function resolveAutoRenameName(currentDir: MockDir, fileName: string): string {
	let attempt = 0;
	let candidate = fileName;

	while (currentDir.children.has(candidate)) {
		attempt += 1;
		candidate = buildAutoRenameName(fileName, attempt);
	}

	return candidate;
}

function getUploadTargetNode(
	targetDir: MockDir,
	normalizedPath: string,
	relativePath: string,
): MockNode | null {
	const segments = splitPath(relativePath);
	if (segments.length === 0) return null;

	let currentDir = targetDir;
	let currentPath = normalizedPath;

	for (const segment of segments.slice(0, -1)) {
		const child = currentDir.children.get(segment);
		if (!child) {
			return null;
		}
		if (child.kind !== "dir") {
			throw new Error(`Cannot create folder "${segment}" in /${currentPath}`);
		}
		currentDir = child;
		currentPath = joinPath(currentPath, segment);
	}

	return currentDir.children.get(segments[segments.length - 1]) || null;
}

export function mockGetUploadConflicts(
	path: string,
	relativePaths: string[],
): { conflicts: string[] } {
	const normalizedPath = normalizePath(path);
	const targetDir = getDir(normalizedPath);
	if (!targetDir) throw new Error(`Directory not found: /${normalizedPath}`);

	const conflictSet = new Set<string>();
	const plannedPaths = new Set<string>();

	for (const filePath of relativePaths) {
		const normalizedRelativePath = normalizeUploadRelativePath(filePath, filePath);
		if (plannedPaths.has(normalizedRelativePath)) {
			conflictSet.add(normalizedRelativePath);
			continue;
		}
		plannedPaths.add(normalizedRelativePath);

		const targetNode = getUploadTargetNode(
			targetDir,
			normalizedPath,
			normalizedRelativePath,
		);
		if (targetNode) {
			conflictSet.add(normalizedRelativePath);
		}
	}

	return { conflicts: Array.from(conflictSet) };
}

function getOrCreateDirectory(
	parent: MockDir,
	segment: string,
	currentPath: string,
): MockDir {
	const existing = parent.children.get(segment);
	if (!existing) {
		const nextDir = createDir(segment);
		parent.children.set(segment, nextDir);
		parent.modifiedAt = nowIso();
		return nextDir;
	}

	if (existing.kind !== "dir") {
		throw new Error(`Cannot create folder "${segment}" in /${currentPath}`);
	}

	return existing;
}

export async function mockUploadFileItems(
	path: string,
	items: MockUploadFileItem[],
	strategy: MockUploadConflictStrategy = "cancel",
): Promise<{ success: boolean; files: string[] }> {
	const normalizedPath = normalizePath(path);
	const targetDir = getDir(normalizedPath);
	if (!targetDir) throw new Error(`Directory not found: /${normalizedPath}`);

	if (strategy === "cancel") {
		const { conflicts } = mockGetUploadConflicts(
			normalizedPath,
			items.map((item) => item.relativePath || item.file.name),
		);
		if (conflicts.length > 0) {
			const conflictList = conflicts.join(", ");
			throw new Error(`Upload conflicts detected: ${conflictList}`);
		}
	}

	const uploaded: string[] = [];
	for (const item of items) {
		const relativePath = normalizeUploadRelativePath(
			item.relativePath || item.file.name,
			item.file.name,
		);
		const segments = splitPath(relativePath);
		const fileName = segments[segments.length - 1];
		let currentDir = targetDir;
		let currentPath = normalizedPath;

		for (const segment of segments.slice(0, -1)) {
			currentDir = getOrCreateDirectory(currentDir, segment, currentPath);
			currentPath = joinPath(currentPath, segment);
		}

		let content = "";
		try {
			content = await item.file.text();
		} catch {
			content = `[binary file: ${fileName}]`;
		}

		const mimeType =
			item.file.type || inferMimeType(fileName, "application/octet-stream");
		const existingNode = currentDir.children.get(fileName);

		let targetFileName = fileName;
		if (existingNode && strategy === "auto-rename") {
			targetFileName = resolveAutoRenameName(currentDir, fileName);
		}

		const targetNode = currentDir.children.get(targetFileName);
		if (targetNode?.kind === "dir") {
			if (strategy === "overwrite") {
				throw new Error(`Cannot overwrite folder "${targetFileName}"`);
			}

			targetFileName = resolveAutoRenameName(currentDir, targetFileName);
		}

		const finalNode = currentDir.children.get(targetFileName);
		if (finalNode?.kind === "file") {
			finalNode.content = content;
			finalNode.mimeType = mimeType;
			finalNode.extension = getExtension(targetFileName);
			finalNode.modifiedAt = nowIso();
		} else {
			currentDir.children.set(
				targetFileName,
				createFile(targetFileName, content, mimeType),
			);
		}

		currentDir.modifiedAt = nowIso();
		uploaded.push(joinPath(currentPath, targetFileName));
	}

	touchDir(normalizedPath);
	return { success: true, files: uploaded };
}

export async function mockUploadFiles(
	path: string,
	files: FileList,
	strategy: MockUploadConflictStrategy = "cancel",
): Promise<{ success: boolean; files: string[] }> {
	return mockUploadFileItems(
		path,
		Array.from(files).map((file) => ({ file, relativePath: file.name })),
		strategy,
	);
}

interface MockTaskRecord {
	id: string;
	operation: TaskOperation;
	sourcePath: string;
	targetPath: string;
	names: string[];
	overwriteNames: string[];
	status: TaskStatus;
	processedItems: number;
	totalItems: number;
	currentItem: string | null;
	error: string | null;
	cancelRequested: boolean;
	createdAt: string;
	startedAt: string | null;
	finishedAt: string | null;
	updatedAt: string;
}

const mockTasks = new Map<string, MockTaskRecord>();
const mockTaskQueue: string[] = [];
let mockTaskWorkerRunning = false;

function createMockTaskId(): string {
	return `mock-task-${Math.random().toString(36).slice(2, 10)}`;
}

function now(): string {
	return new Date().toISOString();
}

function toBackgroundTask(task: MockTaskRecord): BackgroundTask {
	return {
		id: task.id,
		type: "copy_move",
		operation: task.operation,
		sourcePath: task.sourcePath,
		targetPath: task.targetPath,
		names: [...task.names],
		status: task.status,
		processedItems: task.processedItems,
		totalItems: task.totalItems,
		currentItem: task.currentItem,
		error: task.error,
		cancelRequested: task.cancelRequested,
		createdAt: task.createdAt,
		startedAt: task.startedAt,
		finishedAt: task.finishedAt,
		updatedAt: task.updatedAt,
	};
}

function setTaskStatus(task: MockTaskRecord, status: TaskStatus): void {
	task.status = status;
	task.updatedAt = now();
	if (status === "running" && !task.startedAt) {
		task.startedAt = task.updatedAt;
	}
	if (
		(status === "completed" ||
			status === "failed" ||
			status === "cancelled" ||
			status === "interrupted") &&
		!task.finishedAt
	) {
		task.finishedAt = task.updatedAt;
	}
}

function removeTaskFromQueue(taskId: string): void {
	const index = mockTaskQueue.indexOf(taskId);
	if (index >= 0) {
		mockTaskQueue.splice(index, 1);
	}
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

class MockTaskCancelledError extends Error {
	constructor() {
		super("Task cancelled");
		this.name = "MockTaskCancelledError";
	}
}

function countMockNodeUnits(node: MockNode): number {
	if (node.kind === "file") {
		return 1;
	}

	let count = 1;
	for (const childNode of node.children.values()) {
		count += countMockNodeUnits(childNode);
	}

	return count;
}

function estimateMockTransferUnits(sourcePath: string, names: string[]): number {
	try {
		const sourceDir = getDir(sourcePath);
		if (!sourceDir) {
			return names.length;
		}

		let totalUnits = 0;
		for (const name of names) {
			const sourceNode = sourceDir.children.get(name);
			if (!sourceNode) {
				return names.length;
			}
			totalUnits += countMockNodeUnits(sourceNode);
		}

		return Math.max(totalUnits, names.length);
	} catch {
		return names.length;
	}
}

function assertTaskNotCancelled(task: MockTaskRecord): void {
	if (task.cancelRequested) {
		throw new MockTaskCancelledError();
	}
}

async function advanceTaskProgress(
	task: MockTaskRecord,
	currentItem: string,
	increment = 1,
): Promise<void> {
	task.processedItems = Math.min(task.totalItems, task.processedItems + increment);
	task.currentItem = currentItem;
	task.updatedAt = now();
	await wait(40);
}

async function copyMockNodeWithProgress({
	task,
	sourceNode,
	targetDir,
	name,
	relativePath,
}: {
	task: MockTaskRecord;
	sourceNode: MockNode;
	targetDir: MockDir;
	name: string;
	relativePath: string;
}): Promise<void> {
	assertTaskNotCancelled(task);

	if (sourceNode.kind === "file") {
		targetDir.children.set(name, cloneNode(sourceNode));
		await advanceTaskProgress(task, relativePath);
		return;
	}

	const copiedDir = createDir(name);
	copiedDir.createdAt = sourceNode.createdAt;
	targetDir.children.set(name, copiedDir);
	await advanceTaskProgress(task, relativePath);

	for (const [childName, childNode] of sourceNode.children) {
		await copyMockNodeWithProgress({
			task,
			sourceNode: childNode,
			targetDir: copiedDir,
			name: childName,
			relativePath: joinPath(relativePath, childName),
		});
	}
}

async function runMockTask(taskId: string): Promise<void> {
	const task = mockTasks.get(taskId);
	if (!task || task.status !== "queued") {
		return;
	}

	setTaskStatus(task, "running");

	try {
		const normalizedSourcePath = normalizePath(task.sourcePath);
		const normalizedTargetPath = normalizePath(task.targetPath);

		if (normalizedSourcePath === normalizedTargetPath) {
			throw new Error("Source and target directories cannot be the same");
		}

		const sourceDir = getDir(normalizedSourcePath);
		if (!sourceDir) {
			throw new Error(`Directory not found: /${normalizedSourcePath}`);
		}

		const targetDir = getDir(normalizedTargetPath);
		if (!targetDir) {
			throw new Error(`Directory not found: /${normalizedTargetPath}`);
		}

		const overwriteNameSet = new Set(task.overwriteNames);

		for (let i = 0; i < task.names.length; i += 1) {
			const name = task.names[i];
			assertTaskNotCancelled(task);

			const sourceNode = sourceDir.children.get(name);
			if (!sourceNode) {
				throw new Error(`"${name}" does not exist`);
			}

			if (sourceNode.kind === "dir") {
				const sourceNodePath = joinPath(normalizedSourcePath, name);
				if (isSubPath(sourceNodePath, normalizedTargetPath)) {
					throw new Error(
						`Cannot ${task.operation} "${name}" into its own subdirectory`,
					);
				}
			}

			const targetExists = targetDir.children.has(name);
			if (targetExists && !overwriteNameSet.has(name)) {
				throw new Error(`"${name}" already exists in target directory`);
			}

			if (targetExists) {
				targetDir.children.delete(name);
			}

			if (task.operation === "copy") {
				await copyMockNodeWithProgress({
					task,
					sourceNode,
					targetDir,
					name,
					relativePath: name,
				});
			} else {
				sourceDir.children.delete(name);
				sourceNode.modifiedAt = nowIso();
				targetDir.children.set(name, sourceNode);
				await advanceTaskProgress(task, name, countMockNodeUnits(sourceNode));
			}

			touchDir(normalizedSourcePath);
			touchDir(normalizedTargetPath);
		}

		task.currentItem = null;
		setTaskStatus(task, "completed");
	} catch (err) {
		if (err instanceof MockTaskCancelledError) {
			task.currentItem = null;
			setTaskStatus(task, "cancelled");
			return;
		}

		task.currentItem = null;
		task.error = (err as Error).message;
		setTaskStatus(task, "failed");
	}
}

async function runMockTaskWorker(): Promise<void> {
	if (mockTaskWorkerRunning) return;
	mockTaskWorkerRunning = true;

	try {
		while (mockTaskQueue.length > 0) {
			const nextTaskId = mockTaskQueue.shift();
			if (!nextTaskId) continue;
			await runMockTask(nextTaskId);
		}
	} finally {
		mockTaskWorkerRunning = false;
	}
}

interface MockCreateTaskInput {
	operation: TaskOperation;
	sourcePath: string;
	targetPath: string;
	names: string[];
	overwriteNames?: string[];
}

export function mockCreateCopyMoveTask({
	operation,
	sourcePath,
	targetPath,
	names,
	overwriteNames = [],
}: MockCreateTaskInput): { taskId: string; task: BackgroundTask } {
	const normalizedNames = Array.from(
		new Set(names.map(assertValidTransferName)),
	);
	const overwriteNameSet = new Set(
		overwriteNames.map(assertValidTransferName),
	);
	const normalizedOverwriteNames = normalizedNames.filter((name) =>
		overwriteNameSet.has(name),
	);
	if (normalizedNames.length === 0) {
		throw new Error("No files selected");
	}

	const normalizedSourcePath = normalizePath(sourcePath);
	const totalItems = estimateMockTransferUnits(
		normalizedSourcePath,
		normalizedNames,
	);

	const timestamp = now();
	const task: MockTaskRecord = {
		id: createMockTaskId(),
		operation,
		sourcePath: normalizedSourcePath,
		targetPath: normalizePath(targetPath),
		names: normalizedNames,
		overwriteNames: normalizedOverwriteNames,
		status: "queued",
		processedItems: 0,
		totalItems,
		currentItem: null,
		error: null,
		cancelRequested: false,
		createdAt: timestamp,
		startedAt: null,
		finishedAt: null,
		updatedAt: timestamp,
	};

	mockTasks.set(task.id, task);
	mockTaskQueue.push(task.id);
	void runMockTaskWorker();

	return { taskId: task.id, task: toBackgroundTask(task) };
}

export function mockGetTask(taskId: string): { task: BackgroundTask } {
	const task = mockTasks.get(taskId);
	if (!task) {
		throw new Error("Task not found");
	}

	return { task: toBackgroundTask(task) };
}

export function mockListTasks(limit = 50): { tasks: BackgroundTask[] } {
	const tasks = Array.from(mockTasks.values())
		.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
		.slice(0, Math.max(1, Math.min(limit, 200)))
		.map((task) => toBackgroundTask(task));

	return { tasks };
}

export function mockClearCompletedTasks(): {
	success: boolean;
	clearedCount: number;
} {
	const completedTaskIds = Array.from(mockTasks.entries())
		.filter(([, task]) => task.status === "completed")
		.map(([taskId]) => taskId);

	for (const taskId of completedTaskIds) {
		removeTaskFromQueue(taskId);
		mockTasks.delete(taskId);
	}

	return {
		success: true,
		clearedCount: completedTaskIds.length,
	};
}

export function mockCancelTask(taskId: string): { success: boolean } {
	const task = mockTasks.get(taskId);
	if (!task) {
		throw new Error("Task not found");
	}

	if (task.status === "queued") {
		removeTaskFromQueue(taskId);
		task.cancelRequested = true;
		setTaskStatus(task, "cancelled");
		return { success: true };
	}

	if (task.status === "running") {
		task.cancelRequested = true;
		task.updatedAt = now();
	}

	return { success: true };
}

export function getMockDownloadUrl(filePath: string): string {
	const node = getNode(filePath);
	if (!node || node.kind !== "file") return "#";
	return makeDataUrl(node.content, node.mimeType);
}

export function getMockPreviewUrl(filePath: string): string {
	return getMockDownloadUrl(filePath);
}

export function mockFetchTextContent(filePath: string): string {
	const node = getNode(filePath);
	if (!node || node.kind !== "file") throw new Error("File not found");
	if (!isTextFile(node)) throw new Error("Failed to load file content");
	return node.content;
}

export function hasMockEntry(filePath: string): boolean {
	return getNode(filePath) !== null;
}

export function getMockEntryParentPath(filePath: string): string {
	return getParentPath(filePath);
}
