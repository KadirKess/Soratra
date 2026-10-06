"use client";
import { trpc } from "@/lib/trpc/client";
import { CheckInCard } from "@/components/books/CheckInCard";
import { HeatmapStrip } from "@/components/ui/HeatmapStrip";
import { BookCard } from "@/components/books/BookCard";
import { ShelfPickCard } from "@/components/books/ShelfPickCard";
import { FriendFeed } from "@/components/social/FriendFeed";
import { Skeleton } from "@/components/ui/Skeleton";
import { QueryErrorCard } from "@/components/ui/QueryErrorCard";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import { useState } from "react";

const STAT_STYLES = [
	{ label: "Read", bg: "var(--straw)", emoji: "✦", status: "read" },
	{ label: "Reading", bg: "var(--sage)", emoji: "◉", status: "reading" },
	{
		label: "Want to read",
		bg: "var(--sky)",
		emoji: "○",
		status: "want_to_read",
	},
] as const;

function HomeSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid lg:grid-cols-12 gap-6">
				<Skeleton className="lg:col-span-7" style={{ height: "29rem", borderRadius: "12px" }} />
				<Skeleton className="lg:col-span-5" style={{ height: "29rem", borderRadius: "12px" }} />
			</div>
			<div className="grid lg:grid-cols-12 gap-6">
				<Skeleton className="lg:col-span-7" style={{ height: "24rem", borderRadius: "12px" }} />
				<Skeleton className="lg:col-span-5" style={{ height: "24rem", borderRadius: "12px" }} />
			</div>
		</div>
	);
}

