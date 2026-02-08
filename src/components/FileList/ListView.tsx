import { Virtuoso } from 'react-virtuoso'
import type { FileEntry } from '@/types'
import { FileRow } from './FileRow'

interface ListViewProps {
  entries: FileEntry[]
}

export function ListView({ entries }: ListViewProps) {
  return (
    <div className="list-view">
      <div className="list-header">
        <div className="file-row-name">Name</div>
        <div className="file-row-size">Size</div>
        <div className="file-row-modified">Modified</div>
      </div>
      <Virtuoso
        style={{ flex: 1 }}
        data={entries}
        itemContent={(_index, entry) => <FileRow entry={entry} />}
      />
    </div>
  )
}
