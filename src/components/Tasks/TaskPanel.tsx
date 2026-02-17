import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import { Dialog } from "radix-ui";
import { Theme } from "@radix-ui/themes";
import { cancelTask, clearCompletedTasks, listTasks } from "@/lib/api-client";
import { useToast } from "@/components/Toast/useToast";
import {
	getActivePaneId,
	getPaneActiveTabError,
	getPaneCurrentPath,
	useFileStore,
} from "@/store/file-store";
import type { BackgroundTask, TaskStatus } from "@/types";

const ACTIVE_STATUSES: TaskStatus[] = ["queued", "running"];
const TASK_FETCH_LIMIT = 120;

type TaskFilter = "all" | "active" | "completed" | "issues";

const FILTER_OPTIONS: Array<{ key: TaskFilter; label: string }> = [
	{ key: "all", label: "All" },
	{ key: "active", label: "Active" },
	{ key: "completed", label: "Completed" },
	{ key: "issues", label: "Issues" },
];

function isActiveTask(task: BackgroundTask): boolean {
	return ACTIVE_STATUSES.includes(task.status);
}

function getStatusLabel(status: TaskStatus): string {
	switch (status) {
		case "queued":
			return "Queued";
		case "running":
			return "Running";
		case "completed":
			return "Completed";
		case "failed":
			return "Failed";
		case "cancelled":
			return "Cancelled";
		case "interrupted":
			return "Interrupted";
		default:
			return "Unknown";
	}
}

function getStatusIcon(status: TaskStatus) {
	switch (status) {
		case "queued":
			return <Clock3 size={14} />;
		case "running":
			return <Loader2 size={14} className="task-spin" />;
		case "completed":
			return <CheckCircle2 size={14} />;
		case "failed":
			return <XCircle size={14} />;
		case "cancelled":
			return <Ban size={14} />;
		case "interrupted":
			return <Ban size={14} />;
		default:
			return <Clock3 size={14} />;
	}
}

function formatProgress(task: BackgroundTask): string {
	if (task.totalItems <= 0) {
		return "0 / 0";
	}
	return `${task.processedItems} / ${task.totalItems}`;
}

function formatOperation(task: BackgroundTask): string {
	return task.operation === "copy" ? "Copy" : "Move";
}

function formatPath(path: string): string {
	return path ? `/${path}` : "/";
}

function includesTask(task: BackgroundTask, filter: TaskFilter): boolean {
	if (filter === "all") return true;
	if (filter === "active") return isActiveTask(task);
	if (filter === "completed") return task.status === "completed";
	return (
		task.status === "failed" ||
		task.status === "cancelled" ||
		task.status === "interrupted"
	);
}

