import { useRef, useState } from 'react'
import {
  LayoutGrid,
  List,
  FolderPlus,
  Upload,
  ArrowUpDown,
  ArrowUp,
  Home,
  ChevronRight,
  Pencil,
  Image,
} from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { useFileStore, selectCurrentPath, selectLoading } from '@/store/file-store'
import { uploadFiles } from '@/lib/api-client'
import { useToast } from '@/components/Toast/useToast'
import { NewFolderDialog } from '@/components/Dialogs/NewFolderDialog'
import type { SortField, SortDirection } from '@/types'

function normalizePathInput(input: string): string {
  const normalized = input.replace(/\\/g, '/').trim()
  const withoutLeadingSlash = normalized.replace(/^\/+/, '')
  const collapsedSlashes = withoutLeadingSlash.replace(/\/{2,}/g, '/')
  return collapsedSlashes.replace(/\/+$/, '')
}

function formatPathForInput(path: string): string {
  return path ? `/${path}` : '/'
}

export function Toolbar() {
  const activeTabId = useFileStore(s => s.activeTabId)
  const viewMode = useFileStore(s => s.viewMode)
  const setViewMode = useFileStore(s => s.setViewMode)
  const sort = useFileStore(s => s.sort)
  const setSort = useFileStore(s => s.setSort)
  const loading = useFileStore(selectLoading)
  const currentPath = useFileStore(selectCurrentPath)
  const navigate = useFileStore(s => s.navigate)
  const refreshTab = useFileStore(s => s.refreshTab)
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderTargetPath, setNewFolderTargetPath] = useState<string | null>(null)
  const [newFolderTargetTabId, setNewFolderTargetTabId] = useState<string | null>(null)
  const [isEditingPath, setIsEditingPath] = useState(false)
  const [pathInput, setPathInput] = useState('')
  const parentPath = currentPath.split('/').filter(Boolean).slice(0, -1).join('/')
  const canGoUp = currentPath !== '' && !loading
  const segments = currentPath ? currentPath.split('/').filter(Boolean) : []

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const uploadTabId = activeTabId
    const uploadPath = currentPath
    try {
      await uploadFiles(uploadPath, files)
      showToast('Files uploaded successfully')
      await refreshTab(uploadTabId)
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

  const handleNewFolderOpen = () => {
    setNewFolderTargetPath(currentPath)
    setNewFolderTargetTabId(activeTabId)
    setNewFolderOpen(true)
  }

  const handleNewFolderOpenChange = (open: boolean) => {
    setNewFolderOpen(open)
    if (!open) {
      setNewFolderTargetPath(null)
      setNewFolderTargetTabId(null)
    }
  }

  const handlePathSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await navigate(normalizePathInput(pathInput))
    setIsEditingPath(false)
  }

  const handlePathBlur = () => {
    setIsEditingPath(false)
  }

  const handlePathKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Escape') return
    setIsEditingPath(false)
    e.currentTarget.blur()
  }

  const handlePathEdit = () => {
    if (loading) return
    setPathInput(formatPathForInput(currentPath))
    setIsEditingPath(true)
  }

  const handlePathBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEditingPath || loading) return
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    handlePathEdit()
  }

  const handleGoUp = async () => {
    if (!canGoUp) return
    await navigate(parentPath)
  }

  return (
    <div className="toolbar">
      <div className="toolbar-nav">
        <button
          className="toolbar-btn"
          onClick={handleGoUp}
          title="Go up one level"
          aria-label="Go up one level"
          disabled={!canGoUp}
        >
          <ArrowUp size={18} />
        </button>
        <div
          className={`path-bar ${isEditingPath ? 'editing' : ''}`}
          onClick={handlePathBarClick}
        >
          {isEditingPath ? (
            <form className="path-form" onSubmit={handlePathSubmit}>
              <input
                className="path-input"
                type="text"
                value={pathInput}
                onChange={e => setPathInput(e.target.value)}
                onBlur={handlePathBlur}
                onKeyDown={handlePathKeyDown}
                spellCheck={false}
                autoComplete="off"
                aria-label="Path"
                title="Enter path and press Enter"
                disabled={loading}
                autoFocus
              />
            </form>
          ) : (
            <>
              <div className="path-breadcrumbs">
                <button
                  className="path-segment path-home"
                  onClick={() => navigate('')}
                  title="Root"
                  disabled={loading}
                >
                  <Home size={14} />
                </button>
                {segments.map((segment, i) => {
                  const path = segments.slice(0, i + 1).join('/')
                  return (
                    <span key={path} className="path-segment-wrap">
                      <ChevronRight size={14} className="path-separator" />
                      <button
                        className="path-segment"
                        onClick={() => navigate(path)}
                        title={path}
                        disabled={loading}
                      >
                        {segment}
                      </button>
                    </span>
                  )
                })}
              </div>
              <button
                className="path-edit-btn"
                onClick={handlePathEdit}
                title="Edit path"
                aria-label="Edit path"
                disabled={loading}
              >
                <Pencil size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="toolbar-actions">
        <button
          className="toolbar-btn"
          onClick={handleNewFolderOpen}
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
          <button
            className={`toolbar-btn ${viewMode === 'photo' ? 'active' : ''}`}
            onClick={() => setViewMode('photo')}
            title="Photo view"
          >
            <Image size={18} />
          </button>
        </div>
      </div>

      <NewFolderDialog
        targetPath={newFolderTargetPath}
        targetTabId={newFolderTargetTabId}
        open={newFolderOpen}
        onOpenChange={handleNewFolderOpenChange}
      />
    </div>
  )
}
