import { Tooltip } from '@radix-ui/themes'
import { FolderPlus, HardDrive, Plus, Trash2 } from 'lucide-react'
import { useFileStore, usePanePath } from '@/store/file-store'

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
			<Tooltip content={fullPath} side="top" delayDuration={120}>
				<span className="sidebar-item-path">{formattedPath}</span>
			</Tooltip>
		)
	}

	return (
		<Tooltip content={fullPath} side="top" delayDuration={120}>
			<span className="sidebar-item-path">
				<span className="sidebar-item-path-prefix">{prefix}</span>
				<span className="sidebar-item-path-diff">{diff}</span>
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

	const handleCreateDirPair = () => {
		createDirPair(leftPath, rightPath)
	}

	const handleCreateEmptyDirPair = () => {
		void createEmptyDirPair()
	}

	const handleDeleteDirPair = (id: string) => {
		deleteDirPair(id)
	}

	return (
		<aside className="sidebar">
			<div className="sidebar-header">
				<div className="sidebar-header-main">
					<HardDrive size={24} />
					<span className="sidebar-title">File Desk</span>
				</div>
				<div className="sidebar-header-actions">
					<button
						className="sidebar-header-action"
						onClick={handleCreateDirPair}
						title="Save current dir pair"
						aria-label="Save current dir pair"
					>
						<Plus size={16} />
					</button>
					<button
						className="sidebar-header-action"
						onClick={handleCreateEmptyDirPair}
						title="Create empty dir pair"
						aria-label="Create empty dir pair"
					>
						<FolderPlus size={16} />
					</button>
				</div>
			</div>
			<nav className="sidebar-nav">
				{dirPairs.length === 0 ? (
					<div className="sidebar-empty">
						<p>No dir pairs yet</p>
						<div className="sidebar-empty-actions">
							<button className="sidebar-create-btn" onClick={handleCreateDirPair}>
								Save current pair
							</button>
							<button className="sidebar-create-btn" onClick={handleCreateEmptyDirPair}>
								Create empty pair
							</button>
						</div>
					</div>
				) : (
					dirPairs.map((dirPair) => (
						<div
							key={dirPair.id}
							className={`sidebar-item ${dirPair.id === activeDirPairId ? 'active' : ''}`}
						>
							<button
								className="sidebar-item-main"
								onClick={() => void switchDirPair(dirPair.id)}
							>
								<span className="sidebar-item-row">
									<span className="sidebar-item-label">Left</span>
									<PathValue
										path={dirPair.leftPath}
										comparedPath={dirPair.rightPath}
									/>
								</span>
								<span className="sidebar-item-row">
									<span className="sidebar-item-label">Right</span>
									<PathValue
										path={dirPair.rightPath}
										comparedPath={dirPair.leftPath}
									/>
								</span>
							</button>
							<div className="sidebar-item-actions">
								<button
									className="sidebar-item-action"
									onClick={() => handleDeleteDirPair(dirPair.id)}
									title="Delete"
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
	)
}
