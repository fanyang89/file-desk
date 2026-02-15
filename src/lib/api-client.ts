import type { BackgroundTask, FileEntry, TaskOperation } from "@/types";
import {
	mockListFiles,
	mockCreateFolder,
	mockRenameEntry,
	mockDeleteEntry,
	mockCreateCopyMoveTask,
	mockGetTask,
	mockListTasks,
	mockCancelTask,
	mockUploadFiles,
	mockUploadFileItems,
	getMockDownloadUrl,
	getMockPreviewUrl,
	mockFetchTextContent,
	hasMockEntry,
} from "@/lib/mock-fs";

interface ListResponse {
	files: FileEntry[];
	currentPath: string;
}

export interface ListFilesOptions {
	recursive?: boolean;
	imagesOnly?: boolean;
}

interface SuccessResponse {
	success: boolean;
}

interface CreateTaskResponse {
	taskId: string;
	task: BackgroundTask;
}

interface GetTaskResponse {
	task: BackgroundTask;
}

interface ListTasksResponse {
	tasks: BackgroundTask[];
}

export interface UploadFileItem {
	file: File;
	relativePath?: string;
}

function isVercelDeploymentHost(): boolean {
	if (typeof window === "undefined") return false;
	return window.location.hostname.endsWith(".vercel.app");
}

const CAN_USE_MOCK = import.meta.env.DEV || isVercelDeploymentHost();
let mockModeEnabled = false;

function enableMockMode(reason: string): void {
	if (!CAN_USE_MOCK || mockModeEnabled) return;
	mockModeEnabled = true;
	console.warn(`[api-client] API unavailable, using mock fs (${reason})`);
}

function shouldFallbackToMockStatus(
	status: number,
	fallbackOnNotFound: boolean,
): boolean {
	if (status === 405) return true;
	if (fallbackOnNotFound && status === 404) return true;
	return false;
}

function shouldFallbackToMockError(err: unknown): boolean {
	return err instanceof TypeError;
}

const VERCEL_FALLBACK_MARKERS = [
	"function_invocation_failed",
	"a server error has occurred",
	"authentication required",
	"vercel authentication",
	"deployment protection",
];

async function shouldFallbackToMockResponse(
	res: Response,
	fallbackOnNotFound: boolean,
	nonFallbackNotFoundMessages: string[],
): Promise<boolean> {
	if (res.status === 404 && fallbackOnNotFound) {
		if (nonFallbackNotFoundMessages.length === 0) return true;

		const normalizedMarkers = nonFallbackNotFoundMessages.map((message) =>
			message.toLowerCase(),
		);

		let bodyMessage = "";
		try {
			const json = (await res.clone().json()) as {
				error?: string;
				message?: string;
			};
			bodyMessage = `${json.error ?? ""} ${json.message ?? ""}`.toLowerCase();
		} catch {
			try {
				bodyMessage = (await res.clone().text()).slice(0, 1024).toLowerCase();
			} catch {
				bodyMessage = "";
			}
		}

		if (normalizedMarkers.some((marker) => bodyMessage.includes(marker))) {
			return false;
		}

		return true;
	}

	if (shouldFallbackToMockStatus(res.status, false)) return true;

	// In preview environments, treat Vercel platform failures/protection pages as API unavailable.
	if (!CAN_USE_MOCK || !isVercelDeploymentHost()) return false;

	const vercelErrorHeader =
		res.headers.get("x-vercel-error")?.toLowerCase() || "";
	if (vercelErrorHeader.includes("function_invocation_failed")) return true;

	if (res.status !== 401 && res.status !== 403 && res.status < 500)
		return false;

	const contentType = res.headers.get("content-type")?.toLowerCase() || "";
	if (
		!contentType.includes("text/html") &&
		!contentType.includes("application/json")
	) {
		return false;
	}

	const bodyPreview = (await res.clone().text()).slice(0, 4096).toLowerCase();
	return VERCEL_FALLBACK_MARKERS.some((marker) => bodyPreview.includes(marker));
}

async function readErrorMessage(
	res: Response,
	fallback: string,
): Promise<string> {
	try {
		const err = (await res.clone().json()) as { error?: string };
		if (err.error) return err.error;
	} catch {
		// Ignore non-JSON error responses
	}
	try {
		const text = (await res.text()).trim();
		if (text) return text;
	} catch {
		// Ignore unreadable body
	}
	return fallback;
}

