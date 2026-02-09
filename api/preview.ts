import type { VercelRequest, VercelResponse } from '@vercel/node'

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
  'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
`,
  'Makefile': `.PHONY: build test run clean

build:
	npm run build

test:
	npm test

run:
	npm run dev

clean:
	rm -rf dist node_modules
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
  'Documents/budget.csv': `Category,Q1,Q2,Q3,Q4
Engineering,50000,55000,60000,65000
Marketing,20000,25000,30000,35000
Operations,15000,15000,16000,17000
Total,85000,95000,106000,117000
`,
  'Images/logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="10" fill="#4f46e5"/>
  <text x="50" y="60" font-family="Arial" font-size="40" fill="white" text-anchor="middle">FD</text>
</svg>
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

export default function handler(req: VercelRequest, res: VercelResponse) {
  const filePath = (req.query.path as string) || ''
  const content = DEMO_CONTENT[filePath]

  if (content === undefined) {
    res.setHeader('Content-Type', 'text/plain')
    res.status(200).send('Preview not available for this file in demo mode')
    return
  }

  const fileName = filePath.split('/').pop() || 'file'
  const ext = fileName.split('.').pop()?.toLowerCase()

  // Set appropriate content type based on file extension
  let contentType = 'text/plain; charset=utf-8'
  if (ext === 'svg') {
    contentType = 'image/svg+xml'
  }

  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`)
  res.status(200).send(content)
}
