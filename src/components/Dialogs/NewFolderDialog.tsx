import { useState } from 'react'
import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { useFileStore } from '@/store/file-store'
import { createFolder } from '@/lib/api-client'
import { useToast } from '@/components/Toast/useToast'

interface NewFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewFolderDialog({ open, onOpenChange }: NewFolderDialogProps) {
  const [name, setName] = useState('')
  const { currentPath, refresh } = useFileStore()
  const { showToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      await createFolder(currentPath, name.trim())
      showToast(`Folder "${name.trim()}" created`)
      refresh()
      onOpenChange(false)
      setName('')
    } catch (err) {
      showToast((err as Error).message, 'error')
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title className="dialog-title">New Folder</Dialog.Title>
          <form onSubmit={handleSubmit}>
            <input
              className="dialog-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Folder name"
              autoFocus
            />
            <div className="dialog-actions">
              <button
                type="button"
                className="dialog-btn cancel"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
              <button type="submit" className="dialog-btn primary" disabled={!name.trim()}>
                Create
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
