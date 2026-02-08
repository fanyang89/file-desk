interface FileEntry {
	name: string;
	path: string;
	isDirectory: boolean;
	size: number;
	modifiedAt: string;
	createdAt: string;
	extension: string;
}

const DEMO_FILES: Record<string, FileEntry[]> = {
	"": [
		{
			name: "Documents",
			path: "Documents",
			isDirectory: true,
			size: 0,
			modifiedAt: "2026-02-08T10:00:00Z",
			createdAt: "2026-01-01T00:00:00Z",
			extension: "",
		},
		{
			name: "Images",
			path: "Images",
			isDirectory: true,
			size: 0,
			modifiedAt: "2026-02-07T15:30:00Z",
			createdAt: "2026-01-01T00:00:00Z",
			extension: "",
		},
		{
			name: "Projects",
			path: "Projects",
			isDirectory: true,
			size: 0,
			modifiedAt: "2026-02-08T09:00:00Z",
			createdAt: "2026-01-15T00:00:00Z",
			extension: "",
		},
		{
			name: "README.md",
			path: "README.md",
			isDirectory: false,
			size: 2048,
			modifiedAt: "2026-02-08T08:00:00Z",
			createdAt: "2026-01-01T00:00:00Z",
			extension: "md",
		},
		{
			name: "package.json",
			path: "package.json",
			isDirectory: false,
			size: 1024,
			modifiedAt: "2026-02-07T12:00:00Z",
			createdAt: "2026-01-01T00:00:00Z",
			extension: "json",
		},
		{
			name: "notes.txt",
			path: "notes.txt",
			isDirectory: false,
			size: 512,
			modifiedAt: "2026-02-06T18:00:00Z",
			createdAt: "2026-02-01T00:00:00Z",
			extension: "txt",
		},
	],
	Documents: [
		{
			name: "report.pdf",
			path: "Documents/report.pdf",
			isDirectory: false,
			size: 102400,
			modifiedAt: "2026-02-05T14:00:00Z",
			createdAt: "2026-02-01T00:00:00Z",
			extension: "pdf",
		},
		{
			name: "presentation.md",
			path: "Documents/presentation.md",
			isDirectory: false,
			size: 4096,
			modifiedAt: "2026-02-04T10:00:00Z",
			createdAt: "2026-01-20T00:00:00Z",
			extension: "md",
		},
		{
			name: "budget.csv",
			path: "Documents/budget.csv",
			isDirectory: false,
			size: 2048,
			modifiedAt: "2026-02-03T16:00:00Z",
			createdAt: "2026-01-15T00:00:00Z",
			extension: "csv",
		},
	],
	Images: [
		{
			name: "photo1.jpg",
			path: "Images/photo1.jpg",
			isDirectory: false,
			size: 2048000,
			modifiedAt: "2026-02-07T15:30:00Z",
			createdAt: "2026-02-07T15:30:00Z",
			extension: "jpg",
		},
		{
			name: "screenshot.png",
			path: "Images/screenshot.png",
			isDirectory: false,
			size: 512000,
			modifiedAt: "2026-02-06T12:00:00Z",
			createdAt: "2026-02-06T12:00:00Z",
			extension: "png",
		},
		{
			name: "logo.svg",
			path: "Images/logo.svg",
			isDirectory: false,
			size: 4096,
			modifiedAt: "2026-02-01T09:00:00Z",
			createdAt: "2026-02-01T09:00:00Z",
			extension: "svg",
		},
	],
	Projects: [
		{
			name: "web-app",
			path: "Projects/web-app",
			isDirectory: true,
			size: 0,
			modifiedAt: "2026-02-08T09:00:00Z",
			createdAt: "2026-01-15T00:00:00Z",
			extension: "",
		},
		{
			name: "api-server",
			path: "Projects/api-server",
			isDirectory: true,
			size: 0,
			modifiedAt: "2026-02-07T18:00:00Z",
			createdAt: "2026-01-20T00:00:00Z",
			extension: "",
		},
	],
	"Projects/web-app": [
		{
			name: "src",
			path: "Projects/web-app/src",
			isDirectory: true,
			size: 0,
			modifiedAt: "2026-02-08T09:00:00Z",
			createdAt: "2026-01-15T00:00:00Z",
			extension: "",
		},
		{
			name: "package.json",
			path: "Projects/web-app/package.json",
			isDirectory: false,
			size: 1536,
			modifiedAt: "2026-02-08T08:30:00Z",
			createdAt: "2026-01-15T00:00:00Z",
			extension: "json",
		},
		{
			name: "tsconfig.json",
			path: "Projects/web-app/tsconfig.json",
			isDirectory: false,
			size: 512,
			modifiedAt: "2026-01-15T10:00:00Z",
			createdAt: "2026-01-15T00:00:00Z",
			extension: "json",
		},
	],
	"Projects/web-app/src": [
		{
			name: "index.ts",
			path: "Projects/web-app/src/index.ts",
			isDirectory: false,
			size: 2048,
			modifiedAt: "2026-02-08T09:00:00Z",
			createdAt: "2026-01-15T00:00:00Z",
			extension: "ts",
		},
		{
			name: "App.tsx",
			path: "Projects/web-app/src/App.tsx",
			isDirectory: false,
			size: 3072,
			modifiedAt: "2026-02-07T16:00:00Z",
			createdAt: "2026-01-15T00:00:00Z",
			extension: "tsx",
		},
		{
			name: "styles.css",
			path: "Projects/web-app/src/styles.css",
			isDirectory: false,
			size: 1024,
			modifiedAt: "2026-02-06T14:00:00Z",
			createdAt: "2026-01-15T00:00:00Z",
			extension: "css",
		},
	],
	"Projects/api-server": [
		{
			name: "main.go",
			path: "Projects/api-server/main.go",
			isDirectory: false,
			size: 4096,
			modifiedAt: "2026-02-07T18:00:00Z",
			createdAt: "2026-01-20T00:00:00Z",
			extension: "go",
		},
		{
			name: "go.mod",
			path: "Projects/api-server/go.mod",
			isDirectory: false,
			size: 256,
			modifiedAt: "2026-01-20T10:00:00Z",
			createdAt: "2026-01-20T00:00:00Z",
			extension: "mod",
		},
	],
};

export default function handler(req: Request): Response {
	const url = new URL(req.url);
	const dirPath = url.searchParams.get("path") || "";

	const files = DEMO_FILES[dirPath] || [];

	return Response.json({ files, currentPath: dirPath });
}
