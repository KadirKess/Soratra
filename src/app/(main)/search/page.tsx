"use client";
import { trpc } from "@/lib/trpc/client";
import { BookCard } from "@/components/books/BookCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function SkeletonGrid() {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
			{Array.from({ length: 10 }).map((_, i) => (
				<div key={i}>
					<Skeleton style={{ aspectRatio: "2/3" }} />
					<Skeleton className="mt-2 h-4 w-3/4" />
					<Skeleton className="mt-1 h-3 w-1/2" />
				</div>
			))}
		</div>
	);
}

function SearchResults({ query }: { query: string }) {
	const { data, isLoading, isError, refetch, isRefetching } = trpc.books.search.useQuery(
		{ query },
		{ enabled: query.length >= 2 },
	);

	if (isLoading) return <SkeletonGrid />;

	if (isError) {
		return (
			<div className="brutalist-card p-4 flex flex-wrap items-center justify-between gap-3" style={{ background: "var(--blush)" }}>
				<p className="text-sm font-medium" style={{ color: "var(--fg)" }}>
					Search failed. Your query is still here when you are ready to retry.
				</p>
				<button type="button" onClick={() => refetch()} disabled={isRefetching} className="btn-secondary">
					{isRefetching ? "Retrying…" : "Retry"}
				</button>
			</div>
		);
	}

	const works = data?.works ?? [];

	if (!works.length) {
		return (
			<div className="brutalist-card p-4 flex flex-wrap items-center justify-between gap-3" style={{ background: "var(--blush)" }}>
				<p className="text-sm font-medium" style={{ color: "var(--fg)" }}>
					{data?.unavailable
						? "The catalog is temporarily unavailable. Please try again shortly."
						: `No results for “${query}”`}
				</p>
				{data?.unavailable && (
					<button type="button" onClick={() => refetch()} disabled={isRefetching} className="btn-secondary">
						{isRefetching ? "Retrying…" : "Retry"}
					</button>
				)}
			</div>
		);
	}

	return (
		<>
			{data?.unavailable && (
				<div className="brutalist-card p-4" style={{ background: "var(--blush)" }}>
					<p className="text-sm font-medium" style={{ color: "var(--fg)" }}>
						The live catalog is temporarily unavailable. Showing matching books already in Soratra.
					</p>
				</div>
			)}
			<div className="flex items-center justify-between gap-3" aria-live="polite">
				<p className="text-sm" style={{ color: "var(--muted-strong)" }}>{works.length} {works.length === 1 ? "result" : "results"} for “{query}”</p>
			</div>
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
				{works.map((book) => (
					<BookCard key={book.openLibraryId} {...book} />
				))}
			</div>
		</>
	);
}

function SearchPage() {
	const params = useSearchParams();
	const router = useRouter();
	const urlQuery = params.get("q") ?? "";
	const [mobileQuery, setMobileQuery] = useState(urlQuery);

	useEffect(() => {
		setMobileQuery(urlQuery);
	}, [urlQuery]);

	function submitMobileSearch(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const query = mobileQuery.trim();
		router.replace(query ? `/search?q=${encodeURIComponent(query)}` : "/search", { scroll: false });
	}

	return (
		<div className="space-y-6">
			<h1
				className="text-4xl font-bold"
				style={{ fontFamily: "var(--font-cormorant)" }}
			>
				Search
			</h1>
			<form onSubmit={submitMobileSearch} className="md:hidden">
				<label htmlFor="mobile-book-search" className="sr-only">Search books</label>
				<div className="flex gap-3">
					<input
						id="mobile-book-search"
						type="search"
						value={mobileQuery}
						onChange={(event) => setMobileQuery(event.target.value)}
						placeholder="Title, author, or ISBN"
						className="brutalist-input"
						autoComplete="off"
					/>
					<button type="submit" className="btn-primary shrink-0 px-4">
						Search
					</button>
				</div>
			</form>
			{urlQuery.length >= 2 && <SearchResults query={urlQuery} />}
			{urlQuery.length > 0 && urlQuery.length < 2 && (
				<p className="text-sm" style={{ color: "var(--muted)" }}>Enter at least two characters to search.</p>
			)}
			{!urlQuery && (
				<p className="text-sm" style={{ color: "var(--muted)" }}>
					Search the catalog by title, author, or ISBN.
				</p>
			)}
		</div>
	);
}

export default function Page() {
	return (
		<Suspense>
			<SearchPage />
		</Suspense>
	);
}
