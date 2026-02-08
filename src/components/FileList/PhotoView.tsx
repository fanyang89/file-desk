import { useEffect, useMemo, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { ImageOff, Loader2 } from 'lucide-react'
import type { FileEntry } from '@/types'
import { groupImagesByDate, type DateGroup } from '@/lib/photo-utils'
import { listImagesRecursive } from '@/lib/api-client'
import { PhotoCard } from './PhotoCard'

interface PhotoViewProps {
  path: string
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

export function PhotoView({ path }: PhotoViewProps) {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await listImagesRecursive(path)
        if (cancelled) return
        setEntries(res.files)
      } catch (err) {
        if (cancelled) return
        setError((err as Error).message)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [path])

  const groups = useMemo(() => groupImagesByDate(entries), [entries])

  if (loading) {
    return (
      <div className="photo-view-empty">
        <Loader2 size={32} className="spinner" />
        <p>Loading photos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="photo-view-empty">
        <p className="error-text">Error: {error}</p>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="photo-view-empty">
        <ImageOff size={48} strokeWidth={1} />
        <p>No images in this folder tree</p>
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
