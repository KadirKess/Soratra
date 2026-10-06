import { Fragment, type CSSProperties } from 'react'
import { addDaysToDate, localDateInTimeZone, weekStartForDate } from '@/lib/dates'

interface Props {
	data: Record<string, number>; // date string (YYYY-MM-DD, local) -> minutes
	weeks?: number; // default 52 for full year, 4 for home strip
	timeZone?: string;
	endDate?: string;
}

function getIntensity(minutes: number): 0 | 1 | 2 | 3 {
	if (minutes === 0) return 0;
	if (minutes < 30) return 1;
	if (minutes < 60) return 2;
	return 3;
}

function fill(intensity: 0 | 1 | 2 | 3): string {
	switch (intensity) {
		case 0:
			return "color-mix(in srgb, var(--fg) 12%, transparent)";
		case 1:
			return "color-mix(in srgb, var(--sage) 55%, var(--surface))";
		case 2:
			return "var(--sage)";
		case 3:
			return "color-mix(in srgb, var(--sage) 78%, var(--fg))";
	}
}

function weekLabel(date: string) {
	const [year, month, day] = date.split("-").map(Number);
	return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
		.format(new Date(Date.UTC(year!, month! - 1, day!)));
}

const weekdays = ["M", "T", "W", "T", "F", "S", "S"];

export function HeatmapStrip({ data, weeks = 52, timeZone, endDate }: Props) {
	const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
	const today = endDate ?? localDateInTimeZone(new Date(), zone);
	const days = Array.from({ length: weeks * 7 }, (_, index) => addDaysToDate(today, index - (weeks * 7 - 1)));
	const activitySummary = (keys: string[]) => {
		const activeDays = keys.filter((key) => (data[key] ?? 0) > 0);
		const totalMinutes = activeDays.reduce((total, key) => total + (data[key] ?? 0), 0);
		return activeDays.length === 0
			? `No reading sessions in the last ${weeks} weeks.`
			: `${activeDays.length} active reading days and ${totalMinutes} minutes in the last ${weeks} weeks.`;
	};

	if (weeks <= 4) {
		const start = addDaysToDate(weekStartForDate(today), -7 * (weeks - 1));
		const calendarDays = Array.from({ length: weeks * 7 }, (_, index) => addDaysToDate(start, index));

		return (
			<div className="heatmap-calendar" role="img" aria-label={activitySummary(calendarDays)}>
				<span aria-hidden="true" />
				{weekdays.map((day, index) => <span className="heatmap-weekday" key={`${day}-${index}`} aria-hidden="true">{day}</span>)}
				{Array.from({ length: weeks }, (_, week) => {
					const weekDays = calendarDays.slice(week * 7, (week + 1) * 7);
					return <Fragment key={weekDays[0]}>
						<span className="heatmap-week-label">{weekLabel(weekDays[0]!)}</span>
						{weekDays.map((key) => {
							const minutes = data[key] ?? 0;
							const future = key > today;
							return <div className="heatmap-calendar-cell" key={key} aria-hidden="true" style={{ background: future ? "transparent" : fill(getIntensity(minutes)), border: future ? "1px dashed color-mix(in srgb, var(--fg) 22%, transparent)" : "1px solid color-mix(in srgb, var(--fg) 10%, transparent)" }} />;
						})}
					</Fragment>;
				})}
			</div>
		);
	}

	return (
		<div className="heatmap-scroll">
			<div
				className="heatmap-grid"
				role="img"
				aria-label={activitySummary(days)}
				style={{ "--heatmap-columns": weeks } as CSSProperties}
			>
				{days.map((key) => {
					const minutes = data[key] ?? 0;
					const intensity = getIntensity(minutes);
					return (
						<div
							className="heatmap-cell"
							key={key}
							aria-hidden="true"
							style={{ background: fill(intensity) }}
						/>
					);
				})}
			</div>
		</div>
	);
}
