"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { sectionFor } from "@/lib/sections";

// Sets the page's section on the shell, so everything inside can use --section.
export function SectionFrame({ children }: { children: ReactNode }) {
	const section = sectionFor(usePathname()) ?? undefined;
	return <div className="flex min-h-screen" data-section={section}>{children}</div>;
}
