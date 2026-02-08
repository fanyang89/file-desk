import { ChevronRight, Home } from 'lucide-react'
import { useFileStore } from '@/store/file-store'

export function Breadcrumbs() {
  const { currentPath, navigate } = useFileStore()

  const segments = currentPath ? currentPath.split('/').filter(Boolean) : []

  return (
    <div className="breadcrumbs">
      <button className="breadcrumb-item" onClick={() => navigate('')}>
        <Home size={16} />
      </button>
      {segments.map((segment, i) => {
        const path = segments.slice(0, i + 1).join('/')
        return (
          <span key={path} className="breadcrumb-segment">
            <ChevronRight size={14} className="breadcrumb-separator" />
            <button className="breadcrumb-item" onClick={() => navigate(path)}>
              {segment}
            </button>
          </span>
        )
      })}
    </div>
  )
}
