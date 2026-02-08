const DEMO_CONTENT: Record<string, string> = {
  'README.md': `# File Desk

A Google Drive-like local file manager built with React + TypeScript + Vite.

## Features

- Browse local filesystem with familiar Google Drive UI
- List and Grid view modes
- File preview with Monaco Editor for code files
- Create, rename, delete folders and files
- Upload and download files
- Keyboard shortcuts (Ctrl+A, Enter, Escape)

## Getting Started

\`\`\`bash
bun install
bun run dev
\`\`\`

Then open http://localhost:5173 in your browser.
`,
  'package.json': `{
  "name": "file-desk",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0"
  }
}
`,
  'notes.txt': `Meeting Notes - Feb 2026
========================

- Review Q1 roadmap
- Discuss new feature priorities
- Team sync on Friday

TODO:
[x] Complete file preview feature
[x] Add Monaco Editor support
[ ] Add drag and drop upload
[ ] Add file search
`,
  'Documents/presentation.md': `# Q1 2026 Review

## Highlights

- Launched File Desk v1.0
- 50% performance improvement
- New preview feature with Monaco Editor

## Next Steps

1. Mobile responsive design
2. Cloud sync integration
3. Collaborative editing
`,
  'Projects/web-app/src/index.ts': `import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
`,
  'Projects/web-app/src/App.tsx': `import { useState } from 'react'

interface Props {
  title?: string
}

export default function App({ title = 'Hello World' }: Props) {
  const [count, setCount] = useState(0)

  return (
    <div className="app">
      <h1>{title}</h1>
      <button onClick={() => setCount(c => c + 1)}>
        Count: {count}
      </button>
    </div>
  )
}
`,
  'Projects/web-app/src/styles.css': `.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: system-ui, sans-serif;
}

h1 {
  color: #333;
}

button {
  padding: 8px 16px;
  font-size: 16px;
  cursor: pointer;
}
`,
  'Projects/web-app/package.json': `{
  "name": "web-app",
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
`,
  'Projects/web-app/tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true
  }
}
`,
  'Projects/api-server/main.go': `package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hello, World!")
	})

	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, \`{"status": "ok"}\`)
	})

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
`,
  'Projects/api-server/go.mod': `module api-server

go 1.21
`,
}

interface DemoBinaryPreview {
  content: Uint8Array
  contentType: string
}

const TEXT_CONTENT_TYPE_MAP: Record<string, string> = {
  md: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8',
  ts: 'text/plain; charset=utf-8',
  tsx: 'text/plain; charset=utf-8',
  css: 'text/css; charset=utf-8',
  go: 'text/plain; charset=utf-8',
  mod: 'text/plain; charset=utf-8',
}

const DEMO_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAVEAEBAAAAAAAAAAAAAAAAAAAAAf/aAAwDAQACEAMQAAAB6AAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8BP//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8BP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//Z'

const DEMO_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3Z8WQAAAAASUVORK5CYII='

const ENCODER = new TextEncoder()

function decodeBase64(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, 'base64'))
}

function getTextContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return TEXT_CONTENT_TYPE_MAP[ext] || 'text/plain; charset=utf-8'
}

function escapePdfString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function byteLength(value: string): number {
  return ENCODER.encode(value).length
}

function createDemoPdf(title: string, subtitle: string): Uint8Array {
  const streamContent = [
    'BT',
    '/F1 24 Tf',
    '72 740 Td',
    `(${escapePdfString(title)}) Tj`,
    '/F1 12 Tf',
    '0 -28 Td',
    `(${escapePdfString(subtitle)}) Tj`,
    'ET',
    '',
  ].join('\n')

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length ${byteLength(streamContent)} >>\nstream\n${streamContent}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]

  for (const object of objects) {
    offsets.push(byteLength(pdf))
    pdf += object
  }

  const xrefOffset = byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return ENCODER.encode(pdf)
}

const DEMO_BINARY_PREVIEWS: Record<string, DemoBinaryPreview> = {
  'Documents/report.pdf': {
    content: createDemoPdf('Q1 2026 Report', 'Demo PDF preview content'),
    contentType: 'application/pdf',
  },
  'Images/photo1.jpg': {
    content: decodeBase64(DEMO_JPEG_BASE64),
    contentType: 'image/jpeg',
  },
  'Images/screenshot.png': {
    content: decodeBase64(DEMO_PNG_BASE64),
    contentType: 'image/png',
  },
  'Images/logo.svg': {
    content: ENCODER.encode(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120">
  <rect width="240" height="120" rx="16" fill="#0f172a"/>
  <circle cx="52" cy="60" r="24" fill="#38bdf8"/>
  <text x="90" y="68" font-family="Arial, sans-serif" font-size="24" fill="#f8fafc">File Desk</text>
</svg>`),
    contentType: 'image/svg+xml; charset=utf-8',
  },
}

export default function handler(req: Request): Response {
  const url = new URL(req.url)
  const filePath = url.searchParams.get('path') || ''

  const binaryPreview = DEMO_BINARY_PREVIEWS[filePath]
  if (binaryPreview) {
    return new Response(binaryPreview.content, {
      status: 200,
      headers: {
        'Content-Type': binaryPreview.contentType,
        'Content-Disposition': `inline; filename="${filePath.split('/').pop()}"`,
      },
    })
  }

  const content = DEMO_CONTENT[filePath]

  if (content === undefined) {
    return new Response('Preview not available for this file in demo mode', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': getTextContentType(filePath),
      'Content-Disposition': `inline; filename="${filePath.split('/').pop()}"`,
    },
  })
}
