"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc/client";
import { CheckInModal } from "@/components/books/CheckInModal";
import { HeatmapStrip } from "@/components/ui/HeatmapStrip";
import { Skeleton } from "@/components/ui/Skeleton";
import { QueryErrorCard } from "@/components/ui/QueryErrorCard";
import { formatMinutes } from "@/lib/formatMinutes";
import { dateOnlyParts, monthLabel } from "@/lib/dates";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { CloseIcon, FlameIcon, StarIcon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { CoverPlaceholder } from "@/components/books/CoverPlaceholder";
import { getPastelTint } from "@/lib/pastel";

function JournalSkeleton() {
	return (
		<div className="space-y-8">
			<Skeleton style={{ height: "2.5rem", width: "8rem" }} />
			<div className="grid md:grid-cols-[2fr_1fr_1fr] gap-4">
				<Skeleton style={{ height: "10rem", borderRadius: "12px" }} />
				<Skeleton style={{ height: "10rem", borderRadius: "12px" }} />
				<Skeleton style={{ height: "10rem", borderRadius: "12px" }} />
			</div>
			<div className="grid md:grid-cols-2 gap-6">
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} style={{ height: "3.5rem", borderRadius: "12px" }} />
					))}
				</div>
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} style={{ height: "3.5rem", borderRadius: "12px" }} />
					))}
				</div>
			</div>
			<div className="grid md:grid-cols-2 gap-3">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} style={{ height: "6rem", borderRadius: "12px" }} />
				))}
			</div>
		</div>
	);
}

