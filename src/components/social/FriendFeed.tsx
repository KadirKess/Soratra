"use client";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";
import { formatMinutes } from "@/lib/formatMinutes";
import { formatDateOnly } from "@/lib/dates";
import { StarRating } from "@/components/books/StarRating";
import { Skeleton } from "@/components/ui/Skeleton";
import { SpoilerReveal } from "@/components/ui/SpoilerReveal";

export function FriendFeed() {
	const { data: activity, isLoading, isError, refetch, isRefetching } = trpc.readingSessions.friendFeed.useQuery({ limit: 6 });

	return (
		<section aria-labelledby="friends-reading-title" className="brutalist-card p-5 sm:p-6 space-y-4" style={{ background: "var(--surface)" }}>
			<div className="flex items-center gap-3">
				<h2
					id="friends-reading-title"
					className="font-bold shrink-0"
					style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.75rem" }}
				>
					In the margins
				</h2>
			</div>
			{isLoading ? (
				<div className="space-y-3" aria-label="Loading recent activity">
					<Skeleton style={{ height: "4.5rem", borderRadius: "8px" }} />
					<Skeleton style={{ height: "4.5rem", borderRadius: "8px" }} />
				</div>
			) : isError ? (
				<div className="space-y-3">
					<p className="text-sm" style={{ color: "var(--muted)" }}>We couldn’t bring in your friends’ latest activity.</p>
					<button type="button" onClick={() => refetch()} disabled={isRefetching} className="btn-secondary">{isRefetching ? "Trying again…" : "Try again"}</button>
				</div>
			) : activity?.length ? (
					<div className="divide-y max-h-[24rem] overflow-y-auto pr-2" aria-label="Recent activity from your friends" style={{ borderColor: "var(--border)" }}>
						{activity.map((entry) => (
							<article key={`${entry.kind}-${entry.activityId}`} className="py-3 first:pt-0 space-y-1.5">
								<div className="flex items-baseline gap-2 flex-wrap text-sm">
							<Link
								href={`/profile/${entry.user.username}`}
								className="font-bold hover:underline"
							>
								@{entry.user.username}
							</Link>
							<span
								className="text-xs font-bold uppercase tracking-wider"
								style={{ color: "var(--muted)" }}
							>
								{entry.kind === "session"
									? `logged ${formatMinutes(entry.minutes)}`
									: "finished reading"}
							</span>
						</div>
						<Link
							href={`/books/${encodeURIComponent(entry.book.openLibraryId)}`}
							className="block w-fit font-bold leading-tight hover:underline"
							style={{
								fontFamily: "var(--font-cormorant)",
								fontSize: "1.35rem",
							}}
						>
							{entry.book.title}
						</Link>
						{entry.kind === "session" && entry.note && (entry.hasSpoiler ? (
							<SpoilerReveal label="this reading note">{entry.note}</SpoilerReveal>
						) : (
							<p className="text-sm leading-relaxed whitespace-pre-wrap p-3" style={{ color: "var(--fg)", background: "rgba(255,255,255,0.35)", borderLeft: "3px solid var(--accent)" }}>{entry.note}</p>
						))}
						{entry.kind === "finished" && entry.review && (entry.reviewHasSpoiler ? (
							<SpoilerReveal label="this review">{entry.review}</SpoilerReveal>
						) : (
							<p className="text-sm leading-relaxed whitespace-pre-wrap p-3 line-clamp-3" style={{ color: "var(--fg)", background: "rgba(255,255,255,0.35)", borderLeft: "3px solid var(--accent)" }}>{entry.review}</p>
						))}
								<div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
							{entry.rating && <><StarRating value={Number(entry.rating)} onChange={() => undefined} readOnly className="text-base sm:text-base" /><span aria-hidden="true">·</span></>}
							<span>{formatDateOnly(entry.activityDate)}</span>
						</div>
							</article>
						))}
					</div>
			) : (
				<div className="space-y-3">
					<p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>Nothing new from your circle yet. Reading is yours for now.</p>
				</div>
			)}
		</section>
	);
}