export default function HomePage() {
	const { data: dashboard, isLoading: dashboardLoading, isError: dashboardError, refetch: refetchDashboard, isRefetching: dashboardRefetching } =
		trpc.users.dashboard.useQuery();
	const confirm = useConfirm();
	const utils = trpc.useUtils();

	const [freezeNotice, setFreezeNotice] = useState<string | null>(null);
	const [shelfPickNonce, setShelfPickNonce] = useState(0);
	const [excludedShelfBookId, setExcludedShelfBookId] = useState<string>();
	const { data: alternateShelfPick, isFetching: shelfPickLoading, isError: alternateShelfPickError } = trpc.users.shelfPick.useQuery(
		{ nonce: shelfPickNonce, excludedBookId: excludedShelfBookId },
		{ enabled: shelfPickNonce > 0 },
	);
	const applyFreeze = trpc.readingSessions.applyWeeklyFreeze.useMutation({
		onSuccess: (result) => {
			setFreezeNotice(result.applied ? "Your weekly freeze protected yesterday." : result.reason);
			if (result.applied) {
				utils.users.dashboard.invalidate();
			}
		},
	});

	async function useWeeklyFreeze() {
		const accepted = await confirm({
			title: "Use this week's streak freeze?",
			message: "This protects yesterday if you had an active reading streak. You get one free freeze each Monday to Sunday week.",
			confirmLabel: "Use freeze",
		});
		if (accepted) applyFreeze.mutate();
	}

	if (dashboardLoading) return <HomeSkeleton />;
	if (dashboardError) return <QueryErrorCard message="Your reading space could not load." onRetry={() => refetchDashboard()} retrying={dashboardRefetching} />;

	const currentlyReading = dashboard?.currentlyReading ?? [];
	const hasBookBeingRead = currentlyReading.length > 0;
	const streak = dashboard?.streak ?? 0;
	const shelfPick = alternateShelfPick ?? (shelfPickNonce === 0 || alternateShelfPickError ? dashboard?.shelfPick ?? null : null);
	const sortedCurrentlyReading = [...currentlyReading].sort(
		(a, b) => Number(dashboard?.todayLogged.includes(a.book.id)) - Number(dashboard?.todayLogged.includes(b.book.id)),
	);
	const currentBook = sortedCurrentlyReading[0];
	const otherCurrentBooks = sortedCurrentlyReading.slice(1, 3);

	function pickAnotherBook() {
		if (!shelfPick) return;
		setExcludedShelfBookId(shelfPick.book.id);
		setShelfPickNonce((nonce) => nonce + 1);
	}

	return (
		<div className="space-y-6">
			<div className="grid lg:grid-cols-12 gap-6 items-stretch card-enter card-enter-1">
				<section aria-labelledby="today-title" className="brutalist-card p-5 sm:p-6 lg:p-7 space-y-5 lg:col-span-7 lg:min-h-[29rem]" style={{ background: "var(--sage)" }}>
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>The book on your desk</p>
							<h1 id="today-title" className="font-bold leading-none mt-1" style={{ fontFamily: "var(--font-cormorant)", fontSize: "3.25rem" }}>Today</h1>
						</div>
						{hasBookBeingRead && (
							<Link href="/library?status=reading" className="text-xs font-semibold text-right leading-relaxed hover:underline" style={{ color: "var(--accent-ink)" }}>
								{dashboard?.totalReading ?? 0} {dashboard?.totalReading === 1 ? "book" : "books"} in progress<br />View shelf →
							</Link>
						)}
					</div>
					{hasBookBeingRead && currentBook ? (
						<div className="space-y-4">
							<CheckInCard book={currentBook.book} userBookId={currentBook.id} loggedToday={dashboard?.todayLogged.includes(currentBook.book.id) ?? false} todayDate={dashboard?.todayDate} variant="desk" />
							{otherCurrentBooks.length > 0 && <div className="grid sm:grid-cols-2 gap-3">{otherCurrentBooks.map(({ book, id }) => <CheckInCard key={book.id} book={book} userBookId={id} loggedToday={dashboard?.todayLogged.includes(book.id) ?? false} todayDate={dashboard?.todayDate} variant="compact" />)}</div>}
						</div>
					) : (
						<div className="py-12 max-w-md"><p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Your next chapter</p><h2 className="font-bold leading-tight mt-2" style={{ fontFamily: "var(--font-cormorant)", fontSize: "2.5rem" }}>Find a book to put on your desk.</h2><Link href="/search" className="btn-primary inline-flex mt-5">Browse books</Link></div>
					)}
				</section>

				<section aria-labelledby="reading-rhythm-title" className="brutalist-card p-5 sm:p-6 lg:p-7 flex flex-col gap-5 lg:col-span-5 lg:min-h-[29rem]" style={{ background: "var(--straw)" }}>
					<div className="flex items-start justify-between gap-4">
						<div>
							<p id="reading-rhythm-title" className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Keeping the flame</p>
							<div className="flex items-end gap-3 mt-2"><p className="font-bold leading-none" style={{ fontFamily: "var(--font-dm-sans)", fontVariantNumeric: "tabular-nums", fontSize: "3.5rem", color: "var(--accent)" }}>{streak}</p><p className="text-sm font-semibold mb-1" style={{ color: "var(--muted)" }}>{streak === 1 ? "day of reading" : "days of reading"}</p></div>
						</div>
						<span role="img" aria-label={streak > 0 ? "Reading streak active" : "No active reading streak yet"} style={{ fontSize: "3.5rem", lineHeight: 1, filter: streak > 0 ? "none" : "grayscale(1) opacity(0.3)" }}>🔥</span>
					</div>
					<div className="flex-1 flex flex-col justify-center pt-4" style={{ borderTop: "1px solid var(--border)" }}><p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted)" }}>Your last 4 weeks</p><HeatmapStrip data={dashboard?.heatmap ?? {}} weeks={4} timeZone={dashboard?.timezone ?? "UTC"} /></div>
					{freezeNotice && <p className="text-xs" style={{ color: "var(--fg)", opacity: 0.7 }}>{freezeNotice}</p>}
					{dashboard?.freezeEligible && <button type="button" onClick={useWeeklyFreeze} disabled={applyFreeze.isPending} className="btn-secondary w-full justify-center">{applyFreeze.isPending ? "Applying..." : "Keep yesterday in your history"}</button>}
				</section>
			</div>

			<div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-12 gap-6 items-start">
				<div className="lg:col-span-7"><FriendFeed /></div>
				<section aria-labelledby="shelf-title" className="brutalist-card p-5 sm:p-6 space-y-5 lg:col-span-5" style={{ background: "var(--sky)" }}>
					<div><p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Waiting on your shelf</p><h2 id="shelf-title" className="font-bold mt-1" style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem" }}>{shelfPick ? "A book saved for later" : "Find your next page"}</h2></div>
					{shelfPick ? <ShelfPickCard key={shelfPick.book.id} book={shelfPick.book} onPickAnother={pickAnotherBook} pickingAnother={shelfPickLoading} canPickAnother={(dashboard?.totalWantToRead ?? 0) > 1} /> : shelfPickLoading ? <div className="brutalist-card min-h-48 animate-pulse" style={{ background: "rgba(255,255,255,0.28)" }} aria-label="Choosing another book" /> : <div className="space-y-4"><p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>Bring home a book you are curious about. It will be waiting here when the moment is right.</p><Link href="/search" className="btn-primary inline-flex">Browse books</Link></div>}
					<div className="grid grid-cols-3 gap-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>{STAT_STYLES.map(({ label, status }, index) => { const value = index === 0 ? dashboard?.totalRead : index === 1 ? dashboard?.totalReading : dashboard?.totalWantToRead; return <Link key={label} href={`/library?status=${status}`} className="text-center hover:underline"><p className="font-bold leading-none" style={{ fontFamily: "var(--font-dm-sans)", fontVariantNumeric: "tabular-nums", fontSize: "1.35rem" }}>{value ?? 0}</p><p className="text-[0.65rem] font-semibold uppercase tracking-wider mt-1" style={{ color: "var(--muted)" }}>{label}</p></Link>; })}</div>
				</section>
			</div>

			{dashboard?.recentlyRead && dashboard.recentlyRead.length > 0 && (
				<section aria-labelledby="recently-read-title" className="space-y-4">
					<div className="flex items-center gap-3">
						<h2 id="recently-read-title" className="font-bold shrink-0" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.75rem" }}>Recently read</h2>
						<div className="flex-1" style={{ borderTop: "1px solid var(--border)", opacity: 0.2 }} />
					</div>
					<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3 xl:max-w-4xl">
						{dashboard.recentlyRead.map(({ book }) => <BookCard key={book.id} openLibraryId={book.openLibraryId} title={book.title} authors={book.authors} coverUrl={book.coverUrl} compact />)}
					</div>
				</section>
			)}
		</div>
	);
}
