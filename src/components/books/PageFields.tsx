"use client";
import { useEffect, useRef, useState } from "react";
import { formatPages, MAX_PAGE } from "@/lib/pages";

export type PageDraft = { start: string; end: string; total: string; open: boolean };

export type PageContext = {
	startPage: number | null;
	lastRecordedPage: number | null;
	tracksPages: boolean;
	readerPageCount: number | null;
	catalogPageCount: number | null;
};

export const EMPTY_PAGES: PageDraft = { start: "", end: "", total: "", open: false };

export function initialPages(context: PageContext, saved: { startPage: number | null; endPage: number | null } | null): PageDraft {
	const total = context.readerPageCount ?? context.catalogPageCount;
	return {
		start: String((saved ? saved.startPage : context.startPage) ?? ""),
		end: String(saved?.endPage ?? ""),
		total: String(total ?? ""),
		open: saved?.endPage != null || context.tracksPages,
	};
}

export function parsePage(value: string): number | null {
	if (value.trim() === "") return null;
	const page = Number(value);
	return Number.isInteger(page) && page >= 0 && page <= MAX_PAGE ? page : null;
}

// What a save sends. An empty "Stopped at" means the reader isn't recording
// pages this time, whatever "Picked up at" was pre-filled with.
export function pagesForSave(draft: PageDraft, context: PageContext | undefined) {
	const endPage = parsePage(draft.end);
	const startPage = endPage == null ? null : parsePage(draft.start);
	const total = parsePage(draft.total) || null;
	// Recording a page next to the total counts as accepting it for this copy.
	const keepTotal = total != null && context && total !== context.readerPageCount && (endPage != null || total !== context.catalogPageCount);
	return { startPage, endPage, bookPageCount: keepTotal ? total : undefined };
}

export function pageError(draft: PageDraft): string | null {
	const end = parsePage(draft.end);
	const start = parsePage(draft.start);
	if (draft.end.trim() !== "" && end == null) return `Use a page number from 0 to ${MAX_PAGE.toLocaleString("en")}.`;
	if (draft.start.trim() !== "" && start == null) return `Use a page number from 0 to ${MAX_PAGE.toLocaleString("en")}.`;
	if (draft.total.trim() !== "" && !parsePage(draft.total)) return "Use a page count of at least 1.";
	if (end != null && start != null && end < start) return `You picked up at page ${start}. Change that if you went back.`;
	return null;
}

interface Props {
	draft: PageDraft;
	context: PageContext;
	onChange: (draft: PageDraft) => void;
	// The collapsed check-in only asks where you stopped.
	compact?: boolean;
	idPrefix: string;
}

