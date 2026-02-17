import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Popover } from 'radix-ui'
import { Theme, Tooltip } from '@radix-ui/themes'
import { FolderPlus, HardDrive, ListTodo, Loader2, Plus, Trash2 } from 'lucide-react'
import { TaskPanel } from '@/components/Tasks/TaskPanel'
import { useFileStore, usePanePath } from '@/store/file-store'
import { listTasks } from '@/lib/api-client'
import type { BackgroundTask } from '@/types'

const PATH_DIFF_MIN_LENGTH = 18
const TASK_FETCH_LIMIT = 120

function isActiveTask(task: BackgroundTask): boolean {
	return task.status === 'queued' || task.status === 'running'
}

function formatTaskOperation(task: BackgroundTask): string {
	return task.operation === 'copy' ? 'Copy' : 'Move'
}

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

function IconHelpTooltip({
	content,
	children,
}: {
	content: string
	children: ReactNode
}) {
	return (
		<Tooltip content={content} side='top' delayDuration={120}>
			<span style={{ display: 'inline-flex' }}>{children}</span>
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
	const [activeTasks, setActiveTasks] = useState<BackgroundTask[]>([])
	const [taskStatusError, setTaskStatusError] = useState<string | null>(null)

	useEffect(() => {
		let disposed = false
		let inFlight = false

		const tick = async () => {
			if (disposed || inFlight) return
			inFlight = true
			try {
				const { tasks } = await listTasks(TASK_FETCH_LIMIT)
				if (!disposed) {
					setActiveTasks(tasks.filter((task) => isActiveTask(task)))
					setTaskStatusError(null)
				}
			} catch (err) {
				if (!disposed) {
					setTaskStatusError((err as Error).message)
				}
			} finally {
				inFlight = false
			}
		}

		void tick()
		const intervalId = window.setInterval(() => {
			void tick()
		}, 1500)

		return () => {
			disposed = true
			window.clearInterval(intervalId)
		}
	}, [])

	const primaryActiveTask = useMemo(() => {
		return activeTasks.find((task) => task.status === 'running') ?? activeTasks[0] ?? null
	}, [activeTasks])

	const activeTaskCount = activeTasks.length
	const hasActiveTasks = activeTaskCount > 0
	const taskStatusTitle = hasActiveTasks
		? `${activeTaskCount} active task${activeTaskCount === 1 ? '' : 's'}`
		: 'No active tasks'
	const taskStatusDetail = taskStatusError
		? 'Task status unavailable'
		: primaryActiveTask
			? formatTaskOperation(primaryActiveTask)
			: 'Idle'

	const handleCreateDirPair = () => {
		createDirPair(leftPath, rightPath)
	}

	const handleCreateEmptyDirPair = () => {
		void createEmptyDirPair()
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
						<IconHelpTooltip content='Save current dir pair'>
							<button
								className='sidebar-header-action'
								onClick={handleCreateDirPair}
								aria-label='Save current dir pair'
							>
								<Plus size={16} />
							</button>
						</IconHelpTooltip>
						<IconHelpTooltip content='Create empty dir pair'>
							<button
								className='sidebar-header-action'
								onClick={handleCreateEmptyDirPair}
								aria-label='Create empty dir pair'
							>
								<FolderPlus size={16} />
							</button>
						</IconHelpTooltip>
					</div>
				</div>
				<Popover.Root>
					<Tooltip content='Tasks' side='top' delayDuration={120}>
						<Popover.Trigger asChild>
							<button
								type='button'
								className={`sidebar-task-status ${hasActiveTasks ? 'active' : ''}`}
								aria-label={
									hasActiveTasks
										? `Open task panel (${activeTaskCount} active)`
										: 'Open task panel'
								}
							>
								<div className='sidebar-task-status-main'>
									{hasActiveTasks ? (
										<Loader2 size={14} className='task-spin sidebar-task-status-icon' />
									) : (
										<ListTodo size={14} className='sidebar-task-status-icon' />
									)}
									<span className='sidebar-task-status-title'>{taskStatusTitle}</span>
								</div>
								<span className='sidebar-task-status-detail'>{taskStatusDetail}</span>
							</button>
						</Popover.Trigger>
					</Tooltip>
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
									<IconHelpTooltip content='Delete'>
										<button
											className='sidebar-item-action'
											onClick={() => deleteDirPair(dirPair.id)}
											aria-label={`Delete ${dirPair.leftPath || '/'} | ${dirPair.rightPath || '/'}`}
										>
											<Trash2 size={14} />
										</button>
									</IconHelpTooltip>
								</div>
							</div>
						))
					)}
				</nav>
			</aside>

		</>
	)
}
