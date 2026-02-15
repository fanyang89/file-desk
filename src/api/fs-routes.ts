import type { IncomingMessage, ServerResponse } from "http";
import fs from "fs/promises";
import { createReadStream, createWriteStream, existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
import Busboy from "busboy";
import sharp from "sharp";
import { safePath, relPath, getMimeType, isImageFile } from "./fs-utils";

const THUMBNAIL_SIZE = 300;
const THUMBNAIL_CACHE_DIR = path.join(os.tmpdir(), "file-desk-thumbnails");
const THUMBNAIL_CACHE_VERSION = "1";

interface FileEntry {
	name: string;
	path: string;
	isDirectory: boolean;
	size: number;
	modifiedAt: string;
	createdAt: string;
	extension: string;
}

function isTruthyQuery(value: string | null): boolean {
	if (!value) return false;
	const normalized = value.trim().toLowerCase();
	return normalized === "1" || normalized === "true";
}

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
				resolve(JSON.parse(body));
			} catch {
				reject(new Error("Invalid JSON"));
			}
		});
		req.on("error", reject);
	});
}

function normalizeUploadRelativePath(filename: string): string {
	const normalized = filename
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/");

	const segments = normalized.split("/").filter(Boolean);
	if (segments.length === 0) {
		throw new Error("Invalid upload filename");
	}

	for (const segment of segments) {
		if (segment === "." || segment === "..") {
			throw new Error("Invalid upload path");
		}
	}

	return segments.join("/");
}

function createThumbnailEtag(
	absPath: string,
	sourceSize: number,
	sourceMtimeMs: number,
	format: "svg" | "webp",
): string {
	const hash = crypto
		.createHash("sha1")
		.update(
			`${THUMBNAIL_CACHE_VERSION}:${format}:${THUMBNAIL_SIZE}:${absPath}:${sourceSize}:${sourceMtimeMs}`,
		)
		.digest("base64url");

	return `"${hash}"`;
}

function hasMatchingEtag(
	ifNoneMatch: string | undefined,
	etag: string,
): boolean {
	if (!ifNoneMatch) {
		return false;
	}

	if (ifNoneMatch.trim() === "*") {
		return true;
	}

	return ifNoneMatch
		.split(",")
		.map((token) => token.trim())
		.includes(etag);
}

function hasNotBeenModified(
	ifModifiedSince: string | undefined,
	sourceMtimeMs: number,
): boolean {
	if (!ifModifiedSince) {
		return false;
	}

	const modifiedSinceMs = Date.parse(ifModifiedSince);
	if (Number.isNaN(modifiedSinceMs)) {
		return false;
	}

	return Math.floor(sourceMtimeMs / 1000) <= Math.floor(modifiedSinceMs / 1000);
}

async function toFileEntry(
	fullPath: string,
	name: string,
	isDirectory: boolean,
): Promise<FileEntry> {
	const stat = await fs.stat(fullPath);
	return {
		name,
		path: relPath(fullPath),
		isDirectory,
		size: stat.size,
		modifiedAt: stat.mtime.toISOString(),
		createdAt: stat.birthtime.toISOString(),
		extension: isDirectory ? "" : path.extname(name).slice(1).toLowerCase(),
	};
}

async function collectRecursiveEntries(
	baseAbsPath: string,
	imagesOnly: boolean,
): Promise<FileEntry[]> {
	const files: FileEntry[] = [];

	const walk = async (dirPath: string): Promise<void> => {
		const entries = await fs.readdir(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;

			const fullPath = path.join(dirPath, entry.name);
			if (entry.isDirectory()) {
				if (!imagesOnly) {
					files.push(await toFileEntry(fullPath, entry.name, true));
				}
				await walk(fullPath);
				continue;
			}

			const extension = path.extname(entry.name).slice(1).toLowerCase();
			if (imagesOnly && !isImageFile(extension)) {
				continue;
			}

			files.push(await toFileEntry(fullPath, entry.name, false));
		}
	};

	await walk(baseAbsPath);
	return files;
}

