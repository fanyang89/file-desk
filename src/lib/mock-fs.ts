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

function assertValidTransferName(name: string): string {
	if (!name) throw new Error("Name is required");
	if (name === "." || name === "..") throw new Error(`Invalid name: "${name}"`);
	if (name.includes("/") || name.includes("\\")) {
		throw new Error(`Invalid name: "${name}"`);
	}
	return name;
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

function transferMockEntries(
	operation: TaskOperation,
	sourcePath: string,
	targetPath: string,
	names: string[],
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
	if (uniqueNames.length === 0) {
		throw new Error("No files selected");
	}

	for (const name of uniqueNames) {
		const sourceNode = sourceDir.children.get(name);
		if (!sourceNode) {
			throw new Error(`"${name}" does not exist`);
		}

		if (targetDir.children.has(name)) {
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
): { success: boolean } {
	transferMockEntries("copy", sourcePath, targetPath, names);
	return { success: true };
}

export function mockMoveEntries(
	sourcePath: string,
	targetPath: string,
	names: string[],
): { success: boolean } {
	transferMockEntries("move", sourcePath, targetPath, names);
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

interface MockTaskRecord {
	id: string;
	operation: TaskOperation;
	sourcePath: string;
	targetPath: string;
	names: string[];
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

async function runMockTask(taskId: string): Promise<void> {
	const task = mockTasks.get(taskId);
	if (!task || task.status !== "queued") {
		return;
	}

	setTaskStatus(task, "running");

	try {
		for (let i = 0; i < task.names.length; i += 1) {
			if (task.cancelRequested) {
				setTaskStatus(task, "cancelled");
				task.currentItem = null;
				return;
			}

			const name = task.names[i];
			await wait(80);
			transferMockEntries(task.operation, task.sourcePath, task.targetPath, [name]);
			task.processedItems = i + 1;
			task.currentItem = name;
			task.updatedAt = now();
		}

		task.currentItem = null;
		setTaskStatus(task, "completed");
	} catch (err) {
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
}

export function mockCreateCopyMoveTask({
	operation,
	sourcePath,
	targetPath,
	names,
}: MockCreateTaskInput): { taskId: string; task: BackgroundTask } {
	const normalizedNames = Array.from(
		new Set(names.map(assertValidTransferName)),
	);
	if (normalizedNames.length === 0) {
		throw new Error("No files selected");
	}

	const timestamp = now();
	const task: MockTaskRecord = {
		id: createMockTaskId(),
		operation,
		sourcePath: normalizePath(sourcePath),
		targetPath: normalizePath(targetPath),
		names: normalizedNames,
		status: "queued",
		processedItems: 0,
		totalItems: normalizedNames.length,
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
