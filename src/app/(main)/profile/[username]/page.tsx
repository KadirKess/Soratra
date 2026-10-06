"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { HeatmapStrip } from "@/components/ui/HeatmapStrip";
import { StreakBadge } from "@/components/ui/StreakBadge";
import { BookCard } from "@/components/books/BookCard";
import { StarRating } from "@/components/books/StarRating";
import { Skeleton } from "@/components/ui/Skeleton";
import { SpoilerReveal } from "@/components/ui/SpoilerReveal";
import { dateOnlyParts, formatDateOnly } from "@/lib/dates";
import { formatMinutes } from "@/lib/formatMinutes";

interface Props {
	params: Promise<{ username: string }>;
}

const JOURNAL_PASTELS = ["var(--sage)", "var(--blush)", "var(--sky)", "var(--straw)"];
const PROFILE_PAGE_SIZE = 6;

function Pagination({
	offset,
	hasMore,
	onNewer,
	onOlder,
	label,
}: {
	offset: number;
	hasMore: boolean;
	onNewer: () => void;
	onOlder: () => void;
	label: string;
}) {
	if (offset === 0 && !hasMore) return null;
	return (
		<div className="mt-4 flex items-center justify-between gap-3">
			<button type="button" onClick={onNewer} disabled={offset === 0} className="btn-secondary">Newer {label}</button>
			{hasMore && <button type="button" onClick={onOlder} className="btn-secondary">Older {label}</button>}
		</div>
	);
}

