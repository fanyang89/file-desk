import { useState, useEffect } from 'react'
import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import type { FileEntry } from '@/types'
import { useFileStore } from '@/store/file-store'
import { renameEntry } from '@/lib/api-client'
import { useToast } from '@/components/Toast/useToast'

interface RenameDialogProps {
  entry: FileEntry
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RenameDialog({ entry, open, onOpenChange }: RenameDialogProps) {
  const [newName, setNewName] = useState(entry.name)
  const { currentPath, refresh } = useFileStore()
  const { showToast } = useToast()

  useEffect(() => {
    if (open) setNewName(entry.name)
  }, [open, entry.name])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || newName.trim() === entry.name) return

    try {
      await renameEntry(currentPath, entry.name, newName.trim())
      showToast(`Renamed to "${newName.trim()}"`)
      refresh()
      onOpenChange(false)
    } catch (err) {
      showToast((err as Error).message, 'error')
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title className="dialog-title">Rename</Dialog.Title>
          <form onSubmit={handleSubmit}>
            <input
              className="dialog-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              onFocus={(e) => {
                const dotIndex = e.target.value.lastIndexOf('.')
                if (dotIndex > 0) {
                  e.target.setSelectionRange(0, dotIndex)
                } else {
                  e.target.select()
                }
              }}
            />
            <div className="dialog-actions">
              <button
                type="button"
                className="dialog-btn cancel"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="dialog-btn primary"
                disabled={!newName.trim() || newName.trim() === entry.name}
              >
                Rename
              </button>
            </div>
          </form>
          <Dialog.Close asChild>
            <button className="dialog-close" aria-label="Close">
              <X size={16} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