export default function JournalPage() {
	const [historyOffset, setHistoryOffset] = useState(0);
	const { data: journal, isLoading: journalLoading, isFetching: journalFetching, isError: journalError, refetch: refetchJournal, isRefetching: journalRefetching } =
		trpc.readingSessions.journal.useQuery({ offset: historyOffset }, { placeholderData: (previous) => previous });
	const now = new Date();
	const [showInsights, setShowInsights] = useState(false);
	const [editingSession, setEditingSession] = useState<NonNullable<typeof sessions>[number] | null>(null);
	const [revealedSessionIds, setRevealedSessionIds] = useState<Set<string>>(() => new Set());
	const [insightsPeriod, setInsightsPeriod] = useState<
		"month" | "year" | "all"
	>("month");
	const { data: insights, isLoading: insightsLoading } =
		trpc.readingSessions.periodStats.useQuery(
			{ period: insightsPeriod },
			{ enabled: showInsights },
		);
	const sessions = journal?.recent;
	const monthlyStats = journal?.monthlyStats;
	const yearStats = journal?.yearStats;

	const utils = trpc.useUtils();
	const confirm = useConfirm();

	const invalidateSessionQueries = () => {
		utils.readingSessions.journal.invalidate();
		utils.readingSessions.periodStats.invalidate();
		utils.users.dashboard.invalidate();
	};

	const deleteSession = trpc.readingSessions.delete.useMutation({
		onMutate: async ({ id }) => {
			const input = { offset: historyOffset };
			await utils.readingSessions.journal.cancel(input);
			const previous = utils.readingSessions.journal.getData(input);
			utils.readingSessions.journal.setData(input, (current) => current
				? { ...current, recent: current.recent.filter((session) => session.id !== id) }
				: current);
			return { input, previous };
		},
		onError: (_error, _input, context) => {
			if (context?.previous) utils.readingSessions.journal.setData(context.input, context.previous);
			toast.error("The session could not be deleted. Please try again.");
		},
		onSettled: invalidateSessionQueries,
	});
	const logSession = trpc.readingSessions.log.useMutation({
		onSuccess: invalidateSessionQueries,
	});

	type SessionItem = NonNullable<typeof sessions>[number];
	async function handleDeleteSession(session: SessionItem) {
		const ok = await confirm({
			title: "Delete this session?",
			message: `Your check-in for "${session.book.title}" will be removed.`,
			confirmLabel: "Delete",
			danger: true,
		});
		if (!ok) return;
		deleteSession.mutate(
			{ id: session.id },
			{
				onSuccess: () => {
					toast.success("Session deleted", {
						action: {
							label: "Undo",
							onClick: () =>
								logSession.mutate({
									bookId: session.bookId,
									sessionDate: session.sessionDate.slice(0, 10),
									rating: Number(session.rating),
									minutes: session.minutes,
									note: session.note ?? undefined,
									hasSpoiler: session.hasSpoiler === 1,
									expectedRevision: 0,
								}),
						},
					});
				},
			},
		);
	}

	if (journalLoading && !journal) return <JournalSkeleton />;
	if (journalError) return <QueryErrorCard message="Your journal could not load." onRetry={() => refetchJournal()} retrying={journalRefetching} />;

	const hasTopReads = monthlyStats && monthlyStats.topByTime.length > 0;
	const hasTopRated = monthlyStats && monthlyStats.topByRating.length > 0;
	const months = groupByMonth(sessions ?? []);

	return (
		<div className="space-y-10 max-w-4xl mx-auto">
			<PageHeader title="Journal" description="Every sitting you’ve logged, newest first." />

			<section aria-label="Reading summary" className="brutalist-card tint-section grid md:grid-cols-[1.35fr_1fr_1.35fr]">
				<div className="p-5 sm:p-6 space-y-4">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="eyebrow">Reading streak</p>
							<div className="mt-2 flex items-baseline gap-2.5">
								<span className="font-semibold leading-none" style={{ fontFamily: "var(--font-cormorant)", fontSize: "3rem", color: journal?.streak ? "var(--accent-ink)" : "var(--muted)" }}>{journal?.streak ?? 0}</span>
								<span className="text-sm font-semibold" style={{ color: "var(--muted)" }}>{journal?.streak === 1 ? "day in a row" : "days in a row"}</span>
							</div>
						</div>
						<span role="img" aria-label={journal?.streak ? "Reading streak active" : "No active reading streak yet"}><FlameIcon lit={Boolean(journal?.streak)} size="2.5rem" /></span>
					</div>
					{journal?.heatmap && (
						<>
							<div className="md:hidden">
								<p className="eyebrow mb-2.5">Last 12 weeks</p>
								<HeatmapStrip data={journal.heatmap} weeks={12} timeZone={journal.timezone} />
							</div>
							<div className="hidden md:block">
								<p className="eyebrow mb-2.5">Last 16 weeks</p>
								<HeatmapStrip data={journal.heatmap} weeks={16} timeZone={journal.timezone} />
							</div>
						</>
					)}
				</div>
				<div className="p-5 sm:p-6 border-t md:border-t-0 md:border-l" style={{ borderColor: "var(--rule)" }}>
					<p className="eyebrow">This month</p>
					<div className="mt-3 flex flex-wrap gap-x-7 gap-y-3">
						<Stat value={monthlyStats ? formatMinutes(monthlyStats.totalMinutes) : "—"} label="read" />
						<Stat value={monthlyStats?.avgRating ? monthlyStats.avgRating.toFixed(1) : "—"} label="avg rating" />
					</div>
				</div>
				<div className="p-5 sm:p-6 border-t md:border-t-0 md:border-l" style={{ borderColor: "var(--rule)" }}>
					<p className="eyebrow">Your {now.getFullYear()}</p>
					{yearStats && yearStats.totalSessions > 0 ? (
						<>
							<div className="mt-3 flex flex-wrap gap-x-7 gap-y-3">
								<Stat value={`${yearStats.distinctBooks}`} label={yearStats.distinctBooks === 1 ? "book" : "books"} />
								<Stat value={formatMinutes(yearStats.totalMinutes)} label="read" />
								<Stat value={`${yearStats.daysRead}`} label={yearStats.daysRead === 1 ? "day" : "days"} />
							</div>
							{yearStats.topAuthors[0] && <p className="text-xs mt-4" style={{ color: "var(--muted)" }}>Most read: {yearStats.topAuthors[0].name}</p>}
						</>
					) : (
						<p className="text-sm mt-3" style={{ color: "var(--muted)" }}>Nothing logged yet this year.</p>
					)}
				</div>
			</section>

			{(hasTopReads || hasTopRated) && (
				<div className="grid md:grid-cols-2 gap-6">
					{hasTopReads && (
						<TopList title="Top reads this month" entries={monthlyStats.topByTime.map((entry) => ({ book: entry.book, meta: formatMinutes(entry.totalMinutes) }))} />
					)}
					{hasTopRated && (
						<TopList title="Highest rated this month" entries={monthlyStats.topByRating.map((entry) => ({ book: entry.book, meta: <span className="inline-flex items-center gap-1"><StarIcon size={12} />{entry.avgRating.toFixed(1)}</span> }))} />
					)}
				</div>
			)}

			<div className="space-y-5">
				<div className="flex justify-center">
					<button type="button" onClick={() => setShowInsights((v) => !v)} aria-pressed={showInsights} className="chip">
						{showInsights ? "Hide insights" : "Deeper insights"}
					</button>
				</div>

				{showInsights && (
					<div className="brutalist-card p-5 sm:p-6 space-y-4">
						<div className="flex flex-wrap gap-2">
							{(["month", "year", "all"] as const).map((p) => (
								<button key={p} type="button" onClick={() => setInsightsPeriod(p)} aria-pressed={insightsPeriod === p} className="chip">
									{p === "month" ? "This month" : p === "year" ? "This year" : "All time"}
								</button>
							))}
						</div>
						{insightsLoading || !insights ? (
							<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
								{Array.from({ length: 4 }).map((_, i) => (
									<Skeleton key={i} style={{ height: "4.5rem", borderRadius: "10px" }} />
								))}
							</div>
						) : insights.totalSessions === 0 ? (
							<p className="text-sm" style={{ color: "var(--muted)" }}>No sessions logged in this period yet.</p>
						) : (
							<div className="space-y-4">
								<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
									<InsightStat label="Time read" value={formatMinutes(insights.totalMinutes)} />
									<InsightStat label="Days read" value={`${insights.daysRead}`} />
									<InsightStat label="Books" value={`${insights.distinctBooks}`} />
									<InsightStat label="Avg rating" value={insights.avgRating ? insights.avgRating.toFixed(1) : "—"} />
								</div>
								{insights.topAuthors.length > 0 && (
									<div>
										<p className="eyebrow mb-2">Most-read authors</p>
										<div className="flex flex-wrap gap-2">
											{insights.topAuthors.map((a) => (
												<span key={a.name} className="tag">
													{a.name}
													<span style={{ color: "var(--muted)", marginLeft: 6, fontWeight: 500 }}>{formatMinutes(a.totalMinutes)}</span>
												</span>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</div>

			<div>
				{!sessions || sessions.length === 0 ? (
					<div className="brutalist-card p-6 text-center sm:p-8" style={{ color: "var(--muted)" }}>
						<p className="text-sm">No sessions logged yet.</p>
						<p className="text-sm mt-1">
							Start reading and log a session from the{" "}
							<Link href="/" style={{ color: "var(--accent-ink)", fontWeight: 700 }}>home page</Link>.
						</p>
					</div>
				) : (
					<div className="space-y-10">
						{months.map((month, monthIndex) => {
							// The journal loads 50 sessions at a time, so a month on a page edge may be cut short.
							const partial = (monthIndex === months.length - 1 && journal?.hasMoreRecent) || (monthIndex === 0 && historyOffset > 0);
							const total = month.sessions.reduce((sum, session) => sum + session.minutes, 0);
							return (
								<section key={month.key} aria-labelledby={`month-${month.key}`}>
									<div className="flex items-baseline justify-between gap-3 pb-2.5" style={{ borderBottom: "2px solid var(--fg)" }}>
										<h2 id={`month-${month.key}`} className="text-2xl font-semibold" style={{ fontFamily: "var(--font-cormorant)" }}>{monthLabel(month.key)}</h2>
										{!partial && <p className="text-xs" style={{ color: "var(--muted)" }}>{month.sessions.length} {month.sessions.length === 1 ? "sitting" : "sittings"} · {formatMinutes(total)}</p>}
									</div>
									<ol className="journal-timeline pt-3">
										{month.sessions.map((session, i) => {
											const date = dateOnlyParts(session.sessionDate);
											const isRevealed = revealedSessionIds.has(session.id);
											const compact = !session.note;
											const bookHref = `/books/${encodeURIComponent(session.book.openLibraryId)}`;
											return (
												<li key={session.id} className="card-enter py-1.5" style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}>
													<div className={`text-right pr-3 sm:pr-4 ${compact ? "pt-2.5" : "pt-4"}`}>
														<p className="font-semibold leading-none" style={{ fontFamily: "var(--font-cormorant)", fontSize: compact ? "1.5rem" : "1.9rem" }}>{date.day}</p>
														<p className="eyebrow mt-1" style={{ fontSize: "0.65rem" }}>{date.weekday}</p>
													</div>
													<article className={`card-flat ${getPastelTint(session.book.title)} ml-3 sm:ml-4 ${compact ? "flex items-center gap-3 sm:gap-4 px-3 py-2" : "grid grid-cols-[2.875rem_minmax(0,1fr)] sm:grid-cols-[2.875rem_minmax(0,1fr)_auto] items-start gap-x-3 sm:gap-x-4 p-4"}`}>
														<Link href={bookHref} aria-label={`View ${session.book.title}`} className="cover shrink-0" style={{ width: compact ? 28 : 46 }}>
															<CoverPlaceholder title={session.book.title} size="sm" />
															{session.book.coverUrl && <Image src={session.book.coverUrl} alt="" fill sizes="46px" className="object-cover" />}
														</Link>
														<div className={`flex-1 min-w-0 ${compact ? "sm:flex sm:items-baseline sm:gap-3" : ""}`}>
															<div className={compact ? "min-w-0 sm:flex sm:items-baseline sm:gap-2" : ""}>
																<Link href={bookHref} className="font-semibold leading-tight hover:underline" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.15rem" }}>{session.book.title}</Link>
																<p className={`text-xs truncate ${compact ? "sm:mt-0" : "mt-0.5"}`} style={{ color: "var(--muted)" }}>{session.book.authors.join(", ")}</p>
															</div>
															<div className={`flex items-center gap-2 text-xs whitespace-nowrap ${compact ? "mt-0.5 sm:mt-0 sm:ml-auto" : "mt-1"}`} style={{ color: "var(--muted)" }}>
																<span className="inline-flex items-center gap-1"><StarIcon size={12} />{session.rating}</span>
																<span aria-hidden="true">·</span>
																<span>{formatMinutes(session.minutes)}</span>
															</div>
															{session.note && (session.hasSpoiler ? (
																<button type="button" className="reader-note mt-2 text-left" style={{ filter: isRevealed ? "none" : "blur(4px)" }} aria-expanded={isRevealed} onClick={() => setRevealedSessionIds((previous) => {
																	const next = new Set(previous);
																	if (next.has(session.id)) next.delete(session.id); else next.add(session.id);
																	return next;
																})}>{isRevealed ? session.note : '[Spoiler — tap to reveal]'}</button>
															) : <p className="reader-note mt-2">{session.note}</p>)}
														</div>
														{/* With a note, the actions sit under the text on phones so the note keeps its width. */}
														<div className={`flex items-center shrink-0 ${compact ? "" : "col-start-2 -ml-2 mt-1 sm:col-start-auto sm:ml-0 sm:-mt-2 sm:-mr-2"}`}>
															<button type="button" onClick={() => setEditingSession(session)} className="btn-quiet min-h-11 px-2 text-xs">Edit</button>
															<button type="button" onClick={() => handleDeleteSession(session)} disabled={deleteSession.isPending} aria-label={`Delete session for ${session.book.title}`} title="Delete session" className="flex min-h-11 min-w-11 items-center justify-center" style={{ color: "var(--muted)" }}>
																<CloseIcon size={16} />
															</button>
														</div>
													</article>
												</li>
											);
										})}
									</ol>
								</section>
							);
						})}
					</div>
				)}
				{(historyOffset > 0 || (sessions && sessions.length > 0 && journal?.hasMoreRecent)) && (
					<div className="mt-8 flex items-center justify-between gap-3">
						<button type="button" className="btn-secondary" disabled={historyOffset === 0 || journalFetching} onClick={() => setHistoryOffset((current) => Math.max(0, current - 50))}>{journalFetching ? 'Loading…' : 'Newer sessions'}</button>
						{journal?.hasMoreRecent && <button type="button" className="btn-secondary" disabled={journalFetching} onClick={() => setHistoryOffset((current) => current + 50)}>{journalFetching ? 'Loading…' : 'Older sessions'}</button>}
					</div>
				)}
				{editingSession && createPortal(
					<CheckInModal
						book={editingSession.book}
						sessionDate={editingSession.sessionDate}
						onClose={() => setEditingSession(null)}
						onSuccess={() => {
							invalidateSessionQueries();
							setEditingSession(null);
						}}
					/>,
					document.body,
				)}
			</div>
		</div>
	);
}

function groupByMonth<T extends { sessionDate: string }>(sessions: T[]) {
	const months: { key: string; sessions: T[] }[] = [];
	for (const session of sessions) {
		const key = session.sessionDate.slice(0, 7);
		const last = months[months.length - 1];
		if (last && last.key === key) last.sessions.push(session);
		else months.push({ key, sessions: [session] });
	}
	return months;
}

function Stat({ value, label }: { value: string; label: string }) {
	return (
		<div>
			<p className="font-semibold leading-none" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.9rem" }}>{value}</p>
			<p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{label}</p>
		</div>
	);
}

type TopBook = { id: string; openLibraryId: string; title: string; coverUrl: string | null };

function TopList({ title, entries }: { title: string; entries: { book: TopBook; meta: React.ReactNode }[] }) {
	return (
		<div>
			<h2 className="text-xl font-semibold mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>{title}</h2>
			<ol className="space-y-2">
				{entries.map(({ book, meta }, i) => (
					<li key={book.id} className={`card-flat ${getPastelTint(book.title)} flex items-center gap-3 px-3 py-2`}>
						<span className="w-4 text-right font-semibold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.15rem", color: "var(--muted)" }}>{i + 1}</span>
						<span className="cover shrink-0" style={{ width: 24, borderWidth: 1.5 }}>
							<CoverPlaceholder title={book.title} size="sm" />
							{book.coverUrl && <Image src={book.coverUrl} alt="" fill sizes="24px" className="object-cover" />}
						</span>
						<Link href={`/books/${encodeURIComponent(book.openLibraryId)}`} className="flex-1 font-semibold text-sm hover:underline truncate">{book.title}</Link>
						<span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>{meta}</span>
					</li>
				))}
			</ol>
		</div>
	);
}

function InsightStat({ label, value }: { label: string; value: string }) {
	return (
		<div
			className="card-flat p-3 flex flex-col justify-center"
		>
			<p
				className="eyebrow mb-1"
			>
				{label}
			</p>
			<p
				className="text-xl font-semibold"
				style={{ fontFamily: "var(--font-cormorant)" }}
			>
				{value}
			</p>
		</div>
	);
}
