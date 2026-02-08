import { create } from "zustand";

interface ToastState {
	open: boolean;
	message: string;
	variant: "success" | "error";
	showToast: (message: string, variant?: "success" | "error") => void;
	setOpen: (open: boolean) => void;
}

export const useToast = create<ToastState>((set) => ({
	open: false,
	message: "",
	variant: "success",
	showToast: (message, variant = "success") => {
		set({ open: true, message, variant });
	},
	setOpen: (open) => set({ open }),
}));
