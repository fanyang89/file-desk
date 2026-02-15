export interface FileEntry {
	name: string;
	path: string;
	isDirectory: boolean;
	size: number;
	modifiedAt: string;
	createdAt: string;
	extension: string;
}

export type ViewMode = 'list' | 'grid' | 'photo';

export type SortField = 'name' | 'size' | 'modifiedAt';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
	field: SortField;
	direction: SortDirection;
}

export interface DirPair {
	id: string;
	name: string;
	leftPath: string;
	rightPath: string;
}

export type TaskOperation = 'copy' | 'move';

export type TaskStatus =
	| 'queued'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled'
	| 'interrupted';

export interface BackgroundTask {
	id: string;
	type: 'copy_move';
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
