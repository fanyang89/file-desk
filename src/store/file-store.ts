import { createContext, createElement, useContext, type ReactNode } from 'react'
import { create } from 'zustand'
import type { FileEntry, ViewMode, SortConfig, Tab } from '@/types'
import { listFiles } from '@/lib/api-client'

function generateId(): string {
	return Math.random().toString(36).substring(2, 9)
}

export type PaneId = 'left' | 'right'

interface PaneState {
	tabs: Tab[]
	activeTabId: string
	viewMode: ViewMode
	sort: SortConfig
	selectedPaths: Set<string>
}

export interface FileStore {
	tabs: Tab[]
	activeTabId: string
	viewMode: ViewMode
	sort: SortConfig
	selectedPaths: Set<string>
	previewFile: FileEntry | null
	activePaneId: PaneId

	addTab: (path?: string) => void
	closeTab: (id: string) => void
	switchTab: (id: string) => void
	navigate: (path: string) => Promise<void>
	refresh: () => Promise<void>
	refreshTab: (tabId: string) => Promise<void>
	setViewMode: (mode: ViewMode) => void
	setSort: (sort: SortConfig) => void
	toggleSelection: (path: string, multi: boolean) => void
	selectAll: () => void
	clearSelection: () => void
	setSelectedPaths: (paths: Set<string>) => void
	openPreview: (entry: FileEntry) => void
	closePreview: () => void
	setActivePane: (paneId: PaneId) => void
}

interface FileStoreState {
	panes: Record<PaneId, PaneState>
	activePaneId: PaneId
	previewFile: FileEntry | null

