import { useState, useEffect } from 'react'
import { Dialog } from 'radix-ui'
import { X, Download } from 'lucide-react'
import { useFileStore } from '@/store/file-store'
import { getPreviewUrl, getDownloadUrl, fetchTextContent } from '@/lib/api-client'
import { getPreviewType } from './preview-utils'
import type { PreviewType } from './preview-utils'

function TextPreview({ filePath }: { filePath: string }) {
  const [textContent, setTextContent] = useState('')
  const [textLoading, setTextLoading] = useState(true)
  const [textError, setTextError] = useState<string | null>(null)

  useEffect(() => {
    const abortController = new AbortController()

    fetchTextContent(filePath, abortController.signal)
      .then((content) => {
        if (!abortController.signal.aborted) {
          setTextContent(content)
        }
      })
      .catch((err) => {
        if (!abortController.signal.aborted) {
          setTextError(err.message)
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setTextLoading(false)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [filePath])

  if (textLoading) return <div className="preview-loading">Loading...</div>
  if (textError) return <div className="preview-error">{textError}</div>
  return (
    <div className="preview-text-wrapper">
      <pre className="preview-text-content">{textContent}</pre>
    </div>
  )
}

export function PreviewDialog() {
  const { previewFile, closePreview } = useFileStore()

  const isOpen = previewFile !== null
  const previewType: PreviewType = previewFile
    ? getPreviewType(previewFile.extension)
    : 'unsupported'

  const handleDownload = () => {
    if (!previewFile) return
    const a = document.createElement('a')
    a.href = getDownloadUrl(previewFile.path)
    a.download = previewFile.name
    a.click()
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) closePreview()
  }

  const renderContent = () => {
    if (!previewFile) return null
    const previewUrl = getPreviewUrl(previewFile.path)

    switch (previewType) {
      case 'image':
        return <img src={previewUrl} alt={previewFile.name} className="preview-media preview-image" />
      case 'video':
        return <video src={previewUrl} controls autoPlay className="preview-media preview-video" />
      case 'audio':
        return (
          <div className="preview-audio-wrapper">
            <audio src={previewUrl} controls autoPlay className="preview-audio" />
          </div>
        )
      case 'pdf':
        return <iframe src={previewUrl} className="preview-iframe" title={previewFile.name} />
      case 'text':
        return <TextPreview key={previewFile.path} filePath={previewFile.path} />
      case 'unsupported':
        return (
          <div className="preview-unsupported">
            <p>Preview not available for this file type.</p>
            <button className="dialog-btn primary" onClick={handleDownload}>
              <Download size={14} />
              <span>Download</span>
            </button>
          </div>
        )
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="preview-overlay" />
        <Dialog.Content className="preview-dialog-content">
          <div className="preview-header">
            <Dialog.Title className="preview-title">
              {previewFile?.name}
            </Dialog.Title>
            <div className="preview-header-actions">
              {previewType !== 'unsupported' && (
                <button className="toolbar-btn" onClick={handleDownload} title="Download">
                  <Download size={18} />
                </button>
              )}
              <Dialog.Close asChild>
                <button className="toolbar-btn" aria-label="Close">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
          </div>
          <div className="preview-body">
            {renderContent()}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