export async function handleListFiles(
	req: IncomingMessage,
	res: ServerResponse,
) {
	try {
		const url = new URL(req.url!, `http://${req.headers.host}`);
		const dirPath = url.searchParams.get("path") || "";
		const recursive = isTruthyQuery(url.searchParams.get("recursive"));
		const imagesOnly = isTruthyQuery(url.searchParams.get("imagesOnly"));
		const absPath = safePath(dirPath);

		let files: FileEntry[];
		if (recursive) {
			files = await collectRecursiveEntries(absPath, imagesOnly);
		} else {
			const entries = await fs.readdir(absPath, { withFileTypes: true });
			const immediateEntries = await Promise.all(
				entries
					.filter((e) => !e.name.startsWith("."))
					.map((entry) =>
						toFileEntry(
							path.join(absPath, entry.name),
							entry.name,
							entry.isDirectory(),
						),
					),
			);
			files = imagesOnly
				? immediateEntries.filter(
						(e) => !e.isDirectory && isImageFile(e.extension),
					)
				: immediateEntries;
		}

		sendJson(res, { files, currentPath: dirPath });
	} catch (err) {
		sendError(res, (err as Error).message, 500);
	}
}

export async function handleMkdir(req: IncomingMessage, res: ServerResponse) {
	try {
		const body = (await parseBody(req)) as { path: string; name: string };
		const dirPath = safePath(path.join(body.path || "", body.name));
		await fs.mkdir(dirPath, { recursive: true });
		sendJson(res, { success: true });
	} catch (err) {
		sendError(res, (err as Error).message, 500);
	}
}

export async function handleRename(req: IncomingMessage, res: ServerResponse) {
	try {
		const body = (await parseBody(req)) as {
			path: string;
			oldName: string;
			newName: string;
		};
		const oldPath = safePath(path.join(body.path || "", body.oldName));
		const newPath = safePath(path.join(body.path || "", body.newName));
		await fs.rename(oldPath, newPath);
		sendJson(res, { success: true });
	} catch (err) {
		sendError(res, (err as Error).message, 500);
	}
}

export async function handleDelete(req: IncomingMessage, res: ServerResponse) {
	try {
		const body = (await parseBody(req)) as { path: string; name: string };
		const target = safePath(path.join(body.path || "", body.name));
		const stat = await fs.stat(target);
		if (stat.isDirectory()) {
			await fs.rm(target, { recursive: true });
		} else {
			await fs.unlink(target);
		}
		sendJson(res, { success: true });
	} catch (err) {
		sendError(res, (err as Error).message, 500);
	}
}

export async function handleUpload(req: IncomingMessage, res: ServerResponse) {
	try {
		const url = new URL(req.url!, `http://${req.headers.host}`);
		const dirPath = url.searchParams.get("path") || "";
		const absDir = safePath(dirPath);

		const busboy = Busboy({ headers: req.headers as Record<string, string> });
		const uploads: string[] = [];
		const writePromises: Array<Promise<void>> = [];
		let responded = false;

		const respondError = (message: string, status = 500) => {
			if (responded) return;
			responded = true;
			sendError(res, message, status);
		};

		busboy.on(
			"file",
			(
				_fieldname: string,
				file: NodeJS.ReadableStream,
				info: { filename: string },
			) => {
				let relativePath = "";
				try {
					relativePath = normalizeUploadRelativePath(info.filename);
				} catch (err) {
					file.resume();
					respondError((err as Error).message, 400);
					return;
				}

				const writePromise = (async () => {
					const savePath = safePath(path.join(dirPath, relativePath));
					if (!(savePath === absDir || savePath.startsWith(`${absDir}${path.sep}`))) {
						throw new Error("Invalid upload path");
					}

					await fs.mkdir(path.dirname(savePath), { recursive: true });
					await new Promise<void>((resolve, reject) => {
						const writeStream = createWriteStream(savePath);

						writeStream.on("error", reject);
						writeStream.on("finish", resolve);
						file.on("error", reject);

						file.pipe(writeStream);
					});
				})();

				writePromises.push(writePromise);
				uploads.push(relativePath);
			},
		);

		busboy.on("finish", () => {
			void (async () => {
				if (responded) return;
				try {
					await Promise.all(writePromises);
					if (responded) return;
					responded = true;
					sendJson(res, { success: true, files: uploads });
				} catch (err) {
					respondError((err as Error).message, 500);
				}
			})();
		});

		busboy.on("error", (err: Error) => {
			respondError(err.message, 500);
		});

		req.pipe(busboy);
	} catch (err) {
		sendError(res, (err as Error).message, 500);
	}
}

