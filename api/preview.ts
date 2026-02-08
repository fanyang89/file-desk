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

export default function handler(req: Request): Response {
  const url = new URL(req.url)
  const filePath = url.searchParams.get('path') || ''

  const content = DEMO_CONTENT[filePath]

  if (content === undefined) {
    return new Response('Preview not available for this file in demo mode', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `inline; filename="${filePath.split('/').pop()}"`,
    },
  })
}
