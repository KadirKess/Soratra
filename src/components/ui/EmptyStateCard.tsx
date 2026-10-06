import type { ReactNode } from "react";
import Link from "next/link";

const TONE_BACKGROUNDS = {
	blush: "var(--blush)",
	sage: "var(--sage)",
	sky: "var(--sky)",
	straw: "var(--straw)",
	surface: "var(--surface)",
} as const;

interface EmptyStateCardProps {
	title: string;
	description: ReactNode;
	ctaHref?: string;
	ctaLabel?: string;
	tone?: keyof typeof TONE_BACKGROUNDS;
}

export function EmptyStateCard({
	title,
	description,
	ctaHref,
	ctaLabel,
	tone = "surface",
}: EmptyStateCardProps) {
	return (
		<div
			className="brutalist-card p-6 sm:p-7 text-center"
			style={{ background: TONE_BACKGROUNDS[tone] }}
		>
			<div className="max-w-sm mx-auto space-y-3">
				<div className="space-y-1.5">
					<h2
						className="text-2xl font-bold"
						style={{ fontFamily: "var(--font-cormorant)" }}
					>
						{title}
					</h2>
					<p className="text-sm" style={{ color: "var(--muted)" }}>
						{description}
					</p>
				</div>
				{ctaHref && ctaLabel ? (
					<div className="pt-1">
						<Link href={ctaHref} className="btn-secondary">
							{ctaLabel}
						</Link>
					</div>
				) : null}
			</div>
		</div>
	);
}