export async function handleDownload(
	req: IncomingMessage,
	res: ServerResponse,
) {
	try {
		const url = new URL(req.url!, `http://${req.headers.host}`);
		const filePath = url.searchParams.get("path") || "";
		const absPath = safePath(filePath);

		const stat = await fs.stat(absPath);
		if (stat.isDirectory()) {
			sendError(res, "Cannot download a directory", 400);
			return;
		}

		const fileName = path.basename(absPath);
		const mimeType = getMimeType(absPath);

		res.writeHead(200, {
			"Content-Type": mimeType,
			"Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
			"Content-Length": stat.size,
		});

		const stream = createReadStream(absPath);
		stream.pipe(res);
	} catch (err) {
		sendError(res, (err as Error).message, 500);
	}
}

export async function handlePreview(req: IncomingMessage, res: ServerResponse) {
	try {
		const url = new URL(req.url!, `http://${req.headers.host}`);
		const filePath = url.searchParams.get("path") || "";
		const absPath = safePath(filePath);

		const stat = await fs.stat(absPath);
		if (stat.isDirectory()) {
			sendError(res, "Cannot preview a directory", 400);
			return;
		}

		const fileName = path.basename(absPath);
		const mimeType = getMimeType(absPath);

		res.writeHead(200, {
			"Content-Type": mimeType,
			"Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
			"Content-Length": stat.size,
		});

		const stream = createReadStream(absPath);
		stream.pipe(res);
	} catch (err) {
		sendError(res, (err as Error).message, 500);
	}
}

export async function handleThumbnail(
	req: IncomingMessage,
	res: ServerResponse,
) {
	try {
		const url = new URL(req.url!, `http://${req.headers.host}`);
		const filePath = url.searchParams.get("path") || "";
		const absPath = safePath(filePath);

		const ext = path.extname(absPath).slice(1).toLowerCase();
		if (!isImageFile(ext)) {
			sendError(res, "Not an image file", 400);
			return;
		}

		const stat = await fs.stat(absPath);
		if (stat.isDirectory()) {
			sendError(res, "Cannot get thumbnail of a directory", 400);
			return;
		}

		const sourceMtimeMs = stat.mtime.getTime();
		const sourceLastModified = stat.mtime.toUTCString();
		const hasVersionToken = url.searchParams.has("v");
		const cacheControl = hasVersionToken
			? "public, max-age=86400, immutable"
			: "public, max-age=0, must-revalidate";

		// SVG files don't need resizing
		if (ext === "svg") {
			const etag = createThumbnailEtag(
				absPath,
				stat.size,
				sourceMtimeMs,
				"svg",
			);
			if (
				hasMatchingEtag(req.headers["if-none-match"], etag) ||
				hasNotBeenModified(req.headers["if-modified-since"], sourceMtimeMs)
			) {
				res.writeHead(304, {
					"Cache-Control": cacheControl,
					ETag: etag,
					"Last-Modified": sourceLastModified,
				});
				res.end();
				return;
			}

			res.writeHead(200, {
				"Content-Type": "image/svg+xml",
				"Content-Length": stat.size,
				"Cache-Control": cacheControl,
				ETag: etag,
				"Last-Modified": sourceLastModified,
			});
			createReadStream(absPath).pipe(res);
			return;
		}

		// Generate cache key from path and mtime
		const cacheKey = crypto
			.createHash("md5")
			.update(`${absPath}:${stat.mtime.getTime()}`)
			.digest("hex");
		const cachePath = path.join(THUMBNAIL_CACHE_DIR, `${cacheKey}.webp`);

		// Ensure cache directory exists
		if (!existsSync(THUMBNAIL_CACHE_DIR)) {
			await fs.mkdir(THUMBNAIL_CACHE_DIR, { recursive: true });
		}

		// Generate thumbnail if not cached
		if (!existsSync(cachePath)) {
			await sharp(absPath)
				.resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
					fit: "cover",
					position: "center",
				})
				.webp({ quality: 80 })
				.toFile(cachePath);
		}

		const cacheStat = await fs.stat(cachePath);
		const etag = createThumbnailEtag(absPath, stat.size, sourceMtimeMs, "webp");

		if (
			hasMatchingEtag(req.headers["if-none-match"], etag) ||
			hasNotBeenModified(req.headers["if-modified-since"], sourceMtimeMs)
		) {
			res.writeHead(304, {
				"Cache-Control": cacheControl,
				ETag: etag,
				"Last-Modified": sourceLastModified,
			});
			res.end();
			return;
		}

		res.writeHead(200, {
			"Content-Type": "image/webp",
			"Content-Length": cacheStat.size,
			"Cache-Control": cacheControl,
			ETag: etag,
			"Last-Modified": sourceLastModified,
		});

		createReadStream(cachePath).pipe(res);
	} catch (err) {
		sendError(res, (err as Error).message, 500);
	}
}