export default function UserProfilePage({ params }: Props) {
	const { username } = use(params);
	const [logOffset, setLogOffset] = useState(0);
	const [finishedOffset, setFinishedOffset] = useState(0);
	const [wantToReadOffset, setWantToReadOffset] = useState(0);
	const { data: profile, isLoading, error } = trpc.users.friendProfile.useQuery({ username, logOffset, finishedOffset, wantToReadOffset });

	if (isLoading && !profile) {
		return <div className="space-y-6 max-w-6xl"><Skeleton style={{ height: "3rem", width: "14rem" }} /><Skeleton style={{ height: "17rem" }} /><Skeleton style={{ height: "24rem" }} /></div>;
	}

	if (error?.data?.code === "FORBIDDEN") {
		return <div className="max-w-lg brutalist-card p-6 space-y-3" style={{ background: "var(--sky)" }}><h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-cormorant)" }}>Private profile</h1><p className="text-sm leading-6" style={{ color: "var(--muted)" }}>This reading profile is shared with accepted friends only.</p><Link href="/friends" className="btn-secondary w-fit">Back to Friends</Link></div>;
	}

	if (!profile) return notFound();

	const { user, totalRead, totalReading, totalWantToRead, currentlyReading, streak, heatmap, heatmapEndDate, logs, finished, wantToRead } = profile;

	return (
		<div className="space-y-8 max-w-6xl">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Reading journal</p>
					<h1 className="text-5xl font-bold leading-none mt-2" style={{ fontFamily: "var(--font-cormorant)" }}>@{user.username}</h1>
				</div>
				<p className="text-sm font-semibold" style={{ color: "var(--muted)" }}>{totalRead} read <span aria-hidden="true">·</span> {totalReading} reading <span aria-hidden="true">·</span> {totalWantToRead} want to read</p>
			</header>

			<section className="brutalist-card p-5 sm:p-6" style={{ background: "var(--surface)" }} aria-label="Reading streak and yearly activity">
				<div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
					<StreakBadge streak={streak} />
					<div className="w-full lg:max-w-4xl">
						<p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted)" }}>This year</p>
						<div className="md:hidden"><HeatmapStrip data={heatmap} weeks={12} endDate={heatmapEndDate} /></div>
						<div className="hidden md:block"><HeatmapStrip data={heatmap} weeks={52} endDate={heatmapEndDate} /></div>
					</div>
				</div>
			</section>

			<div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(18rem,5fr)]">
				<section className="brutalist-card p-5 sm:p-6 flex flex-col min-h-0" style={{ background: "var(--surface)" }} aria-labelledby="reading-log-title">
					<div className="flex items-center gap-3 mb-4 shrink-0"><h2 id="reading-log-title" className="text-3xl font-bold shrink-0" style={{ fontFamily: "var(--font-cormorant)" }}>In the margins</h2><div className="flex-1" style={{ borderTop: "1px solid var(--border)" }} /></div>
					{logs.entries.length === 0 ? <EmptyState message="No reading sessions shared yet." /> : <div className="space-y-3 max-h-[24rem] overflow-y-auto pr-2 pb-2 lg:max-h-none lg:flex-1 lg:min-h-0" aria-label="Reading log">
						{logs.entries.map((entry, index) => {
							const date = dateOnlyParts(entry.sessionDate);
							return <article key={entry.id} className="brutalist-card p-4 grid grid-cols-[3.25rem_minmax(0,1fr)] gap-4" style={{ background: JOURNAL_PASTELS[index % JOURNAL_PASTELS.length] }}>
								<div className="text-center"><p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{date.month}</p><p className="text-3xl leading-none font-bold" style={{ fontFamily: "var(--font-cormorant)" }}>{date.day}</p></div>
								<div className="min-w-0"><Link href={`/books/${encodeURIComponent(entry.book.openLibraryId)}`} className="font-bold hover:underline" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.35rem" }}>{entry.book.title}</Link><p className="text-xs truncate" style={{ color: "var(--muted)" }}>{entry.book.authors.join(", ")}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--muted)" }}><StarRating value={Number(entry.rating)} onChange={() => undefined} readOnly className="text-base" /><span aria-hidden="true">·</span><span>{formatMinutes(entry.minutes)}</span></div>{entry.note && (entry.hasSpoiler ? <SpoilerReveal label="this reading note">{entry.note}</SpoilerReveal> : <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{entry.note}</p>)}</div>
							</article>;
						})}
					</div>}
					<Pagination offset={logOffset} hasMore={logs.hasMore} onNewer={() => setLogOffset((value) => Math.max(0, value - PROFILE_PAGE_SIZE))} onOlder={() => setLogOffset((value) => value + PROFILE_PAGE_SIZE)} label="entries" />
				</section>

				<div className="space-y-8">
					<section className="brutalist-card p-5 sm:p-6" style={{ background: "var(--blush)" }} aria-labelledby="finished-title">
						<div className="flex items-center gap-3 mb-4"><h2 id="finished-title" className="text-3xl font-bold shrink-0" style={{ fontFamily: "var(--font-cormorant)" }}>Finished</h2><div className="flex-1" style={{ borderTop: "1px solid var(--border)" }} /></div>
						{finished.entries.length === 0 ? <EmptyState message="No finished books shared yet." /> : <div className="space-y-3 max-h-[24rem] overflow-y-auto pr-2 pb-2" aria-label="Finished books and reviews">
							{finished.entries.map((entry) => <article key={entry.id} className="brutalist-card p-4 space-y-2" style={{ background: "var(--bg)" }}><Link href={`/books/${encodeURIComponent(entry.book.openLibraryId)}`} className="font-bold leading-tight hover:underline" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.35rem" }}>{entry.book.title}</Link><p className="text-xs" style={{ color: "var(--muted)" }}>{entry.book.authors.join(", ")}{entry.finishedDate ? ` · ${formatDateOnly(entry.finishedDate)}` : ""}</p>{entry.rating && <StarRating value={Number(entry.rating)} onChange={() => undefined} readOnly className="text-base" />}{entry.review && (entry.reviewHasSpoiler ? <SpoilerReveal label="this review">{entry.review}</SpoilerReveal> : <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.review}</p>)}</article>)}
						</div>}
						<Pagination offset={finishedOffset} hasMore={finished.hasMore} onNewer={() => setFinishedOffset((value) => Math.max(0, value - PROFILE_PAGE_SIZE))} onOlder={() => setFinishedOffset((value) => value + PROFILE_PAGE_SIZE)} label="books" />
					</section>

					<section className="brutalist-card p-5 sm:p-6" style={{ background: "var(--sky)" }} aria-labelledby="want-to-read-title">
						<div className="flex items-center gap-3 mb-4"><h2 id="want-to-read-title" className="text-3xl font-bold shrink-0" style={{ fontFamily: "var(--font-cormorant)" }}>Want to read</h2><div className="flex-1" style={{ borderTop: "1px solid var(--border)" }} /></div>
						{wantToRead.entries.length === 0 ? <EmptyState message="Nothing waiting on this shelf yet." /> : <div className="grid grid-cols-3 gap-3 max-h-[24rem] overflow-y-auto pr-2 pb-2" aria-label="Want to read shelf">{wantToRead.entries.map(({ id, book }) => <BookCard key={id} openLibraryId={book.openLibraryId} title={book.title} authors={book.authors} coverUrl={book.coverUrl} compact />)}</div>}
						<Pagination offset={wantToReadOffset} hasMore={wantToRead.hasMore} onNewer={() => setWantToReadOffset((value) => Math.max(0, value - PROFILE_PAGE_SIZE))} onOlder={() => setWantToReadOffset((value) => value + PROFILE_PAGE_SIZE)} label="books" />
					</section>
				</div>
			</div>

			{currentlyReading.length > 0 && <section className="brutalist-card p-5 sm:p-6" style={{ background: "var(--sage)" }} aria-labelledby="currently-reading-title"><div className="flex items-center gap-3 mb-4"><h2 id="currently-reading-title" className="text-3xl font-bold shrink-0" style={{ fontFamily: "var(--font-cormorant)" }}>On their desk</h2><div className="flex-1" style={{ borderTop: "1px solid var(--border)" }} /></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl">{currentlyReading.map(({ book }) => <BookCard key={book.id} openLibraryId={book.openLibraryId} title={book.title} authors={book.authors} coverUrl={book.coverUrl} compact />)}</div></section>}
		</div>
	);
}

function EmptyState({ message }: { message: string }) {
	return <div className="brutalist-card p-5 text-sm" style={{ background: "var(--bg)", color: "var(--muted)" }}>{message}</div>;
}
