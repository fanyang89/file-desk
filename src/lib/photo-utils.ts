import type { FileEntry } from '@/types'

export const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'
])

export function isImageFile(extension: string): boolean {
  return IMAGE_EXTENSIONS.has(extension.toLowerCase())
}

export interface DateGroup {
  date: string
  label: string
  images: FileEntry[]
}

export function groupImagesByDate(entries: FileEntry[]): DateGroup[] {
  const images = entries.filter(e => !e.isDirectory && isImageFile(e.extension))

  const groups = new Map<string, FileEntry[]>()

  for (const image of images) {
    const date = new Date(image.modifiedAt)
    const dateKey = date.toISOString().split('T')[0]

    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
    }
    groups.get(dateKey)!.push(image)
  }

  const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a))

  return sortedKeys.map(dateKey => ({
    date: dateKey,
    label: formatDateHeader(new Date(dateKey)),
    images: groups.get(dateKey)!
  }))
}

export function formatDateHeader(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const dateStr = date.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  if (dateStr === todayStr) {
    return 'Today'
  }

  if (dateStr === yesterdayStr) {
    return 'Yesterday'
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}