export function PageFields({ draft, context, onChange, compact = false, idPrefix }: Props) {
	const endRef = useRef<HTMLInputElement>(null);
	const focusEnd = useRef(false);
	// "150" passes through "1" and "15" on the way, so the ordering error
	// waits until the reader leaves the field. Saving stays blocked meanwhile.
	const [typingEnd, setTypingEnd] = useState(false);
	const set = (patch: Partial<PageDraft>) => onChange({ ...draft, ...patch });
	const start = parsePage(draft.start);
	const end = parsePage(draft.end);
	const total = parsePage(draft.total) || null;
	const fullError = pageError(draft);
	const error = typingEnd && end != null && start != null && end < start ? null : fullError;
	const totalIsCatalog = context.readerPageCount == null && context.catalogPageCount != null && total === context.catalogPageCount;

	useEffect(() => {
		if (draft.open && focusEnd.current) {
			focusEnd.current = false;
			endRef.current?.focus();
		}
	}, [draft.open]);

	if (!draft.open) {
		return (
			<button
				type="button"
				onClick={() => {
					focusEnd.current = true;
					set({ open: true });
				}}
				className="btn-quiet -ml-3 text-sm"
			>
				+ Add where you stopped
			</button>
		);
	}

	const endInput = (
		<input
			ref={endRef}
			id={`${idPrefix}-end`}
			type="number"
			inputMode="numeric"
			min={0}
			max={MAX_PAGE}
			value={draft.end}
			onChange={(event) => set({ end: event.target.value })}
			onFocus={() => setTypingEnd(true)}
			onBlur={() => setTypingEnd(false)}
			placeholder="Page"
			aria-invalid={Boolean(error) && end != null}
			aria-describedby={`${idPrefix}-summary`}
			className="brutalist-input text-center"
		/>
	);

	const summary = error ? (
		<p id={`${idPrefix}-summary`} role="alert" className="form-error">{error}</p>
	) : end != null && total != null && end > total ? (
		<p id={`${idPrefix}-summary`} className="text-xs" style={{ color: "var(--muted)" }}>
			That&apos;s past page {total}.{" "}
			<button type="button" onClick={() => set({ total: String(end) })} className="font-semibold underline" style={{ color: "var(--accent-ink)" }}>
				Make {end} the total
			</button>
		</p>
	) : end != null && start != null ? (
		<p id={`${idPrefix}-summary`} className="text-sm font-semibold" style={{ color: "var(--accent-ink)" }}>{formatPages(end - start)}</p>
	) : end != null ? (
		<p id={`${idPrefix}-summary`} className="text-xs" style={{ color: "var(--muted)" }}>
			Saves your place without counting pages read.{!compact && " Add where you picked up to count them."}
		</p>
	) : (
		<span id={`${idPrefix}-summary`} hidden />
	);

	if (compact) {
		return (
			<div className="space-y-2">
				<label htmlFor={`${idPrefix}-end`} className="eyebrow block">
					Stopped at page <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span>
				</label>
				<div className="flex items-center gap-3">
					<div className="w-28">{endInput}</div>
					{total != null && <span className="text-sm" style={{ color: "var(--muted)" }}>of {total.toLocaleString("en")}</span>}
				</div>
				{summary}
			</div>
		);
	}

	return (
		<fieldset className="space-y-2">
			<legend className="eyebrow mb-2">
				Pages <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span>
			</legend>
			<div className="grid grid-cols-3 gap-2">
				<div className="min-w-0">
					<label htmlFor={`${idPrefix}-start`} className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Picked up at</label>
					<input
						id={`${idPrefix}-start`}
						type="number"
						inputMode="numeric"
						min={0}
						max={MAX_PAGE}
						value={draft.start}
						onChange={(event) => set({ start: event.target.value })}
						placeholder="Page"
						className="brutalist-input text-center"
					/>
				</div>
				<div className="min-w-0">
					<label htmlFor={`${idPrefix}-end`} className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Stopped at</label>
					{endInput}
				</div>
				<div className="min-w-0">
					<label htmlFor={`${idPrefix}-total`} className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Pages in book</label>
					<input
						id={`${idPrefix}-total`}
						type="number"
						inputMode="numeric"
						min={1}
						max={MAX_PAGE}
						value={draft.total}
						onChange={(event) => set({ total: event.target.value })}
						placeholder="Total"
						aria-describedby={totalIsCatalog ? `${idPrefix}-total-hint` : undefined}
						className="brutalist-input text-center"
					/>
				</div>
			</div>
			{start === 0 && draft.start !== "" && <p className="text-xs" style={{ color: "var(--muted)" }}>Picking up at 0 means from the start.</p>}
			{draft.start === "" && context.lastRecordedPage != null && (
				<p className="text-xs" style={{ color: "var(--muted)" }}>
					Your last noted page was {context.lastRecordedPage}, with sittings since that didn&apos;t note one. Fill in where you picked up if you know it.
				</p>
			)}
			{totalIsCatalog && (
				<p id={`${idPrefix}-total-hint`} className="text-xs" style={{ color: "var(--muted)" }}>
					Open Library&apos;s count. Change it to match your copy.
				</p>
			)}
			{summary}
		</fieldset>
	);
}
