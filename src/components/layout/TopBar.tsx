"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";

function TopBarInner() {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const urlQuery = params.get("q") ?? "";
	const [query, setQuery] = useState(
		pathname === "/search" ? urlQuery : "",
	);
	const lastReplacedQuery = useRef(urlQuery);

	useEffect(() => {
		if (pathname !== "/search") {
			lastReplacedQuery.current = "";
			setQuery("");
			return;
		}

		if (urlQuery !== lastReplacedQuery.current) {
			lastReplacedQuery.current = urlQuery;
			setQuery(urlQuery);
		}
	}, [pathname, urlQuery]);

	useEffect(() => {
		if (pathname !== "/search") return;
		const nextQuery = query.trim();
		if (nextQuery === urlQuery) return;

		const t = setTimeout(() => {
			lastReplacedQuery.current = nextQuery;
			router.replace(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search", { scroll: false });
		}, 400);
		return () => clearTimeout(t);
	}, [query, pathname, router, urlQuery]);

	function handleSearch(e: React.FormEvent) {
		e.preventDefault();
		if (pathname === "/search") {
			const nextQuery = query.trim();
			lastReplacedQuery.current = nextQuery;
			router.replace(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search", { scroll: false });
		} else {
			if (!query.trim()) return;
			router.push(`/search?q=${encodeURIComponent(query.trim())}`);
		}
	}

	return (
		<header
			className="h-14 flex items-center px-6 sticky top-0 z-10"
			style={{
				background: "var(--bg)",
				borderBottom: "2px solid var(--border)",
			}}
		>
			<form onSubmit={handleSearch} className="flex-1 max-w-md">
				<label htmlFor="book-search" className="sr-only">Search books</label>
				<input
					id="book-search"
					type="search"
					inputMode="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search books..."
					className="brutalist-input"
					style={{ padding: "0.375rem 1rem" }}
					autoComplete="off"
				/>
			</form>
		</header>
	);
}

export function TopBar() {
	return (
		<Suspense>
			<TopBarInner />
		</Suspense>
	);
}
