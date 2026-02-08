import { Toast } from "radix-ui";
import { useToast } from "./useToast";
import { X } from "lucide-react";

export function ToastProvider() {
	const { open, message, variant, setOpen } = useToast();

	return (
		<Toast.Provider swipeDirection="right" duration={3000}>
			<Toast.Root
				className={`toast-root ${variant}`}
				open={open}
				onOpenChange={setOpen}
			>
				<Toast.Description className="toast-description">
					{message}
				</Toast.Description>
				<Toast.Close className="toast-close" aria-label="Close">
					<X size={14} />
				</Toast.Close>
			</Toast.Root>
			<Toast.Viewport className="toast-viewport" />
		</Toast.Provider>
	);
}
