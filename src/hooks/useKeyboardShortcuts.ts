import { useEffect } from 'react'
import { useFileStore, selectEntries } from '@/store/file-store'

export function useKeyboardShortcuts() {
  const selectedPaths = useFileStore(s => s.selectedPaths)
  const entries = useFileStore(selectEntries)
  const selectAll = useFileStore(s => s.selectAll)
  const clearSelection = useFileStore(s => s.clearSelection)
  const navigate = useFileStore(s => s.navigate)
  const openPreview = useFileStore(s => s.openPreview)
  const previewFile = useFileStore(s => s.previewFile)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Ctrl/Cmd + A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        selectAll()
        return
      }

      // Escape: Clear selection (only if preview is not open)
      if (e.key === 'Escape') {
        if (previewFile) {
          // Let Radix Dialog handle the Escape key
          return
        }
        clearSelection()
        return
      }

      // Enter: Open selected folder or preview file
      if (e.key === 'Enter' && selectedPaths.size === 1) {
        const selectedPath = Array.from(selectedPaths)[0]
        const entry = entries.find(e => e.path === selectedPath)
        if (entry?.isDirectory) {
          navigate(entry.path)
        } else if (entry) {
          openPreview(entry)
        }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedPaths, entries, selectAll, clearSelection, navigate, openPreview, previewFile])
}
