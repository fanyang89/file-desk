function normalizePath(inputPath: string): string {
	return inputPath
		.replace(/\\/g, '/')
		.replace(/^\/+/, '')
		.replace(/\/+$/, '')
}

export const TRASH_ROOT_PATH = '.file-desk-trash'
export const TRASH_FILES_PATH = `${TRASH_ROOT_PATH}/files`

export function isTrashPath(inputPath: string): boolean {
	const normalizedPath = normalizePath(inputPath)
	return (
		normalizedPath === TRASH_ROOT_PATH ||
		normalizedPath.startsWith(`${TRASH_ROOT_PATH}/`)
	)
}

export function isTrashFilesPath(inputPath: string): boolean {
	const normalizedPath = normalizePath(inputPath)
	return (
		normalizedPath === TRASH_FILES_PATH ||
		normalizedPath.startsWith(`${TRASH_FILES_PATH}/`)
	)
}
