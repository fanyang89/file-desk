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

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function groupImagesByDate(entries: FileEntry[]): DateGroup[] {
  const images = entries.filter(e => !e.isDirectory && isImageFile(e.extension))

  const groups = new Map<string, FileEntry[]>()

  for (const image of images) {
    const date = new Date(image.modifiedAt)
    const dateKey = getLocalDateKey(date)

    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
    }
    groups.get(dateKey)!.push(image)
  }

  const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a))

  return sortedKeys.map(dateKey => ({
    date: dateKey,
    label: formatDateHeader(dateKey),
    images: groups.get(dateKey)!
  }))
}

export function formatDateHeader(dateKey: string): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const todayKey = getLocalDateKey(today)
  const yesterdayKey = getLocalDateKey(yesterday)

  if (dateKey === todayKey) {
    return 'Today'
  }

  if (dateKey === yesterdayKey) {
    return 'Yesterday'
  }

  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}
