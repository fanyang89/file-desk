import { useState } from 'react'
import { AlertDialog, Popover } from 'radix-ui'
import { Button, Flex, Theme, Tooltip } from '@radix-ui/themes'
import { FolderPlus, HardDrive, ListTodo, Plus, Trash2 } from 'lucide-react'
import { TaskPanel } from '@/components/Tasks/TaskPanel'
import { useFileStore, usePanePath } from '@/store/file-store'
import type { DirPair } from '@/types'

const PATH_DIFF_MIN_LENGTH = 18

function formatPath(path: string): string {
	return path || '/'
}

function getFullPath(path: string): string {
	const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
	return normalized ? `/${normalized}` : '/'
}

function getPathParts(path: string, comparedPath: string): {
	prefix: string
	diff: string
	highlightDiff: boolean
} {
	const formattedPath = formatPath(path)
	const formattedComparedPath = formatPath(comparedPath)

	if (formattedPath === formattedComparedPath) {
		return { prefix: '', diff: formattedPath, highlightDiff: false }
	}

	if (
		formattedPath.length < PATH_DIFF_MIN_LENGTH ||
		formattedComparedPath.length < PATH_DIFF_MIN_LENGTH ||
		formattedPath === '/' ||
		formattedComparedPath === '/'
	) {
		return { prefix: '', diff: formattedPath, highlightDiff: false }
	}

	const pathSegments = formattedPath.split('/').filter(Boolean)
	const comparedPathSegments = formattedComparedPath.split('/').filter(Boolean)

	let sharedCount = 0
	while (
		sharedCount < pathSegments.length &&
		sharedCount < comparedPathSegments.length &&
		pathSegments[sharedCount] === comparedPathSegments[sharedCount]
	) {
		sharedCount += 1
	}

	if (sharedCount === 0 || sharedCount >= pathSegments.length) {
		return { prefix: '', diff: formattedPath, highlightDiff: false }
	}

	return {
		prefix: `${pathSegments.slice(0, sharedCount).join('/')}/`,
		diff: pathSegments.slice(sharedCount).join('/'),
		highlightDiff: true,
	}
}

function PathValue({ path, comparedPath }: { path: string; comparedPath: string }) {
	const formattedPath = formatPath(path)
	const fullPath = getFullPath(path)
	const { prefix, diff, highlightDiff } = getPathParts(path, comparedPath)

	if (!highlightDiff) {
		return (
			<Tooltip content={fullPath} side='top' delayDuration={120}>
				<span className='sidebar-item-path'>{formattedPath}</span>
			</Tooltip>
		)
	}

	return (
		<Tooltip content={fullPath} side='top' delayDuration={120}>
			<span className='sidebar-item-path'>
				<span className='sidebar-item-path-prefix'>{prefix}</span>
				<span className='sidebar-item-path-diff'>{diff}</span>
			</span>
		</Tooltip>
	)
}

