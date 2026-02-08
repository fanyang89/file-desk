import { AlertDialog } from 'radix-ui'
import type { FileEntry } from '@/types'
import { useFileStore } from '@/store/file-store'
import { deleteEntry } from '@/lib/api-client'
import { useToast } from '@/components/Toast/useToast'

interface DeleteConfirmDialogProps {
  entry: FileEntry
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteConfirmDialog({ entry, open, onOpenChange }: DeleteConfirmDialogProps) {
  const { currentPath, refresh, clearSelection } = useFileStore()
  const { showToast } = useToast()

  const handleDelete = async () => {
    try {
      await deleteEntry(currentPath, entry.name)
      showToast(`"${entry.name}" deleted`)
      clearSelection()
      refresh()
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
