export type PreviewType = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'unsupported'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'])
const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm'])
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac'])
const TEXT_EXTS = new Set([
  'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'xml',
  'yaml', 'yml', 'toml', 'sh', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
  'log', 'env', 'gitignore', 'lock', 'sql', 'graphql',
  'kt', 'swift', 'scala', 'php', 'lua', 'r', 'pl', 'ex', 'exs', 'clj', 'hs',
])

// Extensionless files that should be treated as text
const TEXT_FILENAMES = new Set([
  'dockerfile', 'makefile', 'gemfile', 'rakefile', 'procfile',
  'vagrantfile', 'brewfile', 'cakefile', 'guardfile',
  'license', 'readme', 'changelog', 'authors', 'contributors',
])

export function getPreviewType(extension: string, filename?: string): PreviewType {
  const ext = extension.toLowerCase()
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  if (TEXT_EXTS.has(ext)) return 'text'
  // Check extensionless filenames
  if (!ext && filename && TEXT_FILENAMES.has(filename.toLowerCase())) {
    return 'text'
  }
  return 'unsupported'
}

const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  cs: 'csharp',
  css: 'css',
  html: 'html',
  xml: 'xml',
  json: 'json',
  md: 'markdown',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  sh: 'shell',
  bash: 'shell',
  sql: 'sql',
  graphql: 'graphql',
  kt: 'kotlin',
  swift: 'swift',
  scala: 'scala',
  php: 'php',
  lua: 'lua',
  r: 'r',
  pl: 'perl',
  ex: 'elixir',
  exs: 'elixir',
  clj: 'clojure',
  hs: 'haskell',
}

// Language mapping for extensionless files
const FILENAME_LANGUAGE_MAP: Record<string, string> = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  gemfile: 'ruby',
  rakefile: 'ruby',
  procfile: 'yaml',
  vagrantfile: 'ruby',
  brewfile: 'ruby',
  cakefile: 'coffeescript',
  guardfile: 'ruby',
}

export function getMonacoLanguage(extension: string, filename?: string): string {
  const ext = extension.toLowerCase()
  if (LANGUAGE_MAP[ext]) {
    return LANGUAGE_MAP[ext]
  }
  // Check extensionless filenames
  if (!ext && filename) {
    const lang = FILENAME_LANGUAGE_MAP[filename.toLowerCase()]
    if (lang) return lang
  }
  return 'plaintext'
}
