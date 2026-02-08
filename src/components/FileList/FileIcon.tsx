import {
  Folder,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  FileArchive,
  FileSpreadsheet,
  File,
  FileJson,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  // Documents
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  md: FileText,
  rtf: FileText,
  // Images
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  svg: FileImage,
  webp: FileImage,
  ico: FileImage,
  bmp: FileImage,
  // Video
  mp4: FileVideo,
  mov: FileVideo,
  avi: FileVideo,
  mkv: FileVideo,
  webm: FileVideo,
  // Audio
  mp3: FileAudio,
  wav: FileAudio,
  flac: FileAudio,
  aac: FileAudio,
  ogg: FileAudio,
  // Code
  js: FileCode,
  jsx: FileCode,
  ts: FileCode,
  tsx: FileCode,
  py: FileCode,
  rb: FileCode,
  go: FileCode,
  rs: FileCode,
  java: FileCode,
  c: FileCode,
  cpp: FileCode,
  h: FileCode,
  css: FileCode,
  scss: FileCode,
  html: FileCode,
  xml: FileCode,
  yaml: FileCode,
  yml: FileCode,
  toml: FileCode,
  sh: FileCode,
  bash: FileCode,
  // Data
  json: FileJson,
  csv: FileSpreadsheet,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  // Archives
  zip: FileArchive,
  tar: FileArchive,
  gz: FileArchive,
  rar: FileArchive,
  '7z': FileArchive,
}

interface FileIconProps {
  extension: string
  isDirectory: boolean
  size?: number
}

export function FileIcon({ extension, isDirectory, size = 20 }: FileIconProps) {
  if (isDirectory) {
    return <Folder size={size} className="file-icon folder-icon" />
  }

  const Icon = ICON_MAP[extension] || File
  return <Icon size={size} className="file-icon" />
}
