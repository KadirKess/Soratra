"use client";

import { trpc } from "@/lib/trpc/client";

export function useFriendSummary() {
	const { data } = trpc.friendships.summary.useQuery();
	return data?.pendingReceivedCount ?? 0;
}
