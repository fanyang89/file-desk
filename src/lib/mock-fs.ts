import type { FileEntry } from "@/types";

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
}

seedMockData();

interface MockListFilesOptions {
	recursive?: boolean;
	imagesOnly?: boolean;
}

function collectListEntries(
	dir: MockDir,
	parentPath: string,
	options: MockListFilesOptions,
	files: FileEntry[],
): void {
	for (const node of dir.children.values()) {
		if (node.name.startsWith(".")) continue;

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
): { files: FileEntry[]; currentPath: string } {
	const normalizedPath = normalizePath(path);
	const dir = getDir(normalizedPath);
	if (!dir) throw new Error(`Directory not found: /${normalizedPath}`);

	const files: FileEntry[] = [];
	collectListEntries(dir, normalizedPath, options, files);
	return { files, currentPath: normalizedPath };
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
	if (!dir.children.has(targetName))
		throw new Error(`"${targetName}" does not exist`);

	dir.children.delete(targetName);
	touchDir(normalizedPath);
	return { success: true };
}

export async function mockUploadFiles(
	path: string,
	files: FileList,
): Promise<{ success: boolean; files: string[] }> {
	const normalizedPath = normalizePath(path);
	const dir = getDir(normalizedPath);
	if (!dir) throw new Error(`Directory not found: /${normalizedPath}`);

	const uploaded: string[] = [];
	for (const file of files) {
		let content = "";
		try {
			content = await file.text();
		} catch {
			content = `[binary file: ${file.name}]`;
		}

		const mimeType =
			file.type || inferMimeType(file.name, "application/octet-stream");
		const existingNode = dir.children.get(file.name);
		if (existingNode?.kind === "dir") {
			throw new Error(`Cannot overwrite folder "${file.name}"`);
		}

		if (existingNode?.kind === "file") {
			existingNode.content = content;
			existingNode.mimeType = mimeType;
			existingNode.extension = getExtension(file.name);
			existingNode.modifiedAt = nowIso();
		} else {
			dir.children.set(file.name, createFile(file.name, content, mimeType));
		}
		uploaded.push(file.name);
	}

	touchDir(normalizedPath);
	return { success: true, files: uploaded };
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
