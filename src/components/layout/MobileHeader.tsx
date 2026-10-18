"use client";

import Link from "next/link";
import { SearchIcon } from "@/components/ui/Icon";
import { Wordmark } from "./Wordmark";

export function MobileHeader() {
	return (
		<header
			className="md:hidden h-14 flex items-center justify-between px-4 sticky top-0 z-10"
			style={{
				background: "var(--bg)",
				borderBottom: "2px solid var(--border)",
			}}
		>
			<Link href="/" aria-label="Soratra home">
				<Wordmark size="1.5rem" />
			</Link>
			<Link
				href="/search"
				aria-label="Search books"
				className="flex min-h-11 min-w-11 items-center justify-center rounded-lg"
				style={{ border: "2px solid var(--fg)", color: "var(--fg)" }}
			>
				<SearchIcon size={17} />
			</Link>
		</header>
	);
}
