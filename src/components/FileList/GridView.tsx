import { VirtuosoGrid } from 'react-virtuoso'
import type { FileEntry } from '@/types'
import { FileCard } from './FileCard'
import { forwardRef } from 'react'

interface GridViewProps {
  entries: FileEntry[]
}

const GridList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <div ref={ref} {...props} className="grid-list" />
  )
)
GridList.displayName = 'GridList'

const GridItem = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <div ref={ref} {...props} className="grid-item-wrapper" />
  )
)
GridItem.displayName = 'GridItem'

export function GridView({ entries }: GridViewProps) {
  return (
    <VirtuosoGrid
      style={{ flex: 1 }}
      data={entries}
      components={{
        List: GridList,
        Item: GridItem,
      }}
      itemContent={(_index, entry) => <FileCard entry={entry} />}
    />
  )
}
