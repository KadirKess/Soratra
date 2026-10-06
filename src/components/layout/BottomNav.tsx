"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFriendSummary } from "@/components/social/useFriendSummary";

const TABS = [
	{
		href: "/",
		label: "Home",
		activeColor: "var(--sage)",
		icon: (
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
				<polyline points="9 22 9 12 15 12 15 22" />
			</svg>
		),
	},
	{
		href: "/library",
		label: "Library",
		activeColor: "var(--sky)",
		icon: (
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
				<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
			</svg>
		),
	},
	{
		href: "/journal",
		label: "Journal",
		activeColor: "var(--blush)",
		icon: (
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
				<polyline points="14 2 14 8 20 8" />
				<line x1="16" y1="13" x2="8" y2="13" />
				<line x1="16" y1="17" x2="8" y2="17" />
				<polyline points="10 9 9 9 8 9" />
			</svg>
		),
	},
	{
		href: "/friends",
		label: "Friends",
		activeColor: "var(--sage)",
		icon: (
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
				<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
				<circle cx="9" cy="7" r="4" />
				<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
				<path d="M16 3.13a4 4 0 0 1 0 7.75" />
			</svg>
		),
	},
	{
		href: "/profile",
		label: "Profile",
		activeColor: "var(--straw)",
		icon: (
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
		),
	},
];

export function BottomNav() {
	const path = usePathname();
	const pendingRequests = useFriendSummary();

	return (
		<nav
			className="md:hidden fixed z-20 flex overflow-hidden"
			style={{
				background: "var(--surface)",
				border: "2px solid var(--fg)",
				borderRadius: "0.75rem",
				boxShadow: "4px 4px 0 var(--fg)",
				bottom: "max(0.75rem, env(safe-area-inset-bottom))",
				left: "max(0.75rem, env(safe-area-inset-left))",
				right: "max(0.75rem, env(safe-area-inset-right))",
			}}
		>
			{TABS.map(({ href, label, activeColor, icon }, index) => {
				const active = path === href;
				const hasRequests = href === "/friends" && pendingRequests > 0;
				return (
					<Link
						key={href}
						href={href}
						className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-semibold transition-colors"
						aria-label={hasRequests ? `Friends, ${pendingRequests} ${pendingRequests === 1 ? "request" : "requests"}` : label}
						aria-current={active ? "page" : undefined}
						style={{
							color: active ? "var(--fg)" : "var(--muted)",
							background: active ? activeColor : "transparent",
							borderRight:
								index < TABS.length - 1
									? "1px solid var(--border)"
									: "none",
						}}
					>
						<span className="relative">{icon}{hasRequests && <span aria-hidden="true" className="absolute -right-3 -top-2 min-w-4 h-4 px-0.5 flex items-center justify-center rounded-full text-[0.6rem]" style={{ background: "var(--accent)", color: "var(--bg)" }}>{pendingRequests}</span>}</span>
						{label}
					</Link>
				);
			})}
		</nav>
	);
}
