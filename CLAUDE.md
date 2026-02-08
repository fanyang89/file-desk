# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

File Desk is a browser-based local file manager with a Google Drive-like interface. The goal is to provide file and photo management that runs on any Linux distribution without requiring a NAS system.

## Commands

This project uses **Bun** as the JavaScript runtime and package manager.

```bash
bun install      # Install dependencies
bun run dev      # Start development server (includes API backend)
bun run build    # TypeScript check + Vite production build
bun run lint     # Run ESLint
bun run preview  # Preview production build
```

## Architecture

### Frontend-Backend in One

The app runs as a single Vite dev server. The backend API is implemented as a **Vite middleware plugin** (`src/api/fs-api-plugin.ts`), not a separate server. This means:
- `bun run dev` starts both frontend and API
- API routes are handled by Node.js middleware before Vite processes the request
- No separate backend process needed during development

### Data Flow

```
React Components → Zustand Store → API Client → Vite Middleware → Node.js fs
```

1. **UI Components** dispatch actions to the Zustand store
2. **Store** (`src/store/file-store.ts`) manages state and calls API client
3. **API Client** (`src/lib/api-client.ts`) makes HTTP requests to `/api/*`
4. **Vite Plugin** (`src/api/fs-api-plugin.ts`) intercepts requests and routes them
5. **Route Handlers** (`src/api/fs-routes.ts`) perform filesystem operations

### Key Files

- `vite.config.ts` - Registers the `fsApiPlugin()` middleware and `@` path alias
- `src/api/fs-utils.ts` - Contains `safePath()` for directory traversal prevention
- `src/store/file-store.ts` - Central state: current path, entries, selection, view mode, sort config

### API Endpoints (all via Vite middleware)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/files?path=` | List directory contents |
| POST | `/api/mkdir` | Create folder |
| POST | `/api/rename` | Rename file/folder |
| DELETE | `/api/delete` | Delete file/folder |
| POST | `/api/upload?path=` | Upload files (multipart) |
| GET | `/api/download?path=` | Download file |

### Path Alias

Use `@/` to import from `src/`:
```typescript
import { useFileStore } from '@/store/file-store'
```
