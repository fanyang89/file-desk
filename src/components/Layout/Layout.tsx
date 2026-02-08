import { Sidebar } from '@/components/Sidebar/Sidebar'
import { Toolbar } from '@/components/Toolbar/Toolbar'
import { FileList } from '@/components/FileList/FileList'

export function Layout() {
  return (
    <div className="layout">
      <Sidebar />
      <div className="layout-main">
        <Toolbar />
        <FileList />
      </div>
    </div>
  )
}
