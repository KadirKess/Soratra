"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { trpc } from "@/lib/trpc/client";
import { BookCard } from "@/components/books/BookCard";
import { LibraryReadingCard } from "@/components/books/LibraryReadingCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { QueryErrorCard } from "@/components/ui/QueryErrorCard";

const FILTERS = [
	{ value: undefined, label: "All", bg: "var(--fg)", color: "var(--bg)" },
	{
		value: "reading",
		label: "Reading",
		bg: "var(--sage)",
		color: "var(--fg)",
	},
	{ value: "read", label: "Read", bg: "var(--blush)", color: "var(--fg)" },
	{
		value: "want_to_read",
		label: "Want to read",
		bg: "var(--straw)",
		color: "var(--fg)",
	},
] as const;

type StatusFilter = "reading" | "read" | "want_to_read" | undefined;

function LibrarySkeleton() {
	return (
		<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
			{Array.from({ length: 14 }).map((_, i) => (
				<Skeleton key={i} style={{ aspectRatio: "2/3" }} />
			))}
		</div>
	);
}

export default function LibraryPage() {
	return (
		<Suspense fallback={<LibrarySkeleton />}>
			<LibraryPageInner />
		</Suspense>
	);
}

type SortOption = "date_added" | "date_released";

function LibraryPageInner() {
	const params = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const statusParam = params.get("status");
	const filter: StatusFilter = FILTERS.some(({ value }) => value === statusParam)
		? statusParam as StatusFilter
		: undefined;
	const sort: SortOption = params.get("sort") === "date_released" ? "date_released" : "date_added";
	const authorFilter = params.get("author") ?? undefined;
	const genreFilter = params.get("genre") ?? undefined;
	const page = Math.max(0, Number.parseInt(params.get("page") ?? "0", 10) || 0);
	const pageSize = 60;

	function updateFilters(next: Record<string, string | undefined>) {
		const nextParams = new URLSearchParams(params.toString());
		if (!("page" in next)) nextParams.delete("page");
		for (const [key, value] of Object.entries(next)) {
			if (value) nextParams.set(key, value);
			else nextParams.delete(key);
		}
		const query = nextParams.toString();
		router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
	}
	const { data: library, isLoading, isError, refetch, isRefetching } = trpc.userBooks.library.useQuery({
		status: filter,
		sort,
		author: authorFilter,
		genre: genreFilter,
		offset: page * pageSize,
		limit: pageSize,
	}, {
		staleTime: 5 * 60 * 1000,
	});
	const books = library?.books ?? [];
	const data = books;
	const authors = library?.authors ?? [];
	const genres = library?.genres ?? [];
	const todayLogged = library?.todayLogged ?? [];
	const todayDate = library?.todayDate;

	return (
		<div className="space-y-6">
			<div className="flex items-baseline justify-between">
				<h1
					className="text-4xl font-bold"
					style={{ fontFamily: "var(--font-cormorant)" }}
				>
					Library
				</h1>
				<span
					className="text-sm font-medium"
					style={{ color: "var(--muted)" }}
				>
					{books.length} books
				</span>
			</div>

			{/* Status filters */}
			<div className="flex gap-2 flex-wrap" aria-label="Library shelf">
				{FILTERS.map(({ value, label, bg, color }) => {
					const active = filter === value;
					return (
						<button
							key={label}
							type="button"
							onClick={() => updateFilters({ status: value, author: undefined, genre: undefined })}
							aria-pressed={active}
							className="px-3 py-1.5 text-xs font-bold transition-all"
							style={{
								background: active ? bg : "transparent",
								color: active ? color : "var(--muted)",
								border: `2px solid ${active ? "var(--fg)" : "var(--muted)"}`,
								borderRadius: "8px",
								boxShadow: active
									? "2px 2px 0 var(--fg)"
									: "none",
							}}
						>
							{label}
						</button>
					);
				})}
			</div>

			{/* Sort */}
			<div className="flex gap-2 flex-wrap items-center" aria-label="Library sort order">
				<span
					className="text-xs font-bold uppercase tracking-wider"
					style={{ color: "var(--muted)" }}
				>
					Sort
				</span>
				{(["date_added", "date_released"] as SortOption[]).map((s) => (
					<button
						key={s}
						type="button"
						onClick={() => updateFilters({ sort: s === "date_added" ? undefined : s })}
						aria-pressed={sort === s}
						className="px-3 py-1.5 text-xs font-bold transition-all"
						style={{
							background:
								sort === s ? "var(--fg)" : "transparent",
							color: sort === s ? "var(--bg)" : "var(--muted)",
							border: `2px solid ${sort === s ? "var(--fg)" : "var(--muted)"}`,
							borderRadius: "8px",
							boxShadow:
								sort === s ? "2px 2px 0 var(--accent)" : "none",
						}}
					>
						{s === "date_added" ? "Date added" : "Date released"}
					</button>
				))}
			</div>

			{/* Author + genre filters */}
			{(authors && authors.length > 0) || (genres && genres.length > 0) ? (
				<div className="flex gap-3 flex-wrap items-center">
					{authors && authors.length > 0 && (
						<>
						<label className="sr-only" htmlFor="library-author">Filter by author</label>
						<select
							id="library-author"
							value={authorFilter ?? ""}
							onChange={(e) =>
								updateFilters({ author: e.target.value || undefined })
							}
							className="px-3 py-1.5 text-base font-bold md:text-xs"
							style={{
								background: authorFilter
									? "var(--sage)"
									: "transparent",
								color: authorFilter ? "var(--fg)" : "var(--muted)",
								border: `2px solid ${authorFilter ? "var(--fg)" : "var(--muted)"}`,
								borderRadius: "8px",
							}}
						>
							<option value="">All authors</option>
							{authors.map((a) => (
								<option key={a} value={a}>
									{a}
								</option>
							))}
						</select>
						</>
					)}
					{genres && genres.length > 0 && (
						<>
						<label className="sr-only" htmlFor="library-genre">Filter by genre</label>
						<select
							id="library-genre"
							value={genreFilter ?? ""}
							onChange={(e) =>
								updateFilters({ genre: e.target.value || undefined })
							}
							className="px-3 py-1.5 text-base font-bold md:text-xs"
							style={{
								background: genreFilter
									? "var(--blush)"
									: "transparent",
								color: genreFilter ? "var(--fg)" : "var(--muted)",
								border: `2px solid ${genreFilter ? "var(--fg)" : "var(--muted)"}`,
								borderRadius: "8px",
							}}
						>
							<option value="">All genres</option>
							{genres.map((g) => (
								<option key={g} value={g}>
									{g}
								</option>
							))}
						</select>
						</>
					)}
					{(authorFilter || genreFilter) && (
						<button
							type="button"
							onClick={() => updateFilters({ author: undefined, genre: undefined })}
							className="px-2.5 py-1 text-xs font-bold underline"
							style={{ color: "var(--accent-ink)" }}
						>
							Clear filters
						</button>
					)}
				</div>
			) : null}

			{isLoading && <LibrarySkeleton />}
			{isError && <QueryErrorCard message="Your library could not load." onRetry={() => refetch()} retrying={isRefetching} />}

			{!isLoading && !isError && data.length === 0 && (filter || authorFilter || genreFilter ? (
				<EmptyStateCard
					title="No matches yet"
					description="Try clearing a filter or picking a different shelf to surface more books."
				/>
			) : (
				<EmptyStateCard
					title="Your shelves are ready"
					description="Save books you want to read, are reading, or have already finished."
					ctaHref="/search"
					ctaLabel="Find a book"
					tone="sky"
				/>
			))}

			{!isError &&
				data.length > 0 &&
				(() => {
					const knownDate =
						sort === "date_released"
							? data.filter((d) => d.book.publishedDate)
							: data;
					const unknownDate =
						sort === "date_released"
							? data.filter((d) => !d.book.publishedDate)
							: [];
					const sorted = knownDate;

					return (
						<>
							<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
								{sorted.map(({ book }) => filter === "reading" ? (
									<LibraryReadingCard key={book.id} book={book} loggedToday={todayLogged.includes(book.id)} todayDate={todayDate} />
								) : (
									<BookCard key={book.id} openLibraryId={book.openLibraryId} title={book.title} authors={book.authors} coverUrl={book.coverUrl} compact />
								))}
							</div>
							{unknownDate.length > 0 && (
								<div>
									<div className="flex items-center gap-3 my-4">
										<span
											className="text-xs font-bold uppercase tracking-wider"
											style={{ color: "var(--muted)" }}
										>
											Unknown release date
										</span>
										<div
											className="flex-1"
											style={{
												borderTop:
													"1px solid var(--border)",
												opacity: 0.2,
											}}
										/>
									</div>
									<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
										{unknownDate.map(({ book }) => filter === "reading" ? (
											<LibraryReadingCard key={book.id} book={book} loggedToday={todayLogged.includes(book.id)} todayDate={todayDate} />
										) : (
											<BookCard key={book.id} openLibraryId={book.openLibraryId} title={book.title} authors={book.authors} coverUrl={book.coverUrl} compact />
										))}
									</div>
								</div>
							)}
						</>
					);
				})()}

			{!isLoading && !isError && library && library.total > pageSize && (
				<div className="flex items-center justify-between gap-3">
					<button
						type="button"
						disabled={page === 0}
						onClick={() => updateFilters({ page: page > 1 ? String(page - 1) : undefined })}
						className="px-3 py-2 text-sm font-bold disabled:opacity-40"
						style={{ border: "2px solid var(--fg)", borderRadius: "8px" }}
					>
						Previous
					</button>
					<span className="text-sm" style={{ color: "var(--muted)" }}>
						{page * pageSize + 1}–{Math.min((page + 1) * pageSize, library.total)} of {library.total}
					</span>
					<button
						type="button"
						disabled={!library.hasMore}
						onClick={() => updateFilters({ page: String(page + 1) })}
						className="px-3 py-2 text-sm font-bold disabled:opacity-40"
						style={{ border: "2px solid var(--fg)", borderRadius: "8px" }}
					>
						Next
					</button>
				</div>
			)}
		</div>
	);
}
