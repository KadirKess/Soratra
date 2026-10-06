"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc/client";
import { CheckInModal } from "@/components/books/CheckInModal";
import { HeatmapStrip } from "@/components/ui/HeatmapStrip";
import { StreakBadge } from "@/components/ui/StreakBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { QueryErrorCard } from "@/components/ui/QueryErrorCard";
import { formatMinutes } from "@/lib/formatMinutes";
import { dateOnlyParts } from "@/lib/dates";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";
import Link from "next/link";

const PASTELS = ["var(--sage)", "var(--blush)", "var(--sky)", "var(--straw)"];

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

	return (
		<div className="space-y-8">
			<h1
				className="text-4xl font-bold"
				style={{ fontFamily: "var(--font-cormorant)" }}
			>
				Journal
			</h1>

			{/* Row 1: Streak + heatmap | Time read | Avg rating */}
			<div className="grid md:grid-cols-[2fr_1fr_1fr] gap-4 items-stretch">
				<div className="brutalist-card p-4 space-y-5 sm:p-6">
					<StreakBadge streak={journal?.streak ?? 0} />
					{journal?.heatmap && (
						<>
							<div className="md:hidden">
								<p
									className="text-xs font-semibold uppercase tracking-wider mb-3"
									style={{ color: "var(--muted)" }}
								>
									Last 12 weeks
								</p>
								<HeatmapStrip data={journal.heatmap} weeks={12} timeZone={journal.timezone} />
							</div>
							<div className="hidden md:block">
								<p
									className="text-xs font-semibold uppercase tracking-wider mb-3"
									style={{ color: "var(--muted)" }}
								>
									This year
								</p>
								<HeatmapStrip data={journal.heatmap} weeks={52} timeZone={journal.timezone} />
							</div>
						</>
					)}
				</div>

				<div
					className="brutalist-card p-4 flex flex-col justify-center"
					style={{ background: "var(--straw)" }}
				>
					<p
						className="text-xs font-bold uppercase tracking-wider mb-1"
						style={{ color: "var(--muted)" }}
					>
						Time read this month
					</p>
					<p
						className="text-2xl font-bold"
						style={{ fontFamily: "var(--font-cormorant)" }}
					>
						{monthlyStats
							? formatMinutes(monthlyStats.totalMinutes)
							: "—"}
					</p>
				</div>

				<div
					className="brutalist-card p-4 flex flex-col justify-center"
					style={{ background: "var(--blush)" }}
				>
					<p
						className="text-xs font-bold uppercase tracking-wider mb-1"
						style={{ color: "var(--muted)" }}
					>
						Avg rating this month
					</p>
					<p
						className="text-2xl font-bold"
						style={{ fontFamily: "var(--font-cormorant)" }}
					>
						{monthlyStats?.avgRating
							? monthlyStats.avgRating.toFixed(1)
							: "—"}
					</p>
				</div>
			</div>

			{/* This Year — macro reading arc */}
			{yearStats && yearStats.totalSessions > 0 && (
				<div
					className="brutalist-card p-4 sm:p-6"
					style={{ background: "var(--accent)", color: "var(--on-accent)" }}
				>
					<div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
						<h2
							className="text-2xl font-bold"
							style={{ fontFamily: "var(--font-cormorant)" }}
						>
							Your {now.getFullYear()}
						</h2>
						{yearStats.topAuthors[0] && (
							<p className="text-sm" style={{ opacity: 0.9 }}>
								Most-read: {yearStats.topAuthors[0].name}
							</p>
						)}
					</div>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<YearStat
							label="Books"
							value={`${yearStats.distinctBooks}`}
						/>
						<YearStat
							label="Time read"
							value={formatMinutes(yearStats.totalMinutes)}
						/>
						<YearStat
							label="Days read"
							value={`${yearStats.daysRead}`}
						/>
						<YearStat
							label="Sessions"
							value={`${yearStats.totalSessions}`}
						/>
					</div>
				</div>
			)}

			{/* Row 2: Top reads | Top rated — two columns */}
			{(hasTopReads || hasTopRated) && (
				<div className="grid md:grid-cols-2 gap-6">
					{hasTopReads && (
						<div>
							<h3
								className="text-xl font-bold mb-3"
								style={{ fontFamily: "var(--font-cormorant)" }}
							>
								Top reads this month
							</h3>
							<div className="space-y-2">
								{monthlyStats.topByTime.map((entry, i) => (
									<div
										key={entry.book.id}
										className="brutalist-card p-3 flex items-center gap-3"
										style={{ background: PASTELS[i % 4] }}
									>
										<span
											className="font-bold text-sm"
											style={{
												color: "var(--muted)",
												minWidth: 20,
											}}
										>
											#{i + 1}
										</span>
										<Link
											href={`/books/${encodeURIComponent(entry.book.openLibraryId)}`}
											className="flex-1 font-semibold text-sm hover:underline truncate"
										>
											{entry.book.title}
										</Link>
										<span
											className="text-xs shrink-0"
											style={{ color: "var(--muted)" }}
										>
											{formatMinutes(entry.totalMinutes)}
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{hasTopRated && (
						<div>
							<h3
								className="text-xl font-bold mb-3"
								style={{ fontFamily: "var(--font-cormorant)" }}
							>
								Highest rated this month
							</h3>
							<div className="space-y-2">
								{monthlyStats.topByRating.map((entry, i) => (
									<div
										key={entry.book.id}
										className="brutalist-card p-3 flex items-center gap-3"
										style={{
											background: PASTELS[(i + 2) % 4],
										}}
									>
										<span
											className="font-bold text-sm"
											style={{
												color: "var(--muted)",
												minWidth: 20,
											}}
										>
											#{i + 1}
										</span>
										<Link
											href={`/books/${encodeURIComponent(entry.book.openLibraryId)}`}
											className="flex-1 font-semibold text-sm hover:underline truncate"
										>
											{entry.book.title}
										</Link>
										<span
											className="text-xs shrink-0"
											style={{ color: "var(--muted)" }}
										>
											{entry.avgRating.toFixed(1)} ★
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Deeper Insights toggle */}
			<div className="flex justify-center">
				<button
					type="button"
					onClick={() => setShowInsights((v) => !v)}
					className="px-4 py-2 text-sm font-bold transition-all"
					style={{
						background: showInsights ? "var(--fg)" : "transparent",
						color: showInsights ? "var(--bg)" : "var(--muted)",
						border: "2px solid var(--fg)",
						borderRadius: "8px",
						boxShadow: showInsights
							? "3px 3px 0 var(--accent)"
							: "none",
					}}
				>
					{showInsights ? "Hide insights" : "Deeper Insights"}
				</button>
			</div>

			{showInsights && (
				<div
					className="brutalist-card p-5 space-y-4"
					style={{ background: "var(--straw)" }}
				>
					<div className="flex gap-2">
						{(["month", "year", "all"] as const).map((p) => (
							<button
								key={p}
								type="button"
								onClick={() => setInsightsPeriod(p)}
								className="px-3 py-1 text-xs font-bold"
								style={{
									background:
										insightsPeriod === p
											? "var(--fg)"
											: "transparent",
									color:
										insightsPeriod === p
											? "var(--bg)"
											: "var(--muted)",
									border: `2px solid ${insightsPeriod === p ? "var(--fg)" : "var(--muted)"}`,
									borderRadius: "8px",
								}}
							>
								{p === "month"
									? "This month"
									: p === "year"
										? "This year"
										: "All time"}
							</button>
						))}
					</div>
					{insightsLoading || !insights ? (
						<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
							{Array.from({ length: 4 }).map((_, i) => (
								<Skeleton
									key={i}
									style={{ height: "4.5rem", borderRadius: "10px" }}
								/>
							))}
						</div>
					) : insights.totalSessions === 0 ? (
						<p className="text-sm" style={{ color: "var(--muted)" }}>
							No sessions logged in this period yet.
						</p>
					) : (
						<div className="space-y-4">
							<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
								<InsightStat
									label="Time read"
									value={formatMinutes(insights.totalMinutes)}
								/>
								<InsightStat
									label="Days read"
									value={`${insights.daysRead}`}
								/>
								<InsightStat
									label="Books"
									value={`${insights.distinctBooks}`}
								/>
								<InsightStat
									label="Avg rating"
									value={
										insights.avgRating
											? insights.avgRating.toFixed(1)
											: "—"
									}
								/>
							</div>
							{insights.topAuthors.length > 0 && (
								<div>
									<p
										className="text-xs font-bold uppercase tracking-wider mb-2"
										style={{ color: "var(--muted)" }}
									>
										Most-read authors
									</p>
									<div className="flex flex-wrap gap-2">
										{insights.topAuthors.map((a) => (
											<span
												key={a.name}
												className="brutalist-card px-3 py-1 text-xs font-semibold"
												style={{ background: "var(--bg)" }}
											>
												{a.name}
												<span
													style={{
														color: "var(--muted)",
														marginLeft: 6,
													}}
												>
													{formatMinutes(a.totalMinutes)}
												</span>
											</span>
										))}
									</div>
								</div>
							)}
						</div>
					)}

				</div>
			)}

			{/* Session history — two columns */}
			<div>
				<h2
					className="text-2xl font-bold mb-4"
					style={{ fontFamily: "var(--font-cormorant)" }}
				>
					Recent reading sessions
				</h2>
				<p className="text-xs -mt-3 mb-4" style={{ color: "var(--muted-strong)" }}>Showing 50 sessions at a time.</p>

				{!sessions || sessions.length === 0 ? (
					<div
						className="brutalist-card p-6 text-center sm:p-8"
						style={{ color: "var(--muted)" }}
					>
						<p className="text-sm">No sessions logged yet.</p>
						<p className="text-sm mt-1">
							Start reading and log a session from the{" "}
							<Link
								href="/"
								style={{
									color: "var(--accent-ink)",
									fontWeight: 700,
								}}
							>
								home page
							</Link>
							.
						</p>
					</div>
				) : (
					<div className="grid md:grid-cols-2 gap-3">
						{sessions.map((session, i) => {
							const date = dateOnlyParts(session.sessionDate);
							const isRevealed = revealedSessionIds.has(session.id);
							return (
							<div
								key={session.id}
								className="brutalist-card p-4 flex gap-4 items-start card-enter"
								style={{
									background: PASTELS[i % 4],
									animationDelay: `${Math.min(i * 40, 300)}ms`,
									position: "relative",
								}}
							>
								<div
									className="shrink-0 text-center"
									style={{ minWidth: 48 }}
								>
									<p
										className="text-xs font-bold uppercase tracking-wider"
										style={{ color: "var(--muted)" }}
									>
										{date.month}
									</p>
									<p
										className="text-2xl font-bold"
										style={{
											fontFamily: "var(--font-cormorant)",
										}}
									>
										{date.day}
									</p>
								</div>

								<div className="flex-1 min-w-0 pr-6">
									<Link
										href={`/books/${encodeURIComponent(session.book.openLibraryId)}`}
										className="font-bold text-sm hover:underline"
										style={{
											fontFamily: "var(--font-cormorant)",
											fontSize: "1rem",
										}}
									>
										{session.book.title}
									</Link>
									<p
										className="text-xs mt-0.5"
										style={{ color: "var(--muted)" }}
									>
										{session.book.authors.join(", ")}
									</p>
									<div
										className="flex items-center gap-3 mt-1 text-xs"
										style={{ color: "var(--muted)" }}
									>
										<span>★ {session.rating}</span>
										<span>·</span>
										<span>{formatMinutes(session.minutes)}</span>
									</div>
									{session.note && (session.hasSpoiler ? (
										<button type="button" className="mt-2 text-sm leading-relaxed" style={{ color: "var(--fg)", filter: isRevealed ? "none" : "blur(4px)" }} aria-expanded={isRevealed} onClick={() => setRevealedSessionIds((previous) => {
											const next = new Set(previous);
											if (next.has(session.id)) next.delete(session.id); else next.add(session.id);
											return next;
										})}>{isRevealed ? session.note : '[Spoiler — tap to reveal]'}</button>
									) : <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--fg)" }}>{session.note}</p>)}
								</div>

								<div className="absolute right-2 top-2 flex items-center gap-1">
									<button
										type="button"
										onClick={() => setEditingSession(session)}
										className="min-h-11 px-2 text-xs font-bold"
									style={{ color: "var(--accent-ink)" }}
									>
										Edit
									</button>

									<button
										type="button"
										onClick={() => handleDeleteSession(session)}
										disabled={deleteSession.isPending}
										aria-label={`Delete session for ${session.book.title}`}
										title="Delete session"
										className="flex min-h-11 min-w-11 items-center justify-center text-lg"
										style={{ color: "var(--muted)", opacity: 0.65 }}
									>
										×
									</button>
								</div>
							</div>
							);
						})}
					</div>
				)}
				{(historyOffset > 0 || (sessions && sessions.length > 0 && journal?.hasMoreRecent)) && (
					<div className="mt-6 flex items-center justify-between gap-3">
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

function YearStat({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p
				className="text-3xl font-bold"
				style={{ fontFamily: "var(--font-cormorant)" }}
			>
				{value}
			</p>
			<p
				className="text-xs font-bold uppercase tracking-wider"
				style={{ opacity: 0.85 }}
			>
				{label}
			</p>
		</div>
	);
}

function InsightStat({ label, value }: { label: string; value: string }) {
	return (
		<div
			className="brutalist-card p-3 flex flex-col justify-center"
			style={{ background: "var(--bg)" }}
		>
			<p
				className="text-xs font-bold uppercase tracking-wider mb-1"
				style={{ color: "var(--muted)" }}
			>
				{label}
			</p>
			<p
				className="text-xl font-bold"
				style={{ fontFamily: "var(--font-cormorant)" }}
			>
				{value}
			</p>
		</div>
	);
}
