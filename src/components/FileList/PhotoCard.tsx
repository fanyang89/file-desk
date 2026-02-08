import { useState } from 'react'
import type { FileEntry } from '@/types'
import { useFileStore } from '@/store/file-store'
import { getThumbnailUrl } from '@/lib/api-client'

interface PhotoCardProps {
  entry: FileEntry
}

export function PhotoCard({ entry }: PhotoCardProps) {
  const { selectedPaths, toggleSelection, setSelectedPaths, openPreview } = useFileStore()
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const isSelected = selectedPaths.has(entry.path)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.metaKey || e.ctrlKey) {
      toggleSelection(entry.path, true)
    } else {
      setSelectedPaths(new Set([entry.path]))
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    openPreview(entry)
  }

  const thumbnailUrl = getThumbnailUrl(entry.path, entry.modifiedAt)

  return (
    <div
      className={`photo-card ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {!error ? (
        <img
          src={thumbnailUrl}
          alt={entry.name}
          className={`photo-card-img ${loaded ? 'loaded' : ''}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          loading="lazy"
        />
      ) : (
        <div className="photo-card-error">Failed to load</div>
      )}
      <div className="photo-card-overlay">
        <span className="photo-card-name">{entry.name}</span>
      </div>
    </div>
  )
}
