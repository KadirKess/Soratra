"use client";

import { useState } from "react";

export function SpoilerReveal({ children, label }: { children: string; label: string }) {
	const [revealed, setRevealed] = useState(false);

	if (revealed) return <p className="reader-note mt-2">{children}</p>;

	return (
		<button
			type="button"
			onClick={() => setRevealed(true)}
			className="mt-3 text-sm font-semibold underline underline-offset-4"
			style={{ color: "var(--accent-ink)" }}
			aria-expanded={false}
		>
			Reveal spoiler in {label}
		</button>
	);
}
