"use client";
import { formatMinutes } from "@/lib/formatMinutes";

const SLIDER_MIN = 5;
const SLIDER_MAX = 180;
const SLIDER_STEP = 5;
const MAX_MINUTES = 1440;

interface Props {
	value: number;
	onChange: (v: number) => void;
	id?: string;
}

// A single-value time picker: drag the bar for a quick pick (5-min steps up to
// 3h), or type an exact figure in the number box (up to a full day). value of 0
// means "not set yet" — the parent gates submit on a positive value.
export function MinutesPicker({ value, onChange, id }: Props) {
	function setFromInput(raw: string) {
		if (raw === "") {
			onChange(0);
			return;
		}
		const n = Math.round(Number(raw));
		if (Number.isNaN(n)) return;
		onChange(Math.min(Math.max(n, 0), MAX_MINUTES));
	}

	const sliderValue = Math.min(Math.max(value, SLIDER_MIN), SLIDER_MAX);

	return (
		<div className="space-y-3">
			<input
				id={id}
				type="range"
				min={SLIDER_MIN}
				max={SLIDER_MAX}
				step={SLIDER_STEP}
				value={sliderValue}
				onChange={(e) => onChange(Number(e.target.value))}
				className="w-full accent-[var(--accent)]"
				style={{ cursor: "pointer" }}
				aria-label="Minutes read"
			/>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
					<input
						type="number"
						min={1}
						max={MAX_MINUTES}
						value={value || ""}
						onChange={(e) => setFromInput(e.target.value)}
						placeholder="0"
						className="brutalist-input w-20 text-center"
						aria-label="Exact minutes read"
					/>
					<span className="shrink-0 text-sm whitespace-nowrap" style={{ color: "var(--muted)" }}>
						min
					</span>
				</div>
				<p
					className="text-sm font-semibold"
					style={{ color: "var(--accent)" }}
				>
					{value > 0 ? formatMinutes(value) : "—"}
				</p>
			</div>
		</div>
	);
}
