"use client";

import Link from "next/link";

export function MobileHeader() {
	return (
		<header
			className="md:hidden h-14 flex items-center justify-between px-4 sticky top-0 z-10"
			style={{
				background: "var(--bg)",
				borderBottom: "2px solid var(--border)",
			}}
		>
			<Link
				href="/"
				style={{
					fontFamily: "var(--font-cormorant)",
					fontSize: "1.5rem",
					fontWeight: 700,
					color: "var(--fg)",
					letterSpacing: "-0.02em",
				}}
			>
				Soratra
			</Link>
			<Link
				href="/search"
				aria-label="Search books"
				className="flex min-h-11 min-w-11 items-center justify-center rounded-lg"
				style={{ border: "2px solid var(--fg)", color: "var(--fg)" }}
			>
				<svg
					width="17"
					height="17"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<circle cx="11" cy="11" r="7" />
					<path d="m20 20-4-4" />
				</svg>
			</Link>
		</header>
	);
}
