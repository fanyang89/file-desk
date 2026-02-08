import type { Plugin } from 'vite'
import {
  handleListFiles,
  handleMkdir,
  handleRename,
  handleDelete,
  handleUpload,
  handleDownload,
  handlePreview,
} from './fs-routes'

export function fsApiPlugin(): Plugin {
  return {
    name: 'fs-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''

        if (url.startsWith('/api/files')) {
          handleListFiles(req, res)
        } else if (url === '/api/mkdir' && req.method === 'POST') {
          handleMkdir(req, res)
        } else if (url === '/api/rename' && req.method === 'POST') {
          handleRename(req, res)
        } else if (url === '/api/delete' && req.method === 'DELETE') {
          handleDelete(req, res)
        } else if (url.startsWith('/api/upload') && req.method === 'POST') {
          handleUpload(req, res)
        } else if (url.startsWith('/api/preview')) {
          handlePreview(req, res)
        } else if (url.startsWith('/api/download')) {
          handleDownload(req, res)
        } else {
          next()
        }
      })
    },
  }
}
