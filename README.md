# File Desk

A modern, browser-based local file manager with a Google Drive-like interface.

## Features

- **File & Folder Management** - Create, rename, delete folders and files
- **File Upload & Download** - Upload multiple files at once, download individual files
- **Dual View Modes** - Switch between list view and grid view
- **Sorting** - Sort by name, size, or modification date
- **Selection** - Single and multi-select with Ctrl/Cmd+Click
- **Context Menu** - Right-click for quick file operations
- **Virtual Scrolling** - Efficient rendering for large file listings
- **Keyboard Shortcuts** - Ctrl/Cmd+A to select all, Escape to clear selection, Enter to open folders

## Tech Stack

- **Bun** - JavaScript runtime and package manager
- **React 19** + **TypeScript** - Frontend framework
- **Vite** - Build tool and dev server
- **Zustand** - State management
- **Radix UI** - Component library and theming
- **react-virtuoso** - Virtual scrolling
- **lucide-react** - Icons

## Getting Started

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build
```

## Project Structure

```
src/
├── components/     # React UI components
├── store/          # Zustand state management
├── api/            # Backend API routes (Vite middleware)
├── lib/            # Utilities (API client, formatters)
├── hooks/          # Custom React hooks
└── types/          # TypeScript type definitions
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files?path=...` | List files in directory |
| POST | `/api/mkdir` | Create folder |
| POST | `/api/rename` | Rename file/folder |
| DELETE | `/api/delete` | Delete file/folder |
| POST | `/api/upload?path=...` | Upload files |
| GET | `/api/download?path=...` | Download file |

## License

MIT
