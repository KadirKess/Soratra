import { formatPosition, progressFraction } from "@/lib/pages";

interface Props {
	page: number;
	total: number | null;
	size?: "desk" | "card";
	className?: string;
}

// Where a reader is in a book: a thin ink rule and "Page 150 of 320". Without a
// total there is nothing to measure against, so it is text only.
export function ProgressRule({ page, total, size = "card", className = "" }: Props) {
	const fraction = progressFraction(page, total);
	const label = formatPosition(page, total);
	return (
		<div className={`space-y-1.5 ${className}`}>
			{fraction != null && total != null && (
				<div
					className={`progress-rule progress-rule--${size}`}
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={total}
					aria-valuenow={Math.min(page, total)}
					aria-valuetext={label}
					aria-label="Reading progress"
				>
					<span style={{ width: `${fraction * 100}%` }} />
				</div>
			)}
			<p className={size === "desk" ? "text-sm" : "text-xs"} style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }} aria-hidden={fraction != null}>
				{label}
				{fraction != null && size === "desk" && <> · {Math.round(fraction * 100)}%</>}
			</p>
		</div>
	);
}
