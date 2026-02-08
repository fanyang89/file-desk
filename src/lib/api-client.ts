import type { FileEntry } from '@/types'
import {
  mockListFiles,
  mockCreateFolder,
  mockRenameEntry,
  mockDeleteEntry,
  mockUploadFiles,
  getMockDownloadUrl,
  getMockPreviewUrl,
  mockFetchTextContent,
  hasMockEntry,
} from '@/lib/mock-fs'

interface ListResponse {
  files: FileEntry[]
  currentPath: string
}

interface SuccessResponse {
  success: boolean
}

function isVercelPreviewHost(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host.endsWith('.vercel.app') && host.includes('-git-')
}

const CAN_USE_MOCK = import.meta.env.DEV || isVercelPreviewHost()
let mockModeEnabled = false

function enableMockMode(reason: string): void {
  if (!CAN_USE_MOCK || mockModeEnabled) return
  mockModeEnabled = true
  console.warn(`[api-client] API unavailable in dev, using mock fs (${reason})`)
}

function shouldFallbackToMock(status: number): boolean {
  return status === 404 || status === 405 || status >= 500
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const err = await res.clone().json() as { error?: string }
    if (err.error) return err.error
  } catch {
    // Ignore non-JSON error responses
  }
  try {
    const text = (await res.text()).trim()
    if (text) return text
  } catch {
    // Ignore unreadable body
  }
  return fallback
}

export async function listFiles(path: string): Promise<ListResponse> {
  if (mockModeEnabled) {
    return mockListFiles(path)
  }

  const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
  if (!res.ok) {
    if (CAN_USE_MOCK && shouldFallbackToMock(res.status)) {
      enableMockMode(`GET /api/files -> ${res.status}`)
      return mockListFiles(path)
    }
    throw new Error(await readErrorMessage(res, 'Failed to list files'))
  }
  return res.json() as Promise<ListResponse>
}

export async function createFolder(path: string, name: string): Promise<SuccessResponse> {
  if (mockModeEnabled) {
    return mockCreateFolder(path, name)
  }

  const res = await fetch('/api/mkdir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, name }),
  })
  if (!res.ok) {
    if (CAN_USE_MOCK && shouldFallbackToMock(res.status)) {
      enableMockMode(`POST /api/mkdir -> ${res.status}`)
      return mockCreateFolder(path, name)
    }
    throw new Error(await readErrorMessage(res, 'Failed to create folder'))
  }
  return res.json() as Promise<SuccessResponse>
}

export async function renameEntry(path: string, oldName: string, newName: string): Promise<SuccessResponse> {
  if (mockModeEnabled) {
    return mockRenameEntry(path, oldName, newName)
  }

  const res = await fetch('/api/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, oldName, newName }),
  })
  if (!res.ok) {
    if (CAN_USE_MOCK && shouldFallbackToMock(res.status)) {
      enableMockMode(`POST /api/rename -> ${res.status}`)
      return mockRenameEntry(path, oldName, newName)
    }
    throw new Error(await readErrorMessage(res, 'Failed to rename'))
  }
  return res.json() as Promise<SuccessResponse>
}

export async function deleteEntry(path: string, name: string): Promise<SuccessResponse> {
  if (mockModeEnabled) {
    return mockDeleteEntry(path, name)
  }

  const res = await fetch('/api/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, name }),
  })
  if (!res.ok) {
    if (CAN_USE_MOCK && shouldFallbackToMock(res.status)) {
      enableMockMode(`DELETE /api/delete -> ${res.status}`)
      return mockDeleteEntry(path, name)
    }
    throw new Error(await readErrorMessage(res, 'Failed to delete'))
  }
  return res.json() as Promise<SuccessResponse>
}

export async function uploadFiles(path: string, files: FileList): Promise<{ success: boolean; files: string[] }> {
  if (mockModeEnabled) {
    return mockUploadFiles(path, files)
  }

  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }
  const res = await fetch(`/api/upload?path=${encodeURIComponent(path)}`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    if (CAN_USE_MOCK && shouldFallbackToMock(res.status)) {
      enableMockMode(`POST /api/upload -> ${res.status}`)
      return mockUploadFiles(path, files)
    }
    throw new Error(await readErrorMessage(res, 'Failed to upload'))
  }
  return res.json() as Promise<{ success: boolean; files: string[] }>
}

export function getDownloadUrl(filePath: string): string {
  if (mockModeEnabled && hasMockEntry(filePath)) {
    return getMockDownloadUrl(filePath)
  }
  return `/api/download?path=${encodeURIComponent(filePath)}`
}

export function getPreviewUrl(filePath: string): string {
  if (mockModeEnabled && hasMockEntry(filePath)) {
    return getMockPreviewUrl(filePath)
  }
  return `/api/preview?path=${encodeURIComponent(filePath)}`
}

export async function fetchTextContent(filePath: string, signal?: AbortSignal): Promise<string> {
  if (mockModeEnabled && hasMockEntry(filePath)) {
    return mockFetchTextContent(filePath)
  }

  const res = await fetch(getPreviewUrl(filePath), { signal })
  if (!res.ok) {
    if (CAN_USE_MOCK && shouldFallbackToMock(res.status) && hasMockEntry(filePath)) {
      enableMockMode(`GET /api/preview -> ${res.status}`)
      return mockFetchTextContent(filePath)
    }
    throw new Error('Failed to load file content')
  }
  return res.text()
}
