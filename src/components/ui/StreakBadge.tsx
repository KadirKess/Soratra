interface Props {
	streak: number;
}

export function StreakBadge({ streak }: Props) {
	return (
		<div className="flex items-end justify-between">
			<div>
				<p
					className="text-xs font-bold uppercase tracking-widest mb-1"
					style={{ color: "var(--muted)" }}
				>
					Reading streak
				</p>
				<p
					className="leading-none font-bold"
					style={{
						fontFamily: "var(--font-cormorant)",
						fontSize: "4rem",
						color: streak > 0 ? "var(--accent)" : "var(--muted)",
						lineHeight: 1,
					}}
				>
					{streak}
				</p>
				<p
					className="text-sm font-semibold mt-1"
					style={{ color: "var(--muted)" }}
				>
					{streak === 1 ? "day in a row" : "days in a row"}
				</p>
			</div>
			<span
				style={{
					fontSize: "3rem",
					lineHeight: 1,
					filter: streak > 0 ? "none" : "grayscale(1) opacity(0.3)",
				}}
				role="img"
				aria-label="streak"
			>
				🔥
			</span>
		</div>
	);
}
