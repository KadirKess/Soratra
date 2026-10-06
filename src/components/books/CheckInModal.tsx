"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc/client";
import { StarRating } from "./StarRating";
import { MinutesPicker } from "./MinutesPicker";
import { formatMinutes } from "@/lib/formatMinutes";
import { localDateInTimeZone } from "@/lib/dates";
import type { Book, ReadingSession } from "@/server/db";

const DEFAULT_MINUTES = 30;

export type CheckInResult = {
	session: ReadingSession;
	streak: number;
	todayDate: string;
	heatmapStart: string;
	todayLogged: string[];
	todayMinutes: number;
	sessionDateMinutes: number;
};

interface Props {
	book: Book;
	onClose: () => void;
	onSuccess: (result: CheckInResult) => void;
	sessionDate?: string;
	knownTodayEntry?: boolean;
	todayDate?: string;
}

export function CheckInModal({ book, onClose, onSuccess, sessionDate, knownTodayEntry = false, todayDate }: Props) {
	const { data: me } = trpc.users.me.useQuery(undefined, { enabled: !todayDate });
	const resolvedToday = useMemo(() => todayDate ?? (me ? localDateInTimeZone(new Date(), me.timezone ?? "UTC") : undefined), [me, todayDate]);
	const [selectedDate, setSelectedDate] = useState<string | undefined>(sessionDate ?? todayDate);
	const [forceLookup, setForceLookup] = useState(false);
	const entryDate = selectedDate ?? resolvedToday;
	const queryDate = entryDate ?? "1970-01-01";
	const shouldLookup = Boolean(sessionDate) || forceLookup || knownTodayEntry || (Boolean(entryDate) && entryDate !== resolvedToday);
	const existing = trpc.readingSessions.forBookDate.useQuery(
		{ bookId: book.id, sessionDate: queryDate },
		{ enabled: Boolean(entryDate && shouldLookup), retry: 1, refetchOnMount: "always" },
	);
	const dialogRef = useRef<HTMLDivElement>(null);
	const previousActiveElement = useRef<HTMLElement | null>(null);
	const [rating, setRating] = useState<number | null>(null);
	const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
	const [note, setNote] = useState("");
	const [hasSpoiler, setHasSpoiler] = useState(false);
	const [expanded, setExpanded] = useState(Boolean(sessionDate));
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	useEffect(() => {
		if (!sessionDate && !selectedDate && resolvedToday) setSelectedDate(resolvedToday);
	}, [resolvedToday, selectedDate, sessionDate]);

	useEffect(() => {
		if (!existing.data) return;
		setRating(Number(existing.data.rating));
		setMinutes(existing.data.minutes);
		setNote(existing.data.note ?? "");
		setHasSpoiler(existing.data.hasSpoiler === 1);
		setExpanded(true);
	}, [existing.data]);

	useEffect(() => {
		if (!isMounted) return;
		previousActiveElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const first = dialogRef.current?.querySelector<HTMLElement>("button, input, textarea, [tabindex]:not([tabindex='-1'])");
		first?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
			if (event.key !== "Tab" || !dialogRef.current) return;
			const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
			if (!focusable.length) return;
			const firstElement = focusable[0]!;
			const lastElement = focusable[focusable.length - 1]!;
			if (event.shiftKey && document.activeElement === firstElement) { event.preventDefault(); lastElement.focus(); }
			if (!event.shiftKey && document.activeElement === lastElement) { event.preventDefault(); firstElement.focus(); }
		};
		document.addEventListener("keydown", onKeyDown);
		return () => { document.removeEventListener("keydown", onKeyDown); previousActiveElement.current?.focus(); };
	}, [isMounted, onClose]);

	useEffect(() => {
		if (!isMounted) return;
		const { body, documentElement } = document;
		const scrollY = window.scrollY;
		const previousBodyStyles = {
			left: body.style.left,
			overflow: body.style.overflow,
			position: body.style.position,
			right: body.style.right,
			top: body.style.top,
			width: body.style.width,
		};
		const previousHtmlStyles = {
			overflow: documentElement.style.overflow,
			overscrollBehavior: documentElement.style.overscrollBehavior,
		};

		body.style.left = "0";
		body.style.overflow = "hidden";
		body.style.position = "fixed";
		body.style.right = "0";
		body.style.top = `-${scrollY}px`;
		body.style.width = "100%";
		documentElement.style.overflow = "hidden";
		documentElement.style.overscrollBehavior = "none";

		return () => {
			body.style.left = previousBodyStyles.left;
			body.style.overflow = previousBodyStyles.overflow;
			body.style.position = previousBodyStyles.position;
			body.style.right = previousBodyStyles.right;
			body.style.top = previousBodyStyles.top;
			body.style.width = previousBodyStyles.width;
			documentElement.style.overflow = previousHtmlStyles.overflow;
			documentElement.style.overscrollBehavior = previousHtmlStyles.overscrollBehavior;
			window.scrollTo(0, scrollY);
		};
	}, [isMounted]);

	const log = trpc.readingSessions.log.useMutation({
		onSuccess: (result) => {
			onSuccess(result);
			onClose();
		},
		onError: (error) => {
			if (error.data?.code === "CONFLICT") {
				setForceLookup(true);
				void existing.refetch();
			}
		},
	});

	useEffect(() => {
		if (!forceLookup || !existing.isSuccess) return;
		log.reset();
		setForceLookup(false);
	}, [existing.isSuccess, forceLookup, log]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!rating || minutes < 1) return;
		log.mutate({
			bookId: book.id,
			sessionDate: queryDate,
			rating,
			minutes,
			note: note || undefined,
			hasSpoiler,
			expectedRevision: existing.data?.revision ?? 0,
		});
	}

	function selectDate(value: string) {
		setSelectedDate(value);
		setRating(null);
		setMinutes(DEFAULT_MINUTES);
		setNote("");
		setHasSpoiler(false);
		setForceLookup(false);
	}

	const canSubmit = Boolean(rating && minutes >= 1 && !existing.isFetching);
	const isLoadingEntry = !entryDate || (shouldLookup && (existing.isLoading || existing.isFetching));
	const isConflict = log.error?.data?.code === "CONFLICT";
	const entryTitle = isLoadingEntry
		? "Loading today’s entry"
		: existing.data
			? "Edit today’s entry"
			: "Log today’s reading";

	if (!isMounted) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
			style={{
				background: "rgba(0,0,0,0.4)",
				backdropFilter: "blur(4px)",
			}}
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
			role="dialog"
			aria-modal="true"
			aria-labelledby="check-in-title"
		>
			<div
				ref={dialogRef}
				className="w-full min-w-0 max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl p-5 space-y-5 sm:max-w-md sm:p-6"
				style={{
					background: "var(--surface)",
					border: "2px solid var(--border)",
					boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
				}}
			>
				<div className="flex items-start justify-between gap-3">
					<div>
						<h2
							id="check-in-title"
							className="text-xl font-bold leading-tight"
							style={{ fontFamily: "var(--font-cormorant)" }}
						>
							{entryTitle}
						</h2>
						<p className="text-sm mt-1 font-semibold" style={{ color: "var(--fg)" }}>{book.title}</p>
						<p
							className="text-sm mt-0.5"
							style={{ color: "var(--muted)" }}
						>
							{book.authors.join(", ")}
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="shrink-0 flex h-11 w-11 items-center justify-center text-lg font-bold"
						style={{ color: "var(--muted)" }}
					>
						✕
					</button>
				</div>

				{isLoadingEntry ? (
					<div className="brutalist-card p-4 space-y-2" role="status" style={{ background: "var(--bg)" }}>
						<p className="font-semibold">Getting your entry for {entryDate}</p>
						<p className="text-sm" style={{ color: "var(--muted)" }}>We’ll show the saved details before you can make changes.</p>
					</div>
				) : existing.isError ? (
					<div className="brutalist-card p-4 space-y-3" role="alert" style={{ background: "var(--blush)" }}>
						<p className="font-semibold">We couldn’t load this entry.</p>
						<p className="text-sm" style={{ color: "var(--muted)" }}>Try again before saving, so we never make the editing state unclear.</p>
						<button type="button" onClick={() => existing.refetch()} className="btn-secondary">Try again</button>
					</div>
				) : (
				<form onSubmit={handleSubmit} className="space-y-5">
					<div>
						<label htmlFor="check-in-rating"
							className="block text-xs font-bold uppercase tracking-wider mb-2"
							style={{ color: "var(--muted)" }}
						>
							How was today&apos;s session?
						</label>
						<StarRating id="check-in-rating" value={rating} onChange={setRating} ariaLabel="How was today's session?" />
					</div>

					{expanded ? (
						<>
							<div>
								<label htmlFor="check-in-date" className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
									Date
								</label>
								{sessionDate ? (
									<p className="text-sm" style={{ color: "var(--fg)" }}>{entryDate}</p>
								) : (
									<input id="check-in-date" type="date" value={entryDate ?? ""} max={resolvedToday} onChange={(event) => selectDate(event.target.value)} className="brutalist-input check-in-date-input w-full min-w-0 max-w-full" />
								)}
							</div>
							<div>
							<label htmlFor="check-in-minutes"
									className="block text-xs font-bold uppercase tracking-wider mb-2"
									style={{ color: "var(--muted)" }}
								>
									Time spent
								</label>
								<MinutesPicker
									id="check-in-minutes"
									value={minutes}
									onChange={setMinutes}
								/>
							</div>

							<div>
							<label htmlFor="check-in-note"
									className="block text-xs font-bold uppercase tracking-wider mb-2"
									style={{ color: "var(--muted)" }}
								>
									Notes{" "}
									<span
										style={{
											fontWeight: 400,
											textTransform: "none",
										}}
									>
										(optional)
									</span>
								</label>
								<textarea
									id="check-in-note"
									value={note}
									onChange={(e) => setNote(e.target.value)}
									placeholder="What did you think?"
									rows={3}
									className="brutalist-input w-full resize-none"
								/>
								{note.length > 0 && (
									<label className="flex items-center gap-2 mt-2 cursor-pointer text-sm">
										<input
											type="checkbox"
											checked={hasSpoiler}
											onChange={(e) =>
												setHasSpoiler(e.target.checked)
											}
										/>
										<span style={{ color: "var(--muted)" }}>
											Contains spoilers
										</span>
									</label>
								)}
							</div>
						</>
					) : (
						<button
							type="button"
							onClick={() => setExpanded(true)}
							className="flex items-center justify-between w-full text-sm"
							style={{ color: "var(--muted)" }}
						>
							<span>
								Today · {formatMinutes(minutes)}
							</span>
							<span
								className="font-semibold"
								style={{ color: "var(--accent-ink)" }}
							>
								Add time &amp; notes
							</span>
						</button>
					)}
					{log.error && <p role="alert" className="text-sm" style={{ color: "var(--accent)" }}>{isConflict ? "This entry changed in another tab. Loading its latest version…" : "Your check-in could not be saved. Please try again."}</p>}
					<button
						type="submit"
						disabled={!canSubmit || log.isPending}
						className="w-full brutalist-card py-3 text-sm font-bold"
						style={{
							background:
								canSubmit
									? "var(--accent)"
									: "var(--border)",
							color:
								canSubmit
									? "var(--on-accent)"
									: "var(--muted)",
							cursor:
								canSubmit
									? "pointer"
									: "not-allowed",
							border: "2px solid var(--fg)",
							boxShadow:
								canSubmit
									? "3px 3px 0 var(--fg)"
									: "none",
						}}
					>
							{log.isPending
								? "Saving…"
								: existing.data
								? "Update entry"
									: "Save today’s entry"}
					</button>
				</form>
				)}
			</div>
		</div>,
		document.body,
	);
}