export function Sidebar() {
	const dirPairs = useFileStore((s) => s.dirPairs)
	const activeDirPairId = useFileStore((s) => s.activeDirPairId)
	const createDirPair = useFileStore((s) => s.createDirPair)
	const createEmptyDirPair = useFileStore((s) => s.createEmptyDirPair)
	const switchDirPair = useFileStore((s) => s.switchDirPair)
	const deleteDirPair = useFileStore((s) => s.deleteDirPair)
	const leftPath = usePanePath('left')
	const rightPath = usePanePath('right')
	const [deleteOpen, setDeleteOpen] = useState(false)
	const [deleteTarget, setDeleteTarget] = useState<DirPair | null>(null)

	const handleCreateDirPair = () => {
		createDirPair(leftPath, rightPath)
	}

	const handleCreateEmptyDirPair = () => {
		void createEmptyDirPair()
	}

	const openDeleteDialog = (dirPair: DirPair) => {
		setDeleteTarget(dirPair)
		setDeleteOpen(true)
	}

	const handleDeleteConfirm = () => {
		if (!deleteTarget) return
		deleteDirPair(deleteTarget.id)
		setDeleteOpen(false)
		setDeleteTarget(null)
	}

	return (
		<>
			<aside className='sidebar'>
				<div className='sidebar-header'>
					<div className='sidebar-header-main'>
						<HardDrive size={24} />
						<span className='sidebar-title'>File Desk</span>
					</div>
					<div className='sidebar-header-actions'>
						<button
							className='sidebar-header-action'
							onClick={handleCreateDirPair}
							title='Save current dir pair'
							aria-label='Save current dir pair'
						>
							<Plus size={16} />
						</button>
						<button
							className='sidebar-header-action'
							onClick={handleCreateEmptyDirPair}
							title='Create empty dir pair'
							aria-label='Create empty dir pair'
						>
							<FolderPlus size={16} />
						</button>
						<Popover.Root>
							<Popover.Trigger asChild>
								<button
									type='button'
									className='task-popover-trigger'
									aria-label='Open task panel'
									title='Tasks'
								>
									<ListTodo size={16} />
								</button>
							</Popover.Trigger>
							<Popover.Portal>
								<Theme
									appearance='light'
									accentColor='indigo'
									grayColor='slate'
									panelBackground='solid'
									radius='large'
									scaling='100%'
								>
									<Popover.Content
										className='task-popover-content'
										side='right'
										sideOffset={12}
										align='start'
									>
										<TaskPanel />
										<Popover.Arrow className='task-popover-arrow' />
									</Popover.Content>
								</Theme>
							</Popover.Portal>
						</Popover.Root>
					</div>
				</div>
				<nav className='sidebar-nav'>
					{dirPairs.length === 0 ? (
						<div className='sidebar-empty'>
							<p>No dir pairs yet</p>
							<div className='sidebar-empty-actions'>
								<button className='sidebar-create-btn' onClick={handleCreateDirPair}>
									Save current pair
								</button>
								<button
									className='sidebar-create-btn'
									onClick={handleCreateEmptyDirPair}
								>
									Create empty pair
								</button>
							</div>
						</div>
					) : (
						dirPairs.map((dirPair) => (
							<div
								key={dirPair.id}
								className={`sidebar-item ${
									dirPair.id === activeDirPairId ? 'active' : ''
								}`}
							>
								<button
									className='sidebar-item-main'
									onClick={() => void switchDirPair(dirPair.id)}
								>
									<span className='sidebar-item-row'>
										<span className='sidebar-item-label'>Left</span>
										<PathValue
											path={dirPair.leftPath}
											comparedPath={dirPair.rightPath}
										/>
									</span>
									<span className='sidebar-item-row'>
										<span className='sidebar-item-label'>Right</span>
										<PathValue
											path={dirPair.rightPath}
											comparedPath={dirPair.leftPath}
										/>
									</span>
								</button>
								<div className='sidebar-item-actions'>
									<button
										className='sidebar-item-action'
										onClick={() => openDeleteDialog(dirPair)}
										title='Delete'
										aria-label={`Delete ${dirPair.leftPath || '/'} | ${dirPair.rightPath || '/'}`}
									>
										<Trash2 size={14} />
									</button>
								</div>
							</div>
						))
					)}
				</nav>
			</aside>

			<AlertDialog.Root
				open={deleteOpen}
				onOpenChange={(open) => {
					setDeleteOpen(open)
					if (!open) {
						setDeleteTarget(null)
					}
				}}
			>
				<AlertDialog.Portal>
					<Theme
						appearance='light'
						accentColor='indigo'
						grayColor='slate'
						panelBackground='solid'
						radius='large'
						scaling='100%'
					>
						<AlertDialog.Overlay className='dialog-overlay' />
						<AlertDialog.Content className='dialog-content'>
							<AlertDialog.Title className='dialog-title'>Delete Dir Pair</AlertDialog.Title>
							<AlertDialog.Description className='dialog-description'>
								Left: {deleteTarget?.leftPath || '/'}
								<br />
								Right: {deleteTarget?.rightPath || '/'}
							</AlertDialog.Description>
							<Flex className='dialog-actions' gap='2' justify='end'>
								<AlertDialog.Cancel asChild>
									<Button variant='soft' color='gray'>
										Cancel
									</Button>
								</AlertDialog.Cancel>
								<AlertDialog.Action asChild>
									<Button color='red' onClick={handleDeleteConfirm}>
										Delete
									</Button>
								</AlertDialog.Action>
							</Flex>
						</AlertDialog.Content>
					</Theme>
				</AlertDialog.Portal>
			</AlertDialog.Root>
		</>
	)
}
