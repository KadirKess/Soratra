"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatMinutes } from "@/lib/formatMinutes";
import { dateOnlyParts } from "@/lib/dates";
import { StarIcon } from "@/components/ui/Icon";
import { effectivePageCount, pagesPerHour, summarizePages } from "@/lib/pages";
import { ProgressRule } from "./ProgressRule";

interface Props {
	bookId: string;
	catalogPageCount: number | null;
}

export function SessionHistory({ bookId, catalogPageCount }: Props) {
	const { data: sessions } = trpc.readingSessions.forBook.useQuery({
		bookId,
	});
	const { data: userBook } = trpc.userBooks.getForBook.useQuery({ bookId });
	const [revealedSessionIds, setRevealedSessionIds] = useState<Set<string>>(() => new Set());

	if (!sessions || sessions.length === 0) return null;

	// Sessions come newest first, so the first with a page is where the reader is.
	const currentPage = sessions.find((session) => session.endPage != null)?.endPage ?? null;
	const total = effectivePageCount(userBook?.pageCount, catalogPageCount);
	const pace = pagesPerHour(summarizePages(sessions));

	return (
		<div className="mt-8 max-w-2xl">
			<h2
				className="text-xl font-light mb-4"
				style={{ fontFamily: "var(--font-cormorant)" }}
			>
				Your sessions
			</h2>
			{currentPage != null && (
				<div className="mb-4 max-w-sm space-y-1">
					{userBook?.status !== "read" && <ProgressRule page={currentPage} total={total} size="desk" />}
					{pace != null && <p className="text-sm" style={{ color: "var(--muted)" }}>About {pace} pages an hour on this book</p>}
				</div>
			)}
			<div className="space-y-3">
				{sessions.map((session) => {
					const date = dateOnlyParts(session.sessionDate);
					const isRevealed = revealedSessionIds.has(session.id);
					return (
					<div
						key={session.id}
						className="card-flat p-4 flex gap-4 items-start"
					>
						<div
							className="shrink-0 text-center"
							style={{ minWidth: 44 }}
						>
							<p
								className="eyebrow"
							>
								{date.month}
							</p>
							<p
								className="text-xl font-bold"
								style={{ fontFamily: "var(--font-cormorant)" }}
							>
								{date.day}
							</p>
						</div>
						<div className="flex-1 min-w-0 space-y-1">
							<div
								className="flex items-center gap-3 text-sm"
								style={{ color: "var(--muted)" }}
							>
								<span className="inline-flex items-center gap-1"><StarIcon size={12} />{session.rating}</span>
								<span>·</span>
								<span>{formatMinutes(session.minutes)}</span>
								{session.endPage != null && (
									<>
										<span aria-hidden="true">·</span>
										<span>{session.startPage != null ? `pages ${session.startPage} to ${session.endPage}` : `to page ${session.endPage}`}</span>
									</>
								)}
							</div>
							{session.note && (session.hasSpoiler ? (
								<button type="button" className="reader-note text-left" style={{ filter: isRevealed ? "none" : "blur(4px)" }} aria-expanded={isRevealed} onClick={() => setRevealedSessionIds((previous) => {
									const next = new Set(previous);
									if (next.has(session.id)) next.delete(session.id); else next.add(session.id);
									return next;
									})}>{isRevealed ? session.note : '[Spoiler — tap to reveal]'}</button>
							) : <p className="reader-note">{session.note}</p>)}
						</div>
					</div>
					);
				})}
			</div>
		</div>
	);
}
