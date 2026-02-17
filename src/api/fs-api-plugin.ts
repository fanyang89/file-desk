import type { Plugin } from "vite";
import {
	handleListFiles,
	handleMkdir,
	handleRename,
	handleDelete,
	handleUpload,
	handleDownload,
	handlePreview,
	handleThumbnail,
} from "./fs-routes";
import {
	handleCancelTask,
	handleClearCompletedTasks,
	handleCreateCopyMoveTask,
	handleGetTask,
	handleListTasks,
} from "./task-routes";
import { startTaskRuntime } from "./task-service";

export function fsApiPlugin(): Plugin {
	return {
		name: "fs-api",
		configureServer(server) {
			void startTaskRuntime().catch((err) => {
				console.error("[fs-api] Failed to start task runtime", err);
			});

			server.middlewares.use((req, res, next) => {
				const url = req.url || "";
				const pathname = url.split("?")[0];

				if (pathname.startsWith("/api/files")) {
					handleListFiles(req, res);
				} else if (pathname === "/api/mkdir" && req.method === "POST") {
					handleMkdir(req, res);
				} else if (pathname === "/api/rename" && req.method === "POST") {
					handleRename(req, res);
				} else if (pathname === "/api/delete" && req.method === "DELETE") {
					handleDelete(req, res);
				} else if (
					pathname.startsWith("/api/upload") &&
					req.method === "POST"
				) {
					handleUpload(req, res);
				} else if (pathname.startsWith("/api/preview")) {
					handlePreview(req, res);
				} else if (pathname.startsWith("/api/download")) {
					handleDownload(req, res);
				} else if (pathname.startsWith("/api/thumbnail")) {
					handleThumbnail(req, res);
				} else if (
					pathname === "/api/tasks/copy-move" &&
					req.method === "POST"
				) {
					handleCreateCopyMoveTask(req, res);
				} else if (pathname === "/api/tasks" && req.method === "GET") {
					handleListTasks(req, res);
				} else if (
					pathname === "/api/tasks/completed" &&
					req.method === "DELETE"
				) {
					handleClearCompletedTasks(req, res);
				} else if (
					/^\/api\/tasks\/[^/]+\/cancel$/.test(pathname) &&
					req.method === "POST"
				) {
					handleCancelTask(req, res);
				} else if (
					/^\/api\/tasks\/[^/]+$/.test(pathname) &&
					req.method === "GET"
				) {
					handleGetTask(req, res);
				} else {
					next();
				}
			});
		},
	};
}
