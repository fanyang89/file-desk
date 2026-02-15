import { createContext, createElement, useContext, type ReactNode } from 'react'
import { create } from 'zustand'
import type { DirPair, FileEntry, ViewMode, SortConfig } from '@/types'
import { listFiles } from '@/lib/api-client'

function generateId(): string {
	return Math.random().toString(36).substring(2, 9)
}

function generateDirPairId(): string {
	return `pair-${generateId()}`
}

const DIR_PAIRS_STORAGE_KEY = 'file-desk.dir-pairs.v1'

interface DirPairStorageState {
	dirPairs: DirPair[]
	activeDirPairId: string | null
}

function canUseLocalStorage(): boolean {
	return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isDirPairLike(value: unknown): value is DirPair {
	if (!value || typeof value !== 'object') return false
	const pair = value as Partial<DirPair>
	return (
		typeof pair.id === 'string' &&
		typeof pair.name === 'string' &&
		typeof pair.leftPath === 'string' &&
		typeof pair.rightPath === 'string'
	)
}

function readDirPairStorageState(): DirPairStorageState {
	if (!canUseLocalStorage()) {
		return { dirPairs: [], activeDirPairId: null }
	}

	try {
		const rawValue = window.localStorage.getItem(DIR_PAIRS_STORAGE_KEY)
		if (!rawValue) {
			return { dirPairs: [], activeDirPairId: null }
		}

		const parsed = JSON.parse(rawValue) as Partial<DirPairStorageState>
		const dirPairs = Array.isArray(parsed.dirPairs)
			? parsed.dirPairs.filter(isDirPairLike)
			: []
		const activeDirPairId =
			typeof parsed.activeDirPairId === 'string' &&
			dirPairs.some((pair) => pair.id === parsed.activeDirPairId)
				? parsed.activeDirPairId
				: null

		return { dirPairs, activeDirPairId }
	} catch {
		return { dirPairs: [], activeDirPairId: null }
	}
}

function writeDirPairStorageState(
	dirPairs: DirPair[],
	activeDirPairId: string | null,
): void {
	if (!canUseLocalStorage()) return

	try {
		window.localStorage.setItem(
			DIR_PAIRS_STORAGE_KEY,
			JSON.stringify({ dirPairs, activeDirPairId }),
		)
	} catch {
		// Ignore storage write failures
	}
}

export type PaneId = 'left' | 'right'

interface PaneState {
	path: string
	entries: FileEntry[]
	loading: boolean
	error: string | null
	viewMode: ViewMode
	sort: SortConfig
	selectedPaths: Set<string>
}

export interface FileStore {
	path: string
	entries: FileEntry[]
	loading: boolean
	error: string | null
	viewMode: ViewMode
	sort: SortConfig
	selectedPaths: Set<string>
	previewFile: FileEntry | null
	activePaneId: PaneId
	dirPairs: DirPair[]
	activeDirPairId: string | null

	navigate: (path: string) => Promise<void>
	refresh: () => Promise<void>
	setViewMode: (mode: ViewMode) => void
	setSort: (sort: SortConfig) => void
	toggleSelection: (path: string, multi: boolean) => void
	selectAll: () => void
	clearSelection: () => void
	setSelectedPaths: (paths: Set<string>) => void
	openPreview: (entry: FileEntry) => void
	closePreview: () => void
	setActivePane: (paneId: PaneId) => void
	createDirPair: (leftPath: string, rightPath: string) => void
	createEmptyDirPair: () => Promise<void>
	switchDirPair: (id: string) => Promise<void>
	renameDirPair: (id: string, name: string) => void
	deleteDirPair: (id: string) => void
}

interface FileStoreState {
	panes: Record<PaneId, PaneState>
	activePaneId: PaneId
	previewFile: FileEntry | null
	dirPairs: DirPair[]
	activeDirPairId: string | null

	navigate: (path: string, paneId?: PaneId) => Promise<void>
	refresh: (paneId?: PaneId) => Promise<void>
	setViewMode: (mode: ViewMode, paneId?: PaneId) => void
	setSort: (sort: SortConfig, paneId?: PaneId) => void
	toggleSelection: (path: string, multi: boolean, paneId?: PaneId) => void
	selectAll: (paneId?: PaneId) => void
	clearSelection: (paneId?: PaneId) => void
	setSelectedPaths: (paths: Set<string>, paneId?: PaneId) => void
	openPreview: (entry: FileEntry) => void
	closePreview: () => void
	setActivePane: (paneId: PaneId) => void
	createDirPair: (leftPath: string, rightPath: string) => void
	createEmptyDirPair: () => Promise<void>
	switchDirPair: (id: string) => Promise<void>
	renameDirPair: (id: string, name: string) => void
	deleteDirPair: (id: string) => void
}

function sortEntries(entries: FileEntry[], sort: SortConfig): FileEntry[] {
	const dirs = entries.filter((e) => e.isDirectory)
	const files = entries.filter((e) => !e.isDirectory)

	const comparator = (a: FileEntry, b: FileEntry): number => {
		let result: number
		switch (sort.field) {
			case 'name':
				result = a.name.localeCompare(b.name, undefined, {
					sensitivity: "base",
				})
				break
			case 'size':
				result = a.size - b.size
				break
			case 'modifiedAt':
				result =
					new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
				break
			default:
				result = 0
		}
		return sort.direction === 'asc' ? result : -result
	}

	dirs.sort(comparator)
	files.sort(comparator)

	return [...dirs, ...files]
}

interface ScopedActions {
	navigate: (path: string) => Promise<void>
	refresh: () => Promise<void>
	setViewMode: (mode: ViewMode) => void
	setSort: (sort: SortConfig) => void
	toggleSelection: (path: string, multi: boolean) => void
	selectAll: () => void
	clearSelection: () => void
	setSelectedPaths: (paths: Set<string>) => void
	openPreview: (entry: FileEntry) => void
	closePreview: () => void
	setActivePane: (paneId: PaneId) => void
	createDirPair: (leftPath: string, rightPath: string) => void
	createEmptyDirPair: () => Promise<void>
	switchDirPair: (id: string) => Promise<void>
	renameDirPair: (id: string, name: string) => void
	deleteDirPair: (id: string) => void
}

function createInitialPaneState(initialPath = ''): PaneState {
	return {
		path: initialPath,
		entries: [],
		loading: false,
		error: null,
		viewMode: 'list',
		sort: { field: 'name', direction: 'asc' },
		selectedPaths: new Set(),
	}
}

function resolvePaneId(state: FileStoreState, paneId?: PaneId): PaneId {
	return paneId ?? state.activePaneId
}

const initialDirPairStorageState = readDirPairStorageState()
const initialActiveDirPair =
	initialDirPairStorageState.activeDirPairId === null
		? null
		: initialDirPairStorageState.dirPairs.find(
				(pair) => pair.id === initialDirPairStorageState.activeDirPairId,
		  ) ?? null

const useFileStoreBase = create<FileStoreState>((set, get) => ({
	panes: {
		left: createInitialPaneState(initialActiveDirPair?.leftPath ?? ''),
		right: createInitialPaneState(initialActiveDirPair?.rightPath ?? ''),
	},
	activePaneId: 'left',
	previewFile: null,
	dirPairs: initialDirPairStorageState.dirPairs,
	activeDirPairId: initialActiveDirPair?.id ?? null,

	navigate: async (path, paneId) => {
		const resolvedPaneId = resolvePaneId(get(), paneId)

		set((state) => {
			const currentPane = state.panes[resolvedPaneId]
			return {
				panes: {
					...state.panes,
					[resolvedPaneId]: {
						...currentPane,
						loading: true,
						error: null,
						selectedPaths: new Set(),
					},
				},
			}
		})

		try {
			const res = await listFiles(path)
			set((state) => {
				const currentPane = state.panes[resolvedPaneId]
				return {
					panes: {
						...state.panes,
						[resolvedPaneId]: {
							...currentPane,
							path,
							entries: sortEntries(res.files, currentPane.sort),
							loading: false,
							error: null,
						},
					},
				}
			})
		} catch (err) {
			set((state) => {
				const currentPane = state.panes[resolvedPaneId]
				return {
					panes: {
						...state.panes,
						[resolvedPaneId]: {
							...currentPane,
							loading: false,
							error: (err as Error).message,
						},
					},
				}
			})
		}
	},

	refresh: async (paneId) => {
		const resolvedPaneId = resolvePaneId(get(), paneId)
		const pane = get().panes[resolvedPaneId]
		await get().navigate(pane.path, resolvedPaneId)
	},

	setViewMode: (mode, paneId) => {
		const resolvedPaneId = resolvePaneId(get(), paneId)
		set((state) => {
			const pane = state.panes[resolvedPaneId]
			return {
				panes: {
					...state.panes,
					[resolvedPaneId]: {
						...pane,
						viewMode: mode,
					},
				},
			}
		})
	},

	setSort: (sort, paneId) => {
		const resolvedPaneId = resolvePaneId(get(), paneId)
		set((state) => {
			const pane = state.panes[resolvedPaneId]
			return {
				panes: {
					...state.panes,
					[resolvedPaneId]: {
						...pane,
						sort,
						entries: sortEntries([...pane.entries], sort),
					},
				},
			}
		})
	},

	toggleSelection: (path, multi, paneId) => {
		const resolvedPaneId = resolvePaneId(get(), paneId)
		const selectedPaths = get().panes[resolvedPaneId].selectedPaths
		const next = new Set(multi ? selectedPaths : [])
		if (next.has(path)) {
			next.delete(path)
		} else {
			next.add(path)
		}

		set((state) => {
			const pane = state.panes[resolvedPaneId]
			return {
				panes: {
					...state.panes,
					[resolvedPaneId]: {
						...pane,
						selectedPaths: next,
					},
				},
			}
		})
	},

	selectAll: (paneId) => {
		const resolvedPaneId = resolvePaneId(get(), paneId)
		const pane = get().panes[resolvedPaneId]

		set((state) => {
			const currentPane = state.panes[resolvedPaneId]
			return {
				panes: {
					...state.panes,
					[resolvedPaneId]: {
						...currentPane,
						selectedPaths: new Set(pane.entries.map((entry) => entry.path)),
					},
				},
			}
		})
	},

	clearSelection: (paneId) => {
		const resolvedPaneId = resolvePaneId(get(), paneId)
		set((state) => {
			const pane = state.panes[resolvedPaneId]
			return {
				panes: {
					...state.panes,
					[resolvedPaneId]: {
						...pane,
						selectedPaths: new Set(),
					},
				},
			}
		})
	},

	setSelectedPaths: (paths, paneId) => {
		const resolvedPaneId = resolvePaneId(get(), paneId)
		set((state) => {
			const pane = state.panes[resolvedPaneId]
			return {
				panes: {
					...state.panes,
					[resolvedPaneId]: {
						...pane,
						selectedPaths: paths,
					},
				},
			}
		})
	},

	openPreview: (entry) => set({ previewFile: entry }),
	closePreview: () => set({ previewFile: null }),
	setActivePane: (paneId) => set({ activePaneId: paneId }),
	createDirPair: (leftPath, rightPath) => {
		const id = generateDirPairId()
		const newDirPair: DirPair = {
			id,
			name: id,
			leftPath,
			rightPath,
		}

		set((state) => {
			const dirPairs = [...state.dirPairs, newDirPair]
			writeDirPairStorageState(dirPairs, newDirPair.id)
			return {
				dirPairs,
				activeDirPairId: newDirPair.id,
			}
		})
	},
	createEmptyDirPair: async () => {
		const id = generateDirPairId()
		const newDirPair: DirPair = {
			id,
			name: id,
			leftPath: '',
			rightPath: '',
		}

		set((state) => {
			const dirPairs = [...state.dirPairs, newDirPair]
			writeDirPairStorageState(dirPairs, newDirPair.id)
			return {
				dirPairs,
				activeDirPairId: newDirPair.id,
			}
		})

		await Promise.all([get().navigate('', 'left'), get().navigate('', 'right')])
	},
	switchDirPair: async (id) => {
		const state = get()
		const dirPair = state.dirPairs.find((pair) => pair.id === id)
		if (!dirPair) return

		set((currentState) => {
			if (currentState.activeDirPairId === id) {
				writeDirPairStorageState(currentState.dirPairs, currentState.activeDirPairId)
				return currentState
			}

			writeDirPairStorageState(currentState.dirPairs, id)
			return { activeDirPairId: id }
		})

		await Promise.all([
			get().navigate(dirPair.leftPath, 'left'),
			get().navigate(dirPair.rightPath, 'right'),
		])
	},
	renameDirPair: (id, name) => {
		const trimmedName = name.trim()
		if (!trimmedName) return

		set((state) => {
			const existingDirPair = state.dirPairs.find((pair) => pair.id === id)
			if (!existingDirPair) return state

			const dirPairs = state.dirPairs.map((pair) =>
				pair.id === id ? { ...pair, name: trimmedName } : pair,
			)
			writeDirPairStorageState(dirPairs, state.activeDirPairId)
			return { dirPairs }
		})
	},
	deleteDirPair: (id) => {
		set((state) => {
			const dirPairs = state.dirPairs.filter((pair) => pair.id !== id)
			if (dirPairs.length === state.dirPairs.length) return state

			const activeDirPairId =
				state.activeDirPairId === id ? null : state.activeDirPairId
			writeDirPairStorageState(dirPairs, activeDirPairId)
			return {
				dirPairs,
				activeDirPairId,
			}
		})
	},
}))

const ExplorerPaneContext = createContext<PaneId | null>(null)

export function ExplorerPaneProvider({
	paneId,
	children,
}: {
	paneId: PaneId
	children: ReactNode
}) {
	return createElement(ExplorerPaneContext.Provider, { value: paneId }, children)
}

export function useExplorerPaneId(): PaneId | null {
	return useContext(ExplorerPaneContext)
}

function createScopedActions(paneId: PaneId): ScopedActions {
	return {
		navigate: (path) => useFileStoreBase.getState().navigate(path, paneId),
		refresh: () => useFileStoreBase.getState().refresh(paneId),
		setViewMode: (mode) => useFileStoreBase.getState().setViewMode(mode, paneId),
		setSort: (sort) => useFileStoreBase.getState().setSort(sort, paneId),
		toggleSelection: (path, multi) =>
			useFileStoreBase.getState().toggleSelection(path, multi, paneId),
		selectAll: () => useFileStoreBase.getState().selectAll(paneId),
		clearSelection: () => useFileStoreBase.getState().clearSelection(paneId),
		setSelectedPaths: (paths) =>
			useFileStoreBase.getState().setSelectedPaths(paths, paneId),
		openPreview: (entry) => useFileStoreBase.getState().openPreview(entry),
		closePreview: () => useFileStoreBase.getState().closePreview(),
		setActivePane: (nextPaneId) =>
			useFileStoreBase.getState().setActivePane(nextPaneId),
		createDirPair: (leftPath, rightPath) =>
			useFileStoreBase.getState().createDirPair(leftPath, rightPath),
		createEmptyDirPair: () => useFileStoreBase.getState().createEmptyDirPair(),
		switchDirPair: (id) => useFileStoreBase.getState().switchDirPair(id),
		renameDirPair: (id, name) =>
			useFileStoreBase.getState().renameDirPair(id, name),
		deleteDirPair: (id) => useFileStoreBase.getState().deleteDirPair(id),
	}
}

const scopedActionMap: Record<PaneId, ScopedActions> = {
	left: createScopedActions('left'),
	right: createScopedActions('right'),
}

const scopedStateCache = new WeakMap<
	FileStoreState,
	Partial<Record<PaneId, FileStore>>
>()

function getScopedState(state: FileStoreState, paneId: PaneId): FileStore {
	const cachedPaneStates = scopedStateCache.get(state)
	const cachedScopedState = cachedPaneStates?.[paneId]
	if (cachedScopedState) {
		return cachedScopedState
	}

	const pane = state.panes[paneId]
	const scopedState: FileStore = {
		path: pane.path,
		entries: pane.entries,
		loading: pane.loading,
		error: pane.error,
		viewMode: pane.viewMode,
		sort: pane.sort,
		selectedPaths: pane.selectedPaths,
		previewFile: state.previewFile,
		activePaneId: state.activePaneId,
		dirPairs: state.dirPairs,
		activeDirPairId: state.activeDirPairId,
		...scopedActionMap[paneId],
	}

	if (cachedPaneStates) {
		cachedPaneStates[paneId] = scopedState
	} else {
		scopedStateCache.set(state, { [paneId]: scopedState })
	}

	return scopedState
}

type StoreSelector<T> = (state: FileStore) => T

export function useFileStore(): FileStore
export function useFileStore<T>(selector: StoreSelector<T>): T
export function useFileStore<T>(selector?: StoreSelector<T>) {
	const paneIdFromContext = useContext(ExplorerPaneContext)
	return useFileStoreBase((state) => {
		const paneId = paneIdFromContext ?? state.activePaneId
		const scopedState = getScopedState(state, paneId)
		if (!selector) {
			return scopedState as T
		}
		return selector(scopedState)
	})
}

export function usePanePath(paneId: PaneId): string {
	return useFileStoreBase((state) => state.panes[paneId].path)
}

export function getPaneCurrentPath(paneId: PaneId): string {
	const state = useFileStoreBase.getState()
	const pane = state.panes[paneId]
	return getActiveTab(pane.tabs, pane.activeTabId)?.path ?? ''
}

export function getPaneActiveTabId(paneId: PaneId): string {
	return useFileStoreBase.getState().panes[paneId].activeTabId
}

export async function refreshPaneById(paneId: PaneId): Promise<void> {
	await useFileStoreBase.getState().refresh(paneId)
}

export async function refreshPaneTabById(
	paneId: PaneId,
	tabId: string,
): Promise<void> {
	await useFileStoreBase.getState().refreshTab(tabId, paneId)
}

// Selectors for derived state
export const selectCurrentPath = (state: FileStore): string =>
	state.path

export const selectEntries = (state: FileStore): FileEntry[] =>
	state.entries

export const selectLoading = (state: FileStore): boolean =>
	state.loading

export const selectError = (state: FileStore): string | null =>
	state.error