interface RequestWithMockOptions<T> {
	url: string;
	init?: RequestInit;
	fallbackReason: string;
	errorFallback: string;
	mockValue: () => T | Promise<T>;
	fallbackOnNotFound?: boolean;
	nonFallbackNotFoundMessages?: string[];
}

async function requestJsonWithMock<T>({
	url,
	init,
	fallbackReason,
	errorFallback,
	mockValue,
	fallbackOnNotFound = true,
	nonFallbackNotFoundMessages = [],
}: RequestWithMockOptions<T>): Promise<T> {
	if (mockModeEnabled) {
		return mockValue();
	}

	let res: Response;
	try {
		res = await fetch(url, init);
	} catch (err) {
		if (CAN_USE_MOCK && shouldFallbackToMockError(err)) {
			enableMockMode(`${fallbackReason} -> network error`);
			return mockValue();
		}
		throw err;
	}

	if (!res.ok) {
		if (
			CAN_USE_MOCK &&
			(await shouldFallbackToMockResponse(
				res,
				fallbackOnNotFound,
				nonFallbackNotFoundMessages,
			))
		) {
			enableMockMode(`${fallbackReason} -> ${res.status}`);
			return mockValue();
		}
		throw new Error(await readErrorMessage(res, errorFallback));
	}
	return res.json() as Promise<T>;
}

export async function listFiles(path: string): Promise<ListResponse> {
	return listFilesWithOptions(path, {});
}

async function listFilesWithOptions(
	path: string,
	options: ListFilesOptions,
): Promise<ListResponse> {
	const query = new URLSearchParams({ path });
	if (options.recursive) query.set("recursive", "1");
	if (options.imagesOnly) query.set("imagesOnly", "1");

	return requestJsonWithMock({
		url: `/api/files?${query.toString()}`,
		fallbackReason: "GET /api/files",
		errorFallback: "Failed to list files",
		mockValue: () => mockListFiles(path, options),
	});
}

export async function listFilesRecursive(path: string): Promise<ListResponse> {
	return listFilesWithOptions(path, { recursive: true });
}

export async function listImagesRecursive(path: string): Promise<ListResponse> {
	return listFilesWithOptions(path, { recursive: true, imagesOnly: true });
}

export async function createFolder(
	path: string,
	name: string,
): Promise<SuccessResponse> {
	return requestJsonWithMock({
		url: "/api/mkdir",
		init: {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path, name }),
		},
		fallbackReason: "POST /api/mkdir",
		errorFallback: "Failed to create folder",
		mockValue: () => mockCreateFolder(path, name),
	});
}

export async function renameEntry(
	path: string,
	oldName: string,
	newName: string,
): Promise<SuccessResponse> {
	return requestJsonWithMock({
		url: "/api/rename",
		init: {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path, oldName, newName }),
		},
		fallbackReason: "POST /api/rename",
		errorFallback: "Failed to rename",
		mockValue: () => mockRenameEntry(path, oldName, newName),
	});
}

export async function deleteEntry(
	path: string,
	name: string,
): Promise<SuccessResponse> {
	return requestJsonWithMock({
		url: "/api/delete",
		init: {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path, name }),
		},
		fallbackReason: "DELETE /api/delete",
		errorFallback: "Failed to delete",
		mockValue: () => mockDeleteEntry(path, name),
	});
}

export async function createCopyMoveTask(
	operation: TaskOperation,
	sourcePath: string,
	targetPath: string,
	names: string[],
): Promise<CreateTaskResponse> {
	return requestJsonWithMock({
		url: "/api/tasks/copy-move",
		init: {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ operation, sourcePath, targetPath, names }),
		},
		fallbackReason: "POST /api/tasks/copy-move",
		errorFallback: "Failed to create task",
		fallbackOnNotFound: true,
		mockValue: () =>
			mockCreateCopyMoveTask({ operation, sourcePath, targetPath, names }),
	});
}

export async function getTask(taskId: string): Promise<GetTaskResponse> {
	return requestJsonWithMock({
		url: `/api/tasks/${encodeURIComponent(taskId)}`,
		fallbackReason: "GET /api/tasks/:id",
		errorFallback: "Failed to get task",
		fallbackOnNotFound: true,
		nonFallbackNotFoundMessages: ["task not found"],
		mockValue: () => mockGetTask(taskId),
	});
}

