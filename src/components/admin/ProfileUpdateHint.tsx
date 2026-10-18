"use client";

import { useUpdateAvailable } from "./useUpdateAvailable";
import { UpdateDot } from "./UpdateDot";

export function ProfileUpdateHint() {
	const updateAvailable = useUpdateAvailable(true);
	if (!updateAvailable) return null;
	return (
		<p className="flex items-center gap-2 text-sm font-semibold">
			<UpdateDot />
			A new Soratra release is out.
		</p>
	);
}
