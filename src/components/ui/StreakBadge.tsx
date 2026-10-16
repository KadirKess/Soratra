import { FlameIcon } from "./Icon";

interface Props {
	streak: number;
}

export function StreakBadge({ streak }: Props) {
	return (
		<div className="flex items-end justify-between">
			<div>
				<p
					className="eyebrow mb-1"
				>
					Reading streak
				</p>
				<p
					className="leading-none font-bold"
					style={{
						fontFamily: "var(--font-cormorant)",
						fontSize: "4rem",
						color: streak > 0 ? "var(--accent-ink)" : "var(--muted)",
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
			<span role="img" aria-label={streak > 0 ? "Reading streak active" : "No active reading streak yet"}>
				<FlameIcon lit={streak > 0} size="2.75rem" />
			</span>
		</div>
	);
}
