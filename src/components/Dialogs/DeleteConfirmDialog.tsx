import { AlertDialog } from 'radix-ui'
import type { FileEntry } from '@/types'
import { useFileStore } from '@/store/file-store'
import { deleteEntry } from '@/lib/api-client'
import { useToast } from '@/components/Toast/useToast'

interface DeleteConfirmDialogProps {
  entry: FileEntry
  targetPath: string | null
  targetTabId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteConfirmDialog({ entry, targetPath, targetTabId, open, onOpenChange }: DeleteConfirmDialogProps) {
  const activeTabId = useFileStore(s => s.activeTabId)
  const refreshTab = useFileStore(s => s.refreshTab)
  const clearSelection = useFileStore(s => s.clearSelection)
  const { showToast } = useToast()

  const handleDelete = async () => {
    if (targetPath === null || targetTabId === null) {
      showToast('No target directory selected', 'error')
      return
    }

    try {
      await deleteEntry(targetPath, entry.name)
      showToast(`"${entry.name}" deleted`)
      if (activeTabId === targetTabId) {
        clearSelection()
      }
      await refreshTab(targetTabId)
      onOpenChange(false)
    } catch (err) {
      showToast((err as Error).message, 'error')
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog-content">
          <AlertDialog.Title className="dialog-title">Delete</AlertDialog.Title>
          <AlertDialog.Description className="dialog-description">
            Are you sure you want to delete "{entry.name}"?
            {entry.isDirectory && ' This will delete all contents inside.'}
            This action cannot be undone.
          </AlertDialog.Description>
          <div className="dialog-actions">
            <AlertDialog.Cancel asChild>
              <button className="dialog-btn cancel">Cancel</button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button className="dialog-btn destructive" onClick={handleDelete}>
                Delete
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
