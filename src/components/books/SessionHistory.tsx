"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatMinutes } from "@/lib/formatMinutes";
import { dateOnlyParts } from "@/lib/dates";

interface Props {
	bookId: string;
}

export function SessionHistory({ bookId }: Props) {
	const { data: sessions } = trpc.readingSessions.forBook.useQuery({
		bookId,
	});
	const [revealedSessionIds, setRevealedSessionIds] = useState<Set<string>>(() => new Set());

	if (!sessions || sessions.length === 0) return null;

	return (
		<div className="mt-8 max-w-2xl">
			<h2
				className="text-xl font-light mb-4"
				style={{ fontFamily: "var(--font-cormorant)" }}
			>
				Your sessions
			</h2>
			<div className="space-y-3">
				{sessions.map((session) => {
					const date = dateOnlyParts(session.sessionDate);
					const isRevealed = revealedSessionIds.has(session.id);
					return (
					<div
						key={session.id}
						className="brutalist-card p-4 flex gap-4 items-start"
					>
						<div
							className="shrink-0 text-center"
							style={{ minWidth: 44 }}
						>
							<p
								className="text-xs font-bold uppercase tracking-wider"
								style={{ color: "var(--muted)" }}
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
								<span>★ {session.rating}</span>
								<span>·</span>
								<span>{formatMinutes(session.minutes)}</span>
							</div>
							{session.note && (session.hasSpoiler ? (
								<button type="button" className="text-sm leading-relaxed" style={{ color: "var(--fg)", filter: isRevealed ? "none" : "blur(4px)" }} aria-expanded={isRevealed} onClick={() => setRevealedSessionIds((previous) => {
									const next = new Set(previous);
									if (next.has(session.id)) next.delete(session.id); else next.add(session.id);
									return next;
									})}>{isRevealed ? session.note : '[Spoiler — tap to reveal]'}</button>
							) : <p className="text-sm leading-relaxed" style={{ color: "var(--fg)" }}>{session.note}</p>)}
						</div>
					</div>
					);
				})}
			</div>
		</div>
	);
}
