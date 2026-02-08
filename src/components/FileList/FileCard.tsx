import type { FileEntry } from '@/types'
import { useFileStore } from '@/store/file-store'
import { FileIcon } from './FileIcon'
import { FileContextMenu } from '@/components/ContextMenu/FileContextMenu'

interface FileCardProps {
  entry: FileEntry
}

export function FileCard({ entry }: FileCardProps) {
  const { navigate, selectedPaths, toggleSelection } = useFileStore()
  const isSelected = selectedPaths.has(entry.path)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleSelection(entry.path, e.metaKey || e.ctrlKey)
  }

  const handleDoubleClick = () => {
    if (entry.isDirectory) {
      navigate(entry.path)
    }
  }

  return (
    <FileContextMenu entry={entry}>
      <div
        className={`file-card ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <div className="file-card-icon">
          <FileIcon extension={entry.extension} isDirectory={entry.isDirectory} size={40} />
        </div>
        <div className="file-card-name" title={entry.name}>
          {entry.name}
        </div>
      </div>
    </FileContextMenu>
  )
}
