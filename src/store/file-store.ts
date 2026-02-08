import { create } from 'zustand'
import type { FileEntry, ViewMode, SortConfig } from '@/types'
import { listFiles } from '@/lib/api-client'

interface FileStore {
  currentPath: string
  entries: FileEntry[]
  loading: boolean
  error: string | null
  viewMode: ViewMode
  sort: SortConfig
  selectedPaths: Set<string>
  previewFile: FileEntry | null

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

export const useFileStore = create<FileStore>((set, get) => ({
  currentPath: '',
  entries: [],
  loading: false,
  error: null,
  viewMode: 'list',
  sort: { field: 'name', direction: 'asc' },
  selectedPaths: new Set(),
  previewFile: null,

  navigate: async (path: string) => {
    set({ loading: true, error: null, selectedPaths: new Set() })
    try {
      const res = await listFiles(path)
      set({
        currentPath: path,
        entries: sortEntries(res.files, get().sort),
        loading: false,
      })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  refresh: async () => {
    const { currentPath, sort } = get()
    set({ loading: true, error: null })
    try {
      const res = await listFiles(currentPath)
      set({
        entries: sortEntries(res.files, sort),
        loading: false,
      })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setSort: (sort) => {
    const { entries } = get()
    set({ sort, entries: sortEntries([...entries], sort) })
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
    const { entries } = get()
    set({ selectedPaths: new Set(entries.map(e => e.path)) })
  },

  clearSelection: () => set({ selectedPaths: new Set() }),

  setSelectedPaths: (paths) => set({ selectedPaths: paths }),

  openPreview: (entry) => set({ previewFile: entry }),

  closePreview: () => set({ previewFile: null }),
}))
