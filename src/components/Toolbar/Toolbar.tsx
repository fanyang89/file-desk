import { useRef, useState } from 'react'
import { LayoutGrid, List, FolderPlus, Upload, ArrowUpDown } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { useFileStore, selectCurrentPath } from '@/store/file-store'
import { uploadFiles } from '@/lib/api-client'
import { useToast } from '@/components/Toast/useToast'
import { Breadcrumbs } from './Breadcrumbs'
import { NewFolderDialog } from '@/components/Dialogs/NewFolderDialog'
import type { SortField, SortDirection } from '@/types'

export function Toolbar() {
  const viewMode = useFileStore(s => s.viewMode)
  const setViewMode = useFileStore(s => s.setViewMode)
  const sort = useFileStore(s => s.sort)
  const setSort = useFileStore(s => s.setSort)
  const currentPath = useFileStore(selectCurrentPath)
  const refresh = useFileStore(s => s.refresh)
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    try {
      await uploadFiles(currentPath, files)
      showToast('Files uploaded successfully')
      refresh()
    } catch (err) {
      showToast((err as Error).message, 'error')
    }
    e.target.value = ''
  }

  const handleSort = (field: SortField) => {
    const direction: SortDirection =
      sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc'
    setSort({ field, direction })
  }

  return (
    <div className="toolbar">
      <Breadcrumbs />
      <div className="toolbar-actions">
        <button
          className="toolbar-btn"
          onClick={() => setNewFolderOpen(true)}
          title="New Folder"
        >
          <FolderPlus size={18} />
        </button>

        <button
          className="toolbar-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Upload"
        >
          <Upload size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleUpload}
          style={{ display: 'none' }}
        />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="toolbar-btn" title="Sort">
              <ArrowUpDown size={18} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="dropdown-content" sideOffset={5}>
              <DropdownMenu.Item className="dropdown-item" onSelect={() => handleSort('name')}>
                Name {sort.field === 'name' && (sort.direction === 'asc' ? '↑' : '↓')}
              </DropdownMenu.Item>
              <DropdownMenu.Item className="dropdown-item" onSelect={() => handleSort('size')}>
                Size {sort.field === 'size' && (sort.direction === 'asc' ? '↑' : '↓')}
              </DropdownMenu.Item>
              <DropdownMenu.Item className="dropdown-item" onSelect={() => handleSort('modifiedAt')}>
                Modified {sort.field === 'modifiedAt' && (sort.direction === 'asc' ? '↑' : '↓')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <div className="view-toggle">
          <button
            className={`toolbar-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <List size={18} />
          </button>
          <button
            className={`toolbar-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      <NewFolderDialog open={newFolderOpen} onOpenChange={setNewFolderOpen} />
    </div>
  )
}
