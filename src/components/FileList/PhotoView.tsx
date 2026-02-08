import { useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { ImageOff } from 'lucide-react'
import type { FileEntry } from '@/types'
import { groupImagesByDate, type DateGroup } from '@/lib/photo-utils'
import { PhotoCard } from './PhotoCard'

interface PhotoViewProps {
  entries: FileEntry[]
}

function DateGroupSection({ group }: { group: DateGroup }) {
  return (
    <div className="photo-date-group">
      <div className="photo-date-header">{group.label}</div>
      <div className="photo-grid">
        {group.images.map(image => (
          <PhotoCard key={image.path} entry={image} />
        ))}
      </div>
    </div>
  )
}

export function PhotoView({ entries }: PhotoViewProps) {
  const groups = useMemo(() => groupImagesByDate(entries), [entries])

  if (groups.length === 0) {
    return (
      <div className="photo-view-empty">
        <ImageOff size={48} strokeWidth={1} />
        <p>No images in this folder</p>
      </div>
    )
  }

  return (
    <Virtuoso
      style={{ flex: 1 }}
      data={groups}
      itemContent={(_index, group) => <DateGroupSection group={group} />}
    />
  )
}
