"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFriendSummary } from "@/components/social/useFriendSummary";

const STATUS_COLORS: Record<string, string> = {
	"/": "var(--sage)",
	"/library": "var(--sky)",
	"/journal": "var(--blush)",
	"/friends": "var(--sage)",
	"/profile": "var(--straw)",
};

const links = [
	{ href: "/", label: "Home" },
	{ href: "/library", label: "Library" },
	{ href: "/journal", label: "Journal" },
	{ href: "/friends", label: "Friends" },
	{ href: "/profile", label: "Profile" },
];

export function Sidebar({ operatorName, contact }: { operatorName: string; contact: string | null }) {
	const path = usePathname();
	const pendingRequests = useFriendSummary();

	return (
		<aside
			className="hidden md:flex fixed left-0 top-0 h-screen flex-col pt-8 px-5"
			style={{
				width: "14rem",
				background: "var(--surface)",
				borderRight: "2px solid var(--border)",
			}}
		>
			<div className="mb-10 px-2 space-y-2">
				<span
					style={{
						fontFamily: "var(--font-cormorant)",
						fontSize: "1.75rem",
						fontWeight: 700,
						color: "var(--fg)",
						letterSpacing: "-0.02em",
					}}
				>
					Soratra
				</span>
				<p
					className="text-xs leading-5 max-w-[11rem]"
					style={{ color: "var(--muted)" }}
				>
					A calm place to keep your reading life close.
				</p>
			</div>
			<nav className="flex flex-col gap-2">
				{links.map(({ href, label }) => {
					const active = path === href;
					const hasRequests = href === "/friends" && pendingRequests > 0;
					const accessibleLabel = hasRequests
						? `Friends, ${pendingRequests} ${pendingRequests === 1 ? "request" : "requests"}`
						: label;
					return (
						<Link
							key={href}
							href={href}
							className={`sidebar-nav-link flex items-center px-4 py-2.5 text-sm font-semibold${active ? " sidebar-nav-active" : ""}`}
						aria-label={accessibleLabel}
						aria-current={active ? 'page' : undefined}
							style={{
								borderRadius: "10px",
								border: active
									? "2px solid var(--fg)"
									: "2px solid transparent",
								background: active
									? STATUS_COLORS[href]
									: "transparent",
								boxShadow: active
									? "var(--shadow-small)"
									: "none",
								color: active ? "var(--fg)" : "var(--muted)",
								fontWeight: active ? 700 : 500,
							}}
						>
							<span>{label}</span>
							{hasRequests && <span aria-hidden="true" className="ml-auto min-w-5 h-5 px-1 flex items-center justify-center rounded-full text-[0.7rem]" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>{pendingRequests}</span>}
						</Link>
					);
				})}
			</nav>
			<div className="mt-auto mb-6 mx-2 space-y-4">
				<div className="px-3 pt-3 space-y-2" style={{ borderTop: "1px solid var(--rule)" }}>
					<p className="eyebrow">
						Instance support
					</p>
					<p className="text-xs leading-5" style={{ color: "var(--muted)" }}>
						Forgot a password or found a bug? Ask
						<span className="block w-fit max-w-full truncate font-semibold" style={{ color: "var(--fg)" }}>
							{contact ?? operatorName}
						</span>
					</p>
				</div>

			</div>
		</aside>
	);
}
