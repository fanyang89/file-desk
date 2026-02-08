import type { FileEntry } from '@/types'
import { useFileStore } from '@/store/file-store'
import { FileIcon } from './FileIcon'
import { formatFileSize, formatDate } from '@/lib/format'
import { FileContextMenu } from '@/components/ContextMenu/FileContextMenu'

interface FileRowProps {
  entry: FileEntry
}

export function FileRow({ entry }: FileRowProps) {
  const { navigate, selectedPaths, toggleSelection, openPreview } = useFileStore()
  const isSelected = selectedPaths.has(entry.path)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleSelection(entry.path, e.metaKey || e.ctrlKey)
  }

  const handleDoubleClick = () => {
    if (entry.isDirectory) {
      navigate(entry.path)
    } else {
      openPreview(entry)
    }
  }

  return (
    <FileContextMenu entry={entry}>
      <div
        className={`file-row ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <div className="file-row-name">
          <FileIcon extension={entry.extension} isDirectory={entry.isDirectory} />
          <span className="file-name-text">{entry.name}</span>
        </div>
        <div className="file-row-size">{entry.isDirectory ? '—' : formatFileSize(entry.size)}</div>
        <div className="file-row-modified">{formatDate(entry.modifiedAt)}</div>
      </div>
    </FileContextMenu>
  )
}
