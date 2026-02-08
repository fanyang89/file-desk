import { useState } from 'react'
import { ContextMenu } from 'radix-ui'
import { Download, Pencil, Trash2, FolderOpen, Eye } from 'lucide-react'
import type { FileEntry } from '@/types'
import { useFileStore } from '@/store/file-store'
import { getDownloadUrl } from '@/lib/api-client'
import { RenameDialog } from '@/components/Dialogs/RenameDialog'
import { DeleteConfirmDialog } from '@/components/Dialogs/DeleteConfirmDialog'

interface FileContextMenuProps {
  entry: FileEntry
  children: React.ReactNode
}

export function FileContextMenu({ entry, children }: FileContextMenuProps) {
  const { navigate, openPreview } = useFileStore()
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleDownload = () => {
    const url = getDownloadUrl(entry.path)
    const a = document.createElement('a')
    a.href = url
    a.download = entry.name
    a.click()
  }

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          {children}
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="context-menu-content">
            {entry.isDirectory && (
              <ContextMenu.Item
                className="context-menu-item"
                onSelect={() => navigate(entry.path)}
              >
                <FolderOpen size={14} />
                <span>Open</span>
              </ContextMenu.Item>
            )}
            {!entry.isDirectory && (
              <>
                <ContextMenu.Item
                  className="context-menu-item"
                  onSelect={() => openPreview(entry)}
                >
                  <Eye size={14} />
                  <span>Preview</span>
                </ContextMenu.Item>
                <ContextMenu.Item
                  className="context-menu-item"
                  onSelect={handleDownload}
                >
                  <Download size={14} />
                  <span>Download</span>
                </ContextMenu.Item>
              </>
            )}
            <ContextMenu.Separator className="context-menu-separator" />
            <ContextMenu.Item
              className="context-menu-item"
              onSelect={() => setRenameOpen(true)}
            >
              <Pencil size={14} />
              <span>Rename</span>
            </ContextMenu.Item>
            <ContextMenu.Item
              className="context-menu-item destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <RenameDialog entry={entry} open={renameOpen} onOpenChange={setRenameOpen} />
      <DeleteConfirmDialog entry={entry} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  )
}
