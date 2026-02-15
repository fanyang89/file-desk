import { Dialog } from 'radix-ui'
import { Button, Flex, Theme } from '@radix-ui/themes'
import type { TaskOperation } from '@/types'

interface TransferConflictDialogProps {
	open: boolean
	busy: boolean
	operation: TaskOperation
	targetPath: string
	conflictingNames: string[]
	onOpenChange: (open: boolean) => void
	onConfirmOverwrite: () => void
	onConfirmSkip: () => void
}

function formatPath(path: string): string {
	return path ? `/${path}` : '/'
}

const MAX_VISIBLE_CONFLICTS = 8

export function TransferConflictDialog({
	open,
	busy,
	operation,
	targetPath,
	conflictingNames,
	onOpenChange,
	onConfirmOverwrite,
	onConfirmSkip,
}: TransferConflictDialogProps) {
	const visibleNames = conflictingNames.slice(0, MAX_VISIBLE_CONFLICTS)
	const hiddenCount = Math.max(0, conflictingNames.length - visibleNames.length)
	const actionText = operation === 'copy' ? 'copy' : 'move'

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Theme
					appearance="light"
					accentColor="indigo"
					grayColor="slate"
					panelBackground="solid"
					radius="large"
					scaling="100%"
				>
					<Dialog.Overlay className="dialog-overlay" />
					<Dialog.Content className="dialog-content">
						<Dialog.Title className="dialog-title">Conflicts detected</Dialog.Title>
						<Dialog.Description className="dialog-description">
							{conflictingNames.length} item
							{conflictingNames.length === 1 ? '' : 's'} already exist in{' '}
							{formatPath(targetPath)}.
						</Dialog.Description>
						<div className="transfer-conflict-list-wrap">
							<ul className="transfer-conflict-list">
								{visibleNames.map((name) => (
									<li key={name} className="transfer-conflict-item">
										{name}
									</li>
								))}
							</ul>
							{hiddenCount > 0 ? (
								<div className="transfer-conflict-more">+ {hiddenCount} more</div>
							) : null}
						</div>
						<Flex className="dialog-actions" gap="2" justify="end">
							<Button
								type="button"
								variant="soft"
								color="gray"
								disabled={busy}
								onClick={() => onOpenChange(false)}
							>
								Cancel
							</Button>
							<Button
								type="button"
								variant="soft"
								disabled={busy}
								onClick={onConfirmSkip}
							>
								Skip conflicts and {actionText}
							</Button>
							<Button
								type="button"
								color="red"
								disabled={busy}
								onClick={onConfirmOverwrite}
							>
								Overwrite and {actionText}
							</Button>
						</Flex>
					</Dialog.Content>
				</Theme>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