export function TaskPanel() {
	const [tasks, setTasks] = useState<BackgroundTask[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState<TaskFilter>("all");
	const [jumpTask, setJumpTask] = useState<BackgroundTask | null>(null);
	const [clearingCompleted, setClearingCompleted] = useState(false);
	const [cancellingTaskIds, setCancellingTaskIds] = useState<Set<string>>(
		new Set(),
	);
	const navigate = useFileStore((s) => s.navigate);
	const { showToast } = useToast();

	const refreshTasks = useCallback(async () => {
		const response = await listTasks(TASK_FETCH_LIMIT);
		setTasks(response.tasks);
		setError(null);
	}, []);

	useEffect(() => {
		let disposed = false;
		let inFlight = false;

		const tick = async () => {
			if (disposed || inFlight) return;
			inFlight = true;
			try {
				const response = await listTasks(TASK_FETCH_LIMIT);
				if (!disposed) {
					setTasks(response.tasks);
					setError(null);
				}
			} catch (err) {
				if (!disposed) {
					setError((err as Error).message);
				}
			} finally {
				if (!disposed) {
					setLoading(false);
				}
				inFlight = false;
			}
		};

		void tick();
		const intervalId = window.setInterval(() => {
			void tick();
		}, 1500);

		return () => {
			disposed = true;
			window.clearInterval(intervalId);
		};
	}, []);

	const activeTasks = useMemo(() => tasks.filter((task) => isActiveTask(task)), [tasks]);
	const completedTasksCount = useMemo(
		() => tasks.filter((task) => task.status === "completed").length,
		[tasks],
	);
	const filteredTasks = useMemo(
		() => tasks.filter((task) => includesTask(task, filter)),
		[tasks, filter],
	);

	const visibleTasks = useMemo(() => {
		if (filter === "all") {
			const runningTasks = filteredTasks.filter((task) => isActiveTask(task));
			const recentTasks = filteredTasks
				.filter((task) => !isActiveTask(task))
				.slice(0, 10);
			return [...runningTasks, ...recentTasks];
		}

		if (filter === "active") {
			return filteredTasks;
		}

		return filteredTasks.slice(0, 20);
	}, [filteredTasks, filter]);

	const handleCancelTask = async (taskId: string) => {
		setCancellingTaskIds((prev) => {
			const next = new Set(prev);
			next.add(taskId);
			return next;
		});

		try {
			await cancelTask(taskId);
			showToast("Cancellation requested");
			await refreshTasks();
		} catch (err) {
			showToast((err as Error).message, "error");
		} finally {
			setCancellingTaskIds((prev) => {
				const next = new Set(prev);
				next.delete(taskId);
				return next;
			});
		}
	};

	const handleClearCompletedTasks = async () => {
		if (clearingCompleted || completedTasksCount === 0) return;

		setClearingCompleted(true);
		try {
			const { clearedCount } = await clearCompletedTasks();
			if (clearedCount > 0) {
				showToast(
					`Cleared ${clearedCount} completed task${
						clearedCount === 1 ? "" : "s"
					}`,
				);
			} else {
				showToast("No completed tasks to clear");
			}
			await refreshTasks();
		} catch (err) {
			showToast((err as Error).message, "error");
		} finally {
			setClearingCompleted(false);
		}
	};

	const handleTaskJumpChoice = async (destinationPath: string) => {
		try {
			await navigate(destinationPath);
			const paneId = getActivePaneId();
			const navigationError = getPaneActiveTabError(paneId);
			if (navigationError) {
				showToast(navigationError, "error");
				return;
			}

			const currentPanePath = getPaneCurrentPath(paneId);
			if (currentPanePath !== destinationPath) {
				showToast("Failed to navigate to requested path", "error");
				return;
			}

			showToast(`Jumped to ${formatPath(destinationPath)}`);
			setJumpTask(null);
		} catch (err) {
			showToast((err as Error).message, "error");
		}
	};

	const renderTask = (task: BackgroundTask) => {
		const isRunning = task.status === "queued" || task.status === "running";
		const canCancel = isRunning && !cancellingTaskIds.has(task.id);
		const progressPercent =
			task.totalItems > 0
				? Math.min(100, Math.round((task.processedItems / task.totalItems) * 100))
				: 0;

		return (
			<article
				key={task.id}
				className={`task-item status-${task.status} clickable`}
				tabIndex={0}
				onClick={() => setJumpTask(task)}
				onKeyDown={(e) => {
					if (e.target !== e.currentTarget) return;
					if (e.key !== "Enter" && e.key !== " ") return;
					e.preventDefault();
					setJumpTask(task);
				}}
			>
				<div className="task-item-header">
					<div className="task-status">
						{getStatusIcon(task.status)}
						<span>{getStatusLabel(task.status)}</span>
					</div>
					<span className="task-operation">{formatOperation(task)}</span>
				</div>

				<div className="task-paths" title={`${task.sourcePath} -> ${task.targetPath}`}>
					{formatPath(task.sourcePath)} {"->"} {formatPath(task.targetPath)}
				</div>

				<div className="task-progress-row">
					<span>{formatProgress(task)}</span>
					<span>{progressPercent}%</span>
				</div>
				<div className="task-progress-bar">
					<div
						className="task-progress-value"
						style={{ width: `${progressPercent}%` }}
					/>
				</div>

				{task.currentItem && (
					<div className="task-current-item" title={task.currentItem}>
						{task.currentItem}
					</div>
				)}

				{task.error && <div className="task-error">{task.error}</div>}

				{isRunning && (
					<button
						type="button"
						className="task-cancel-btn"
						disabled={!canCancel}
						onClick={(e) => {
							e.stopPropagation();
							void handleCancelTask(task.id);
						}}
					>
						{cancellingTaskIds.has(task.id) ? "Cancelling..." : "Cancel"}
					</button>
				)}
			</article>
		);
	};

	return (
		<>
			<section className="task-panel">
				<div className="task-panel-header">
					<h2 className="task-panel-title">Tasks</h2>
					<div className="task-panel-header-actions">
						<span className="task-panel-count">{activeTasks.length} active</span>
						<button
							type="button"
							className="task-clear-btn"
							disabled={clearingCompleted || completedTasksCount === 0}
							onClick={() => void handleClearCompletedTasks()}
						>
							{clearingCompleted ? "Clearing..." : "Clear completed"}
						</button>
					</div>
				</div>
				<div className="task-filter-row">
					{FILTER_OPTIONS.map((option) => (
						<button
							key={option.key}
							type="button"
							className={`task-filter-btn ${filter === option.key ? "active" : ""}`}
							onClick={() => setFilter(option.key)}
						>
							{option.label}
						</button>
					))}
				</div>

				{loading && tasks.length === 0 ? (
					<div className="task-panel-empty">Loading tasks...</div>
				) : error ? (
					<div className="task-panel-empty task-panel-error">{error}</div>
				) : visibleTasks.length === 0 ? (
					<div className="task-panel-empty">No tasks in this filter</div>
				) : (
					<div className="task-panel-scroll">
						<div className="task-section">
							<div className="task-section-title">
								{filter === "all"
									? "Running + Recent"
									: `${FILTER_OPTIONS.find((item) => item.key === filter)?.label || "Filtered"} Tasks`}
							</div>
							{visibleTasks.map(renderTask)}
						</div>
					</div>
				)}
			</section>

			<Dialog.Root open={jumpTask !== null} onOpenChange={(open) => !open && setJumpTask(null)}>
				<Dialog.Portal>
					<Theme
						appearance="light"
						accentColor="indigo"
						grayColor="slate"
						panelBackground="solid"
						radius="large"
						scaling="100%"
					>
						<Dialog.Overlay className="dialog-overlay" />
						<Dialog.Content className="dialog-content">
							<Dialog.Title className="dialog-title">Jump To Directory</Dialog.Title>
							<Dialog.Description className="dialog-description">
								Choose where to navigate for this task.
							</Dialog.Description>
							{jumpTask && (
								<div className="task-jump-paths">
									<div className="task-jump-item">
										<span className="task-jump-label">Source</span>
										<span
											className="task-jump-value"
											title={formatPath(jumpTask.sourcePath)}
										>
											{formatPath(jumpTask.sourcePath)}
										</span>
									</div>
									<div className="task-jump-item">
										<span className="task-jump-label">Target</span>
										<span
											className="task-jump-value"
											title={formatPath(jumpTask.targetPath)}
										>
											{formatPath(jumpTask.targetPath)}
										</span>
									</div>
								</div>
							)}
							<div className="dialog-actions">
								<button
									type="button"
									className="dialog-btn cancel"
									onClick={() => setJumpTask(null)}
								>
									Close
								</button>
								{jumpTask && (
									<>
										<button
											type="button"
											className="dialog-btn primary"
											onClick={() =>
												void handleTaskJumpChoice(jumpTask.sourcePath)
											}
										>
											Go Source
										</button>
										<button
											type="button"
											className="dialog-btn primary"
											onClick={() =>
												void handleTaskJumpChoice(jumpTask.targetPath)
											}
										>
											Go Target
										</button>
									</>
								)}
							</div>
						</Dialog.Content>
					</Theme>
				</Dialog.Portal>
			</Dialog.Root>
		</>
	);
}
