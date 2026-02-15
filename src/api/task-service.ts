import {
	TaskOperation,
	TaskStatus,
	TaskType,
	type Task,
} from "@prisma/client";
import fs from "fs/promises";
import path from "path";
import {
	runCopyMoveTask,
	TaskCancelledError,
	type CopyMoveOperation,
} from "./fs-ops";
import { prisma } from "./prisma";

type PublicTaskOperation = "copy" | "move";

type PublicTaskStatus =
	| "queued"
	| "running"
	| "completed"
	| "failed"
	| "cancelled"
	| "interrupted";

export interface TaskDto {
	id: string;
	type: "copy_move";
	operation: PublicTaskOperation;
	sourcePath: string;
	targetPath: string;
	names: string[];
	status: PublicTaskStatus;
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

interface CreateCopyMoveTaskInput {
	operation: PublicTaskOperation;
	sourcePath: string;
	targetPath: string;
	names: string[];
}

interface TaskRuntimeState {
	started: boolean;
	starting: Promise<void> | null;
	running: boolean;
	queue: string[];
}

declare global {
	var __fileDeskTaskRuntime: TaskRuntimeState | undefined;
}

const INTERRUPTED_MESSAGE = "Server restarted before task completion";

const runtime: TaskRuntimeState = globalThis.__fileDeskTaskRuntime ?? {
	started: false,
	starting: null,
	running: false,
	queue: [],
};

if (!globalThis.__fileDeskTaskRuntime) {
	globalThis.__fileDeskTaskRuntime = runtime;
}

function parseNames(namesJson: string): string[] {
	try {
		const value = JSON.parse(namesJson) as unknown;
		if (!Array.isArray(value)) return [];
		return value.filter((item): item is string => typeof item === "string");
	} catch {
		return [];
	}
}

function toPublicOperation(operation: TaskOperation): PublicTaskOperation {
	return operation === TaskOperation.COPY ? "copy" : "move";
}

function toPublicStatus(status: TaskStatus): PublicTaskStatus {
	switch (status) {
		case TaskStatus.QUEUED:
			return "queued";
		case TaskStatus.RUNNING:
			return "running";
		case TaskStatus.COMPLETED:
			return "completed";
		case TaskStatus.FAILED:
			return "failed";
		case TaskStatus.CANCELLED:
			return "cancelled";
		case TaskStatus.INTERRUPTED:
			return "interrupted";
		default:
			return "failed";
	}
}

function toTaskDto(task: Task): TaskDto {
	return {
		id: task.id,
		type: "copy_move",
		operation: toPublicOperation(task.operation),
		sourcePath: task.sourcePath,
		targetPath: task.targetPath,
		names: parseNames(task.namesJson),
		status: toPublicStatus(task.status),
		processedItems: task.processedItems,
		totalItems: task.totalItems,
		currentItem: task.currentItem,
		error: task.error,
		cancelRequested: task.cancelRequested,
		createdAt: task.createdAt.toISOString(),
		startedAt: task.startedAt?.toISOString() ?? null,
		finishedAt: task.finishedAt?.toISOString() ?? null,
		updatedAt: task.updatedAt.toISOString(),
	};
}

function sanitizeNames(names: string[]): string[] {
	const normalized = names
		.map((name) => name.trim())
		.filter((name) => name.length > 0);
	return Array.from(new Set(normalized));
}

async function ensureDatabaseReady(): Promise<void> {
	await fs.mkdir(path.resolve(process.cwd(), ".data"), { recursive: true });
}

async function ensureTaskTable(): Promise<void> {
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS "Task" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"type" TEXT NOT NULL DEFAULT 'COPY_MOVE',
			"operation" TEXT NOT NULL,
			"sourcePath" TEXT NOT NULL,
			"targetPath" TEXT NOT NULL,
			"namesJson" TEXT NOT NULL,
			"status" TEXT NOT NULL DEFAULT 'QUEUED',
			"processedItems" INTEGER NOT NULL DEFAULT 0,
			"totalItems" INTEGER NOT NULL DEFAULT 0,
			"currentItem" TEXT,
			"error" TEXT,
			"cancelRequested" BOOLEAN NOT NULL DEFAULT false,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"startedAt" DATETIME,
			"finishedAt" DATETIME,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`);

	await prisma.$executeRawUnsafe(
		'CREATE INDEX IF NOT EXISTS "Task_status_createdAt_idx" ON "Task"("status", "createdAt")',
	);
	await prisma.$executeRawUnsafe(
		'CREATE INDEX IF NOT EXISTS "Task_createdAt_idx" ON "Task"("createdAt")',
	);
}

function enqueueTask(taskId: string): void {
	if (!runtime.queue.includes(taskId)) {
		runtime.queue.push(taskId);
	}
	void runWorkerLoop();
}

function removeQueuedTask(taskId: string): void {
	runtime.queue = runtime.queue.filter((queuedId) => queuedId !== taskId);
}

async function runWorkerLoop(): Promise<void> {
	if (runtime.running) return;
	runtime.running = true;

	try {
		while (runtime.queue.length > 0) {
			const taskId = runtime.queue.shift();
			if (!taskId) continue;
			await executeTask(taskId);
		}
	} finally {
		runtime.running = false;
	}
}

async function isCancellationRequested(taskId: string): Promise<boolean> {
	const task = await prisma.task.findUnique({
		where: { id: taskId },
		select: { cancelRequested: true, status: true },
	});

	if (!task) return true;
	if (task.status !== TaskStatus.RUNNING) return true;
	return task.cancelRequested;
}

async function executeTask(taskId: string): Promise<void> {
	const claim = await prisma.task.updateMany({
		where: { id: taskId, status: TaskStatus.QUEUED },
		data: {
			status: TaskStatus.RUNNING,
			startedAt: new Date(),
			error: null,
			currentItem: null,
			cancelRequested: false,
		},
	});

	if (claim.count === 0) {
		return;
	}

	const task = await prisma.task.findUnique({ where: { id: taskId } });
	if (!task) {
		return;
	}

	const names = parseNames(task.namesJson);
	const operation: CopyMoveOperation =
		task.operation === TaskOperation.COPY ? "copy" : "move";

	try {
		await runCopyMoveTask({
			operation,
			sourcePath: task.sourcePath,
			targetPath: task.targetPath,
			names,
			onProgress: async (progress) => {
				await prisma.task.update({
					where: { id: task.id },
					data: {
						processedItems: progress.processedItems,
						totalItems: progress.totalItems,
						currentItem: progress.currentItem,
					},
				});
			},
			shouldCancel: () => isCancellationRequested(task.id),
		});

		await prisma.task.update({
			where: { id: task.id },
			data: {
				status: TaskStatus.COMPLETED,
				processedItems: names.length,
				totalItems: names.length,
				currentItem: null,
				finishedAt: new Date(),
				error: null,
			},
		});
	} catch (err) {
		if (err instanceof TaskCancelledError) {
			await prisma.task.update({
				where: { id: task.id },
				data: {
					status: TaskStatus.CANCELLED,
					finishedAt: new Date(),
					currentItem: null,
					error: null,
				},
			});
			return;
		}

		await prisma.task.update({
			where: { id: task.id },
			data: {
				status: TaskStatus.FAILED,
				finishedAt: new Date(),
				currentItem: null,
				error: (err as Error).message,
			},
		});
	}
}

export async function startTaskRuntime(): Promise<void> {
	if (runtime.started) return;
	if (runtime.starting) return runtime.starting;

	runtime.starting = (async () => {
		await ensureDatabaseReady();
		await prisma.$connect();
		await ensureTaskTable();
		await prisma.task.updateMany({
			where: {
				status: { in: [TaskStatus.QUEUED, TaskStatus.RUNNING] },
			},
			data: {
				status: TaskStatus.INTERRUPTED,
				finishedAt: new Date(),
				error: INTERRUPTED_MESSAGE,
				cancelRequested: false,
			},
		});

		runtime.started = true;
		runtime.starting = null;
	})().catch((err) => {
		runtime.starting = null;
		throw err;
	});

	return runtime.starting;
}

export async function createCopyMoveTask({
	operation,
	sourcePath,
	targetPath,
	names,
}: CreateCopyMoveTaskInput): Promise<TaskDto> {
	await startTaskRuntime();

	const normalizedNames = sanitizeNames(names);
	if (normalizedNames.length === 0) {
		throw new Error("No files selected");
	}

	const task = await prisma.task.create({
		data: {
			type: TaskType.COPY_MOVE,
			operation: operation === "copy" ? TaskOperation.COPY : TaskOperation.MOVE,
			sourcePath,
			targetPath,
			namesJson: JSON.stringify(normalizedNames),
			totalItems: normalizedNames.length,
		},
	});

	enqueueTask(task.id);
	return toTaskDto(task);
}

export async function getTaskById(taskId: string): Promise<TaskDto | null> {
	await startTaskRuntime();
	const task = await prisma.task.findUnique({ where: { id: taskId } });
	if (!task) return null;
	return toTaskDto(task);
}

export async function listTasks(limit = 50): Promise<TaskDto[]> {
	await startTaskRuntime();
	const tasks = await prisma.task.findMany({
		orderBy: { createdAt: "desc" },
		take: limit,
	});
	return tasks.map(toTaskDto);
}

export async function cancelTask(taskId: string): Promise<boolean> {
	await startTaskRuntime();
	const task = await prisma.task.findUnique({ where: { id: taskId } });
	if (!task) return false;

	if (task.status === TaskStatus.QUEUED) {
		removeQueuedTask(taskId);
		await prisma.task.update({
			where: { id: taskId },
			data: {
				status: TaskStatus.CANCELLED,
				cancelRequested: true,
				finishedAt: new Date(),
				currentItem: null,
				error: null,
			},
		});
		return true;
	}

	if (task.status === TaskStatus.RUNNING) {
		await prisma.task.update({
			where: { id: taskId },
			data: { cancelRequested: true },
		});
		return true;
	}

	return true;
}