export async function listTasks(limit = 50): Promise<ListTasksResponse> {
	const query = new URLSearchParams({ limit: String(limit) });
	return requestJsonWithMock({
		url: `/api/tasks?${query.toString()}`,
		fallbackReason: "GET /api/tasks",
		errorFallback: "Failed to list tasks",
		fallbackOnNotFound: true,
		mockValue: () => mockListTasks(limit),
	});
}

export async function cancelTask(taskId: string): Promise<SuccessResponse> {
	return requestJsonWithMock({
		url: `/api/tasks/${encodeURIComponent(taskId)}/cancel`,
		init: {
			method: "POST",
			headers: { "Content-Type": "application/json" },
		},
		fallbackReason: "POST /api/tasks/:id/cancel",
		errorFallback: "Failed to cancel task",
		fallbackOnNotFound: true,
		nonFallbackNotFoundMessages: ["task not found"],
		mockValue: () => mockCancelTask(taskId),
	});
}

export async function uploadFiles(
	path: string,
	files: FileList,
): Promise<{ success: boolean; files: string[] }> {
	const formData = new FormData();
	for (const file of files) {
		formData.append("files", file);
	}

	return requestJsonWithMock({
		url: `/api/upload?path=${encodeURIComponent(path)}`,
		init: {
			method: "POST",
			body: formData,
		},
		fallbackReason: "POST /api/upload",
		errorFallback: "Failed to upload",
		mockValue: () => mockUploadFiles(path, files),
	});
}

export async function uploadFileItems(
	path: string,
	items: UploadFileItem[],
): Promise<{ success: boolean; files: string[] }> {
	const formData = new FormData();
	for (const item of items) {
		const normalizedPath = (item.relativePath || item.file.name)
			.replace(/\\/g, "/")
			.replace(/^\/+/, "")
			.replace(/\/{2,}/g, "/");
		formData.append("files", item.file, normalizedPath || item.file.name);
	}

	return requestJsonWithMock({
		url: `/api/upload?path=${encodeURIComponent(path)}`,
		init: {
			method: "POST",
			body: formData,
		},
		fallbackReason: "POST /api/upload",
		errorFallback: "Failed to upload",
		mockValue: () => mockUploadFileItems(path, items),
	});
}

export function getDownloadUrl(filePath: string): string {
	if (mockModeEnabled && hasMockEntry(filePath)) {
		return getMockDownloadUrl(filePath);
	}
	return `/api/download?path=${encodeURIComponent(filePath)}`;
}

export function getPreviewUrl(filePath: string): string {
	if (mockModeEnabled && hasMockEntry(filePath)) {
		return getMockPreviewUrl(filePath);
	}
	return `/api/preview?path=${encodeURIComponent(filePath)}`;
}

export function getThumbnailUrl(filePath: string, modifiedAt: string): string {
	if (mockModeEnabled && hasMockEntry(filePath)) {
		return getMockPreviewUrl(filePath);
	}

	const query = new URLSearchParams({ path: filePath, v: modifiedAt });
	return `/api/thumbnail?${query.toString()}`;
}

export async function fetchTextContent(
	filePath: string,
	signal?: AbortSignal,
): Promise<string> {
	if (mockModeEnabled && hasMockEntry(filePath)) {
		return mockFetchTextContent(filePath);
	}

	let res: Response;
	try {
		res = await fetch(getPreviewUrl(filePath), { signal });
	} catch (err) {
		if (
			CAN_USE_MOCK &&
			shouldFallbackToMockError(err) &&
			hasMockEntry(filePath)
		) {
			enableMockMode("GET /api/preview -> network error");
			return mockFetchTextContent(filePath);
		}
		throw err;
	}

	if (!res.ok) {
		if (
			CAN_USE_MOCK &&
			hasMockEntry(filePath) &&
			(await shouldFallbackToMockResponse(res, true, []))
		) {
			enableMockMode(`GET /api/preview -> ${res.status}`);
			return mockFetchTextContent(filePath);
		}
		throw new Error(await readErrorMessage(res, "Failed to load file content"));
	}
	return res.text();
}
