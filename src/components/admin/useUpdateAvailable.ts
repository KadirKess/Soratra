"use client";

import { trpc } from "@/lib/trpc/client";

// Reads what the admin page's last check found; it never asks GitHub itself.
export function useUpdateAvailable(isAdmin: boolean) {
	const { data } = trpc.admin.updateStatus.useQuery({ check: false }, { enabled: isAdmin });
	return data?.updateAvailable ?? false;
}
