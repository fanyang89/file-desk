import type { IncomingMessage, ServerResponse } from "http";
import {
	cancelTask,
	createCopyMoveTask,
	getTaskById,
	listTasks,
} from "./task-service";

function sendJson(res: ServerResponse, data: unknown, status = 200) {
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, message: string, status = 400) {
	sendJson(res, { error: message }, status);
}

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk: Buffer) => {
			body += chunk.toString();
		});
		req.on("end", () => {
			try {
				resolve(JSON.parse(body || "{}"));
			} catch {
				reject(new Error("Invalid JSON"));
			}
		});
		req.on("error", reject);
	});
}

function readLimit(searchParams: URLSearchParams): number {
	const raw = searchParams.get("limit");
	if (!raw) return 50;
	const parsed = Number.parseInt(raw, 10);
	if (Number.isNaN(parsed) || parsed <= 0) return 50;
	return Math.min(parsed, 200);
}

function getTaskIdFromPath(pathname: string): string | null {
	const segments = pathname.split("/").filter(Boolean);
	if (segments.length < 3) return null;
	if (segments[0] !== "api" || segments[1] !== "tasks") return null;
	return segments[2] || null;
}

export async function handleCreateCopyMoveTask(
	req: IncomingMessage,
	res: ServerResponse,
) {
	try {
		const body = (await parseBody(req)) as {
			operation?: unknown;
			sourcePath?: unknown;
			targetPath?: unknown;
			names?: unknown;
		};

		if (body.operation !== "copy" && body.operation !== "move") {
			sendError(res, "operation must be \"copy\" or \"move\"");
			return;
		}

		if (typeof body.sourcePath !== "string") {
			sendError(res, "sourcePath is required");
			return;
		}

		if (typeof body.targetPath !== "string") {
			sendError(res, "targetPath is required");
			return;
		}

		if (!Array.isArray(body.names) || body.names.some((name) => typeof name !== "string")) {
			sendError(res, "names must be an array of strings");
			return;
		}

		const task = await createCopyMoveTask({
			operation: body.operation,
			sourcePath: body.sourcePath,
			targetPath: body.targetPath,
			names: body.names,
		});

		sendJson(res, { taskId: task.id, task }, 202);
	} catch (err) {
		sendError(res, (err as Error).message, 500);
	}
}

export async function handleGetTask(req: IncomingMessage, res: ServerResponse) {
	try {
		const url = new URL(req.url!, `http://${req.headers.host}`);
		const taskId = getTaskIdFromPath(url.pathname);
		if (!taskId) {
			sendError(res, "taskId is required", 400);
			return;
		}

		const task = await getTaskById(taskId);
		if (!task) {
			sendError(res, "Task not found", 404);
			return;
		}

		sendJson(res, { task });
	} catch (err) {
		sendError(res, (err as Error).message, 500);
	}
}

export async function handleListTasks(req: IncomingMessage, res: ServerResponse) {
	try {
		const url = new URL(req.url!, `http://${req.headers.host}`);
		const limit = readLimit(url.searchParams);
		const tasks = await listTasks(limit);
		sendJson(res, { tasks });
	} catch (err) {
		sendError(res, (err as Error).message, 500);
	}
}

export async function handleCancelTask(
	req: IncomingMessage,
	res: ServerResponse,
) {
	try {
		const url = new URL(req.url!, `http://${req.headers.host}`);
		const taskId = getTaskIdFromPath(url.pathname);
		if (!taskId) {
			sendError(res, "taskId is required", 400);
			return;
		}

		const found = await cancelTask(taskId);
		if (!found) {
			sendError(res, "Task not found", 404);
			return;
		}

		sendJson(res, { success: true });
	} catch (err) {
		sendError(res, (err as Error).message, 500);
	}
}
