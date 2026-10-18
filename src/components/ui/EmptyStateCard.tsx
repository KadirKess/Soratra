import type { ReactNode } from "react";
import Link from "next/link";

const TONE_CLASSES = {
	blush: "tint-blush",
	sage: "tint-sage",
	sky: "tint-sky",
	straw: "tint-straw",
	surface: "",
} as const;

interface EmptyStateCardProps {
	title: string;
	description: ReactNode;
	ctaHref?: string;
	ctaLabel?: string;
	tone?: keyof typeof TONE_CLASSES;
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
			className={`brutalist-card ${TONE_CLASSES[tone]} p-6 sm:p-7 text-center`}
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
