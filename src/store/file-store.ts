import { create } from 'zustand'
import type { FileEntry, ViewMode, SortConfig, Tab } from '@/types'
import { listFiles } from '@/lib/api-client'

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

interface FileStore {
  tabs: Tab[]
  activeTabId: string
  viewMode: ViewMode
  sort: SortConfig
  selectedPaths: Set<string>
  previewFile: FileEntry | null

  // Tab operations
  addTab: (path?: string) => void
  closeTab: (id: string) => void
  switchTab: (id: string) => void

  // Existing operations
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
}

function sortEntries(entries: FileEntry[], sort: SortConfig): FileEntry[] {
  const dirs = entries.filter(e => e.isDirectory)
  const files = entries.filter(e => !e.isDirectory)

  const comparator = (a: FileEntry, b: FileEntry): number => {
    let result: number
    switch (sort.field) {
      case 'name':
        result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        break
      case 'size':
        result = a.size - b.size
        break
      case 'modifiedAt':
        result = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
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
  return tabs.find(t => t.id === activeTabId)
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

const initialTabId = generateId()

export const useFileStore = create<FileStore>((set, get) => ({
  tabs: [{ id: initialTabId, path: '', entries: [], loading: false, error: null }],
  activeTabId: initialTabId,
  viewMode: 'list',
  sort: { field: 'name', direction: 'asc' },
  selectedPaths: new Set(),
  previewFile: null,

  addTab: (path = '') => {
    const newTab: Tab = {
      id: generateId(),
      path,
      entries: [],
      loading: false,
      error: null,
    }
    set(state => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
      selectedPaths: new Set(),
    }))
    // Load files for the new tab
    get().navigate(path)
  },

  closeTab: (id: string) => {
    const { tabs, activeTabId } = get()
    if (tabs.length <= 1) return // Don't close the last tab

    const tabIndex = tabs.findIndex(t => t.id === id)
    if (tabIndex === -1) return
    const newTabs = tabs.filter(t => t.id !== id)
    const activeTabChanged = id === activeTabId

    // If closing the active tab, switch to an adjacent tab
    let newActiveTabId = activeTabId
    if (activeTabChanged) {
      const newIndex = tabIndex >= newTabs.length ? newTabs.length - 1 : tabIndex
      newActiveTabId = newTabs[newIndex].id
    }

    set(state => ({
      tabs: newTabs,
      activeTabId: newActiveTabId,
      selectedPaths: activeTabChanged ? new Set() : state.selectedPaths,
    }))
  },

  switchTab: (id: string) => {
    const { tabs, activeTabId } = get()
    if (id === activeTabId) return
    if (!tabs.find(t => t.id === id)) return

    set({
      activeTabId: id,
      selectedPaths: new Set(),
    })
  },

  navigate: async (path: string) => {
    const { activeTabId, sort } = get()

    // Set loading state for active tab
    set(state => ({
      tabs: state.tabs.map(t =>
        t.id === activeTabId ? { ...t, loading: true, error: null } : t
      ),
      selectedPaths: new Set(),
    }))

    try {
      const res = await listFiles(path)
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === activeTabId
            ? { ...t, path, entries: sortEntries(res.files, sort), loading: false }
            : t
        ),
      }))
    } catch (err) {
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === activeTabId ? { ...t, loading: false, error: (err as Error).message } : t
        ),
      }))
    }
  },

  refresh: async () => {
    const { tabs, activeTabId, sort } = get()
    const activeTab = getActiveTab(tabs, activeTabId)
    if (!activeTab) return

    set(state => ({
      tabs: state.tabs.map(t =>
        t.id === activeTabId ? { ...t, loading: true, error: null } : t
      ),
    }))

    try {
      const res = await listFiles(activeTab.path)
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === activeTabId
            ? { ...t, entries: sortEntries(res.files, sort), loading: false }
            : t
        ),
      }))
    } catch (err) {
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === activeTabId ? { ...t, loading: false, error: (err as Error).message } : t
        ),
      }))
    }
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setSort: (sort) => {
    set(state => {
      const activeTab = getActiveTab(state.tabs, state.activeTabId)
      if (!activeTab) return { sort }
      return {
        sort,
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId
            ? { ...t, entries: sortEntries([...t.entries], sort) }
            : t
        ),
      }
    })
  },

  toggleSelection: (path, multi) => {
    const { selectedPaths } = get()
    const next = new Set(multi ? selectedPaths : [])
    if (next.has(path)) {
      next.delete(path)
    } else {
      next.add(path)
    }
    set({ selectedPaths: next })
  },

  selectAll: () => {
    const { tabs, activeTabId } = get()
    const activeTab = getActiveTab(tabs, activeTabId)
    if (!activeTab) return
    set({ selectedPaths: new Set(activeTab.entries.map(e => e.path)) })
  },

  clearSelection: () => set({ selectedPaths: new Set() }),

  setSelectedPaths: (paths) => set({ selectedPaths: paths }),

  openPreview: (entry) => set({ previewFile: entry }),

  closePreview: () => set({ previewFile: null }),
}))