	addTab: (path?: string, paneId?: PaneId) => void
	closeTab: (id: string, paneId?: PaneId) => void
	switchTab: (id: string, paneId?: PaneId) => void
	navigate: (path: string, paneId?: PaneId) => Promise<void>
	refresh: (paneId?: PaneId) => Promise<void>
	refreshTab: (tabId: string, paneId?: PaneId) => Promise<void>
	setViewMode: (mode: ViewMode, paneId?: PaneId) => void
	setSort: (sort: SortConfig, paneId?: PaneId) => void
	toggleSelection: (path: string, multi: boolean, paneId?: PaneId) => void
	selectAll: (paneId?: PaneId) => void
	clearSelection: (paneId?: PaneId) => void
	setSelectedPaths: (paths: Set<string>, paneId?: PaneId) => void
	openPreview: (entry: FileEntry) => void
	closePreview: () => void
	setActivePane: (paneId: PaneId) => void
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

function getActiveTab(tabs: Tab[], activeTabId: string): Tab | undefined {
	return tabs.find((t) => t.id === activeTabId)
}

interface ScopedActions {
	addTab: (path?: string) => void
	closeTab: (id: string) => void
	switchTab: (id: string) => void
	navigate: (path: string) => Promise<void>
	refresh: () => Promise<void>
	refreshTab: (tabId: string) => Promise<void>
	setViewMode: (mode: ViewMode) => void
	setSort: (sort: SortConfig) => void
	toggleSelection: (path: string, multi: boolean) => void
	selectAll: () => void
	clearSelection: () => void
	setSelectedPaths: (paths: Set<string>) => void
	openPreview: (entry: FileEntry) => void
	closePreview: () => void
	setActivePane: (paneId: PaneId) => void
}

function createInitialPaneState(): PaneState {
	const initialTabId = generateId()
	return {
		tabs: [{ id: initialTabId, path: '', entries: [], loading: false, error: null }],
		activeTabId: initialTabId,
		viewMode: 'list',
		sort: { field: 'name', direction: 'asc' },
		selectedPaths: new Set(),
	}
}

function resolvePaneId(state: FileStoreState, paneId?: PaneId): PaneId {
	return paneId ?? state.activePaneId
}

const useFileStoreBase = create<FileStoreState>((set, get) => ({
	panes: {
		left: createInitialPaneState(),
		right: createInitialPaneState(),
	},
	activePaneId: 'left',
	previewFile: null,

	addTab: (path = '', paneId) => {
		const resolvedPaneId = resolvePaneId(get(), paneId)
		const newTab: Tab = {
			id: generateId(),
			path,
			entries: [],
			loading: false,
			error: null,
		}

		set((state) => {
			const pane = state.panes[resolvedPaneId]
			return {
				activePaneId: resolvedPaneId,
				panes: {
					...state.panes,
					[resolvedPaneId]: {
						...pane,
						tabs: [...pane.tabs, newTab],
						activeTabId: newTab.id,
						selectedPaths: new Set(),
					},
				},
			}
		})

		void get().navigate(path, resolvedPaneId)
	},

	closeTab: (id, paneId) => {
		const resolvedPaneId = resolvePaneId(get(), paneId)
		const pane = get().panes[resolvedPaneId]
		if (pane.tabs.length <= 1) return

		const tabIndex = pane.tabs.findIndex((t) => t.id === id)
		if (tabIndex === -1) return

		const newTabs = pane.tabs.filter((t) => t.id !== id)
		const activeTabChanged = id === pane.activeTabId

		let newActiveTabId = pane.activeTabId
		if (activeTabChanged) {
			const newIndex = tabIndex >= newTabs.length ? newTabs.length - 1 : tabIndex
			newActiveTabId = newTabs[newIndex].id
		}

		set((state) => {
			const currentPane = state.panes[resolvedPaneId]
			return {
				panes: {
					...state.panes,
					[resolvedPaneId]: {
						...currentPane,
						tabs: newTabs,
						activeTabId: newActiveTabId,
						selectedPaths: activeTabChanged
							? new Set()
							: currentPane.selectedPaths,
					},
				},
			}
		})
	},

	switchTab: (id, paneId) => {
		const resolvedPaneId = resolvePaneId(get(), paneId)
		const pane = get().panes[resolvedPaneId]
		if (id === pane.activeTabId) return
		if (!pane.tabs.find((t) => t.id === id)) return

		set((state) => {
			const currentPane = state.panes[resolvedPaneId]
			return {
				activePaneId: resolvedPaneId,
				panes: {
					...state.panes,
					[resolvedPaneId]: {
						...currentPane,
						activeTabId: id,
						selectedPaths: new Set(),
					},
				},
			}
		})
	},

	navigate: async (path, paneId) => {
		const resolvedPaneId = resolvePaneId(get(), paneId)
		const pane = get().panes[resolvedPaneId]
		const targetTabId = pane.activeTabId

		set((state) => {
			const currentPane = state.panes[resolvedPaneId]
			return {
				activePaneId: resolvedPaneId,
				panes: {
					...state.panes,
					[resolvedPaneId]: {
						...currentPane,
						tabs: currentPane.tabs.map((t) =>
							t.id === targetTabId ? { ...t, loading: true, error: null } : t,
						),
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
							tabs: currentPane.tabs.map((t) =>
								t.id === targetTabId
									? {
											...t,
											path,
											entries: sortEntries(res.files, currentPane.sort),
											loading: false,
										}
									: t,
							),
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
							tabs: currentPane.tabs.map((t) =>
								t.id === targetTabId
									? { ...t, loading: false, error: (err as Error).message }
									: t,
							),
						},
					},
				}
			})
		}
	},

	refresh: async (paneId) => {
		const resolvedPaneId = resolvePaneId(get(), paneId)
		const pane = get().panes[resolvedPaneId]
		await get().refreshTab(pane.activeTabId, resolvedPaneId)
	},

	refreshTab: async (tabId, paneId) => {
		const resolvedPaneId = resolvePaneId(get(), paneId)
		const pane = get().panes[resolvedPaneId]
		const tab = pane.tabs.find((t) => t.id === tabId)
		if (!tab) return

		const targetPath = tab.path

		set((state) => {
			const currentPane = state.panes[resolvedPaneId]
			return {
				panes: {
					...state.panes,
					[resolvedPaneId]: {
						...currentPane,
						tabs: currentPane.tabs.map((t) =>
							t.id === tabId ? { ...t, loading: true, error: null } : t,
						),
					},
				},
			}
		})

		try {
			const res = await listFiles(targetPath)
			set((state) => {
				const currentPane = state.panes[resolvedPaneId]
				return {
					panes: {
						...state.panes,
						[resolvedPaneId]: {
							...currentPane,
							tabs: currentPane.tabs.map((t) =>
								t.id === tabId
									? {
											...t,
											entries: sortEntries(res.files, currentPane.sort),
											loading: false,
										}
									: t,
							),
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
							tabs: currentPane.tabs.map((t) =>
								t.id === tabId
									? { ...t, loading: false, error: (err as Error).message }
									: t,
							),
						},
					},
				}
			})
		}
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
						tabs: pane.tabs.map((t) => ({
							...t,
							entries: sortEntries([...t.entries], sort),
						})),
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
		const activeTab = getActiveTab(pane.tabs, pane.activeTabId)
		if (!activeTab) return

		set((state) => {
			const currentPane = state.panes[resolvedPaneId]
			return {
				panes: {
					...state.panes,
					[resolvedPaneId]: {
						...currentPane,
						selectedPaths: new Set(activeTab.entries.map((e) => e.path)),
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
		addTab: (path) => useFileStoreBase.getState().addTab(path, paneId),
		closeTab: (id) => useFileStoreBase.getState().closeTab(id, paneId),
		switchTab: (id) => useFileStoreBase.getState().switchTab(id, paneId),
		navigate: (path) => useFileStoreBase.getState().navigate(path, paneId),
		refresh: () => useFileStoreBase.getState().refresh(paneId),
		refreshTab: (tabId) => useFileStoreBase.getState().refreshTab(tabId, paneId),
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
	}
}

const scopedActionMap: Record<PaneId, ScopedActions> = {
	left: createScopedActions('left'),
	right: createScopedActions('right'),
}

function getScopedState(state: FileStoreState, paneId: PaneId): FileStore {
	const pane = state.panes[paneId]
	return {
		tabs: pane.tabs,
		activeTabId: pane.activeTabId,
		viewMode: pane.viewMode,
		sort: pane.sort,
		selectedPaths: pane.selectedPaths,
		previewFile: state.previewFile,
		activePaneId: state.activePaneId,
		...scopedActionMap[paneId],
	}
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

// Selectors for derived state
export const selectActiveTab = (state: FileStore): Tab | undefined =>
	getActiveTab(state.tabs, state.activeTabId)

export const selectCurrentPath = (state: FileStore): string =>
	selectActiveTab(state)?.path ?? ''

export const selectEntries = (state: FileStore): FileEntry[] =>
	selectActiveTab(state)?.entries ?? []

export const selectLoading = (state: FileStore): boolean =>
	selectActiveTab(state)?.loading ?? false

export const selectError = (state: FileStore): string | null =>
	selectActiveTab(state)?.error ?? null
