export type PreviewType = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'unsupported'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'])
const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm'])
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac'])
const TEXT_EXTS = new Set([
  'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'xml',
  'yaml', 'yml', 'toml', 'sh', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
  'log', 'env', 'gitignore', 'lock',
])

export function getPreviewType(extension: string): PreviewType {
  const ext = extension.toLowerCase()
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  if (TEXT_EXTS.has(ext)) return 'text'
  return 'unsupported'
}
