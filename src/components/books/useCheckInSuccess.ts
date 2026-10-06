"use client";

import { trpc } from "@/lib/trpc/client";
import { celebrateSession } from "@/lib/celebrate";
import type { CheckInResult } from "./CheckInModal";

export function useCheckInSuccess() {
	const utils = trpc.useUtils();

	return (result: CheckInResult) => {
		const previousStreak = utils.users.dashboard.getData()?.streak ?? 0;
		utils.users.dashboard.setData(undefined, (previous) => {
			if (!previous) return previous;
			const heatmap = { ...previous.heatmap };
			if (result.session.sessionDate >= result.heatmapStart && result.session.sessionDate <= result.todayDate) {
				heatmap[result.session.sessionDate] = result.sessionDateMinutes;
			}
			return { ...previous, streak: result.streak, todayLogged: result.todayLogged, heatmap };
		});
		utils.userBooks.getAll.setData(undefined, (previous) => (
			previous ? { ...previous, todayLogged: result.todayLogged } : previous
		));
		utils.readingSessions.forBookDate.setData(
			{ bookId: result.session.bookId, sessionDate: result.session.sessionDate },
			result.session,
		);
		utils.readingSessions.journal.invalidate();
		utils.readingSessions.periodStats.invalidate();
		utils.users.dashboard.invalidate();
		celebrateSession(previousStreak, result.streak);
	};
}
