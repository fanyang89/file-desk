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
  console.warn(`[api-client] API unavailable, using mock fs (${reason})`)
}

function shouldFallbackToMockStatus(status: number): boolean {
  return status === 404 || status === 405
}

function shouldFallbackToMockError(err: unknown): boolean {
  return err instanceof TypeError
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

interface RequestWithMockOptions<T> {
  url: string
  init?: RequestInit
  fallbackReason: string
  errorFallback: string
  mockValue: () => T | Promise<T>
}

async function requestJsonWithMock<T>({
  url,
  init,
  fallbackReason,
  errorFallback,
  mockValue,
}: RequestWithMockOptions<T>): Promise<T> {
  if (mockModeEnabled) {
    return mockValue()
  }

  let res: Response
  try {
    res = await fetch(url, init)
  } catch (err) {
    if (CAN_USE_MOCK && shouldFallbackToMockError(err)) {
      enableMockMode(`${fallbackReason} -> network error`)
      return mockValue()
    }
    throw err
  }

  if (!res.ok) {
    if (CAN_USE_MOCK && shouldFallbackToMockStatus(res.status)) {
      enableMockMode(`${fallbackReason} -> ${res.status}`)
      return mockValue()
    }
    throw new Error(await readErrorMessage(res, errorFallback))
  }
  return res.json() as Promise<T>
}

export async function listFiles(path: string): Promise<ListResponse> {
  return requestJsonWithMock({
    url: `/api/files?path=${encodeURIComponent(path)}`,
    fallbackReason: 'GET /api/files',
    errorFallback: 'Failed to list files',
    mockValue: () => mockListFiles(path),
  })
}

export async function createFolder(path: string, name: string): Promise<SuccessResponse> {
  return requestJsonWithMock({
    url: '/api/mkdir',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, name }),
    },
    fallbackReason: 'POST /api/mkdir',
    errorFallback: 'Failed to create folder',
    mockValue: () => mockCreateFolder(path, name),
  })
}

export async function renameEntry(path: string, oldName: string, newName: string): Promise<SuccessResponse> {
  return requestJsonWithMock({
    url: '/api/rename',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, oldName, newName }),
    },
    fallbackReason: 'POST /api/rename',
    errorFallback: 'Failed to rename',
    mockValue: () => mockRenameEntry(path, oldName, newName),
  })
}

export async function deleteEntry(path: string, name: string): Promise<SuccessResponse> {
  return requestJsonWithMock({
    url: '/api/delete',
    init: {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, name }),
    },
    fallbackReason: 'DELETE /api/delete',
    errorFallback: 'Failed to delete',
    mockValue: () => mockDeleteEntry(path, name),
  })
}

export async function uploadFiles(path: string, files: FileList): Promise<{ success: boolean; files: string[] }> {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }

  return requestJsonWithMock({
    url: `/api/upload?path=${encodeURIComponent(path)}`,
    init: {
      method: 'POST',
      body: formData,
    },
    fallbackReason: 'POST /api/upload',
    errorFallback: 'Failed to upload',
    mockValue: () => mockUploadFiles(path, files),
  })
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

  let res: Response
  try {
    res = await fetch(getPreviewUrl(filePath), { signal })
  } catch (err) {
    if (CAN_USE_MOCK && shouldFallbackToMockError(err) && hasMockEntry(filePath)) {
      enableMockMode('GET /api/preview -> network error')
      return mockFetchTextContent(filePath)
    }
    throw err
  }

  if (!res.ok) {
    if (CAN_USE_MOCK && shouldFallbackToMockStatus(res.status) && hasMockEntry(filePath)) {
      enableMockMode(`GET /api/preview -> ${res.status}`)
      return mockFetchTextContent(filePath)
    }
    throw new Error(await readErrorMessage(res, 'Failed to load file content'))
  }
  return res.text()
}
