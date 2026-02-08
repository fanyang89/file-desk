import type { FileEntry } from '@/types'

interface ListResponse {
  files: FileEntry[]
  currentPath: string
}

interface SuccessResponse {
  success: boolean
}

export async function listFiles(path: string): Promise<ListResponse> {
  const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to list files')
  }
  return res.json()
}

export async function createFolder(path: string, name: string): Promise<SuccessResponse> {
  const res = await fetch('/api/mkdir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, name }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to create folder')
  }
  return res.json()
}

export async function renameEntry(path: string, oldName: string, newName: string): Promise<SuccessResponse> {
  const res = await fetch('/api/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, oldName, newName }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to rename')
  }
  return res.json()
}

export async function deleteEntry(path: string, name: string): Promise<SuccessResponse> {
  const res = await fetch('/api/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, name }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to delete')
  }
  return res.json()
}

export async function uploadFiles(path: string, files: FileList): Promise<{ success: boolean; files: string[] }> {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }
  const res = await fetch(`/api/upload?path=${encodeURIComponent(path)}`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to upload')
  }
  return res.json()
}

export function getDownloadUrl(filePath: string): string {
  return `/api/download?path=${encodeURIComponent(filePath)}`
}

export function getPreviewUrl(filePath: string): string {
  return `/api/preview?path=${encodeURIComponent(filePath)}`
}

export async function fetchTextContent(filePath: string): Promise<string> {
  const res = await fetch(getPreviewUrl(filePath))
  if (!res.ok) {
    throw new Error('Failed to load file content')
  }
  return res.text()
}
