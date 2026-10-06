"use client";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

interface ConfirmOptions {
	title: string;
	message?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
	const ctx = useContext(ConfirmContext);
	if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
	return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
	const [options, setOptions] = useState<ConfirmOptions | null>(null);
	const resolverRef = useRef<((value: boolean) => void) | null>(null);
	const cancelButtonRef = useRef<HTMLButtonElement>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	const previousActiveElement = useRef<HTMLElement | null>(null);

	const confirm = useCallback<ConfirmFn>((opts) => {
		setOptions(opts);
		return new Promise<boolean>((resolve) => {
			resolverRef.current = resolve;
		});
	}, []);

	const close = useCallback((result: boolean) => {
		resolverRef.current?.(result);
		resolverRef.current = null;
		setOptions(null);
	}, []);

	useEffect(() => {
		if (!options) return;
		previousActiveElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		cancelButtonRef.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close(false);
			if (e.key !== "Tab" || !dialogRef.current) return;
			const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex]:not([tabindex='-1'])"));
			if (!focusable.length) return;
			const first = focusable[0]!;
			const last = focusable[focusable.length - 1]!;
			if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
			if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
		};
		document.addEventListener("keydown", onKey);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = prevOverflow;
			previousActiveElement.current?.focus();
		};
	}, [options, close]);

	return (
		<ConfirmContext.Provider value={confirm}>
			{children}
			{options &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby="confirm-dialog-title"
						onClick={() => close(false)}
						style={{
							position: "fixed",
							inset: 0,
							zIndex: 100,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							padding: "1rem",
							background: "rgba(28, 25, 23, 0.4)",
						}}
					>
						<div
							ref={dialogRef}
							onClick={(e) => e.stopPropagation()}
							className="brutalist-card slideUp"
							style={{
								background: "var(--bg)",
								padding: "1.5rem",
								maxWidth: "26rem",
								width: "100%",
								maxHeight: "calc(100dvh - 2rem)",
								overflowY: "auto",
							}}
						>
							<h2
								id="confirm-dialog-title"
								className="text-2xl font-bold mb-2"
								style={{ fontFamily: "var(--font-cormorant)" }}
							>
								{options.title}
							</h2>
							{options.message && (
								<p
									className="text-sm mb-5"
									style={{ color: "var(--muted)" }}
								>
									{options.message}
								</p>
							)}
							<div className="flex flex-wrap gap-2.5 justify-end">
								<button
									ref={cancelButtonRef}
									type="button"
									onClick={() => close(false)}
									className="btn-secondary"
								>
									{options.cancelLabel ?? "Cancel"}
								</button>
								<button
									type="button"
									onClick={() => close(true)}
									className={options.danger ? "btn-danger" : "btn-primary"}
								>
									{options.confirmLabel ?? "Confirm"}
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</ConfirmContext.Provider>
	);
}
