"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFriendSummary } from "@/components/social/useFriendSummary";
import { useUpdateAvailable } from "@/components/admin/useUpdateAvailable";
import { UpdateDot } from "@/components/admin/UpdateDot";
import { sectionFor } from "@/lib/sections";
import { FriendsIcon, HomeIcon, JournalIcon, LibraryIcon, ProfileIcon } from "@/components/ui/Icon";

const TABS = [
	{ href: "/", label: "Home", icon: <HomeIcon size={20} /> },
	{ href: "/library", label: "Library", icon: <LibraryIcon size={20} /> },
	{ href: "/journal", label: "Journal", icon: <JournalIcon size={20} /> },
	{ href: "/friends", label: "Friends", icon: <FriendsIcon size={20} /> },
	{ href: "/profile", label: "Profile", icon: <ProfileIcon size={20} /> },
];

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
	const path = usePathname();
	const pendingRequests = useFriendSummary();
	// On phones the admin reaches Your Soratra through Profile, so the dot goes there.
	const updateAvailable = useUpdateAvailable(isAdmin);

	return (
		<nav
			className="md:hidden fixed z-20 flex overflow-hidden"
			style={{
				background: "var(--surface)",
				border: "2px solid var(--fg)",
				borderRadius: "var(--radius-card)",
				boxShadow: "var(--shadow-raised)",
				bottom: "max(0.75rem, env(safe-area-inset-bottom))",
				left: "max(0.75rem, env(safe-area-inset-left))",
				right: "max(0.75rem, env(safe-area-inset-right))",
			}}
		>
			{TABS.map(({ href, label, icon }, index) => {
				const active = path === href;
				const hasRequests = href === "/friends" && pendingRequests > 0;
				const hasUpdate = href === "/profile" && updateAvailable;
				return (
					<Link
						key={href}
						href={href}
						className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-semibold transition-colors"
						aria-label={hasRequests ? `Friends, ${pendingRequests} ${pendingRequests === 1 ? "request" : "requests"}` : hasUpdate ? `${label}, update available` : label}
						aria-current={active ? "page" : undefined}
						data-section={sectionFor(href) ?? undefined}
						style={{
							color: active ? "var(--fg)" : "var(--muted)",
							background: active ? "var(--section)" : "transparent",
							borderRight:
								index < TABS.length - 1
									? "1px solid var(--border)"
									: "none",
						}}
					>
						<span className="relative">{icon}{hasRequests && <span aria-hidden="true" className="absolute -right-3 -top-2 min-w-4 h-4 px-0.5 flex items-center justify-center rounded-full text-[0.6rem]" style={{ background: "var(--accent)", color: "var(--bg)" }}>{pendingRequests}</span>}{hasUpdate && <UpdateDot className="absolute -right-1.5 -top-0.5" />}</span>
						{label}
					</Link>
				);
			})}
		</nav>
	);
}
