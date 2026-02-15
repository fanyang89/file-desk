export interface FileEntry {
	name: string;
	path: string;
	isDirectory: boolean;
	size: number;
	modifiedAt: string;
	createdAt: string;
	extension: string;
}

export type ViewMode = "list" | "grid" | "photo";

export type SortField = "name" | "size" | "modifiedAt";

export type SortDirection = "asc" | "desc";

export interface SortConfig {
	field: SortField;
	direction: SortDirection;
}

export interface Tab {
	id: string;
	path: string;
	entries: FileEntry[];
	loading: boolean;
	error: string | null;
}

export interface DirPair {
	id: string;
	name: string;
	leftPath: string;
	rightPath: string;
}
