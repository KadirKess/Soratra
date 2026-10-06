"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { CheckInModal } from "./CheckInModal";
import { getPastelColor } from "@/lib/pastel";
import { useCheckInSuccess } from "./useCheckInSuccess";
import type { Book } from "@/server/db";

interface Props {
	book: Book;
	userBookId: string;
	loggedToday: boolean;
	todayDate?: string;
	variant?: "compact" | "medium" | "featured" | "desk";
}

export function CheckInCard({ book, userBookId, loggedToday, todayDate, variant = "compact" }: Props) {
	const [open, setOpen] = useState(false);
	const handleSuccess = useCheckInSuccess();
	const isDesk = variant === "desk";
	const isFeatured = variant === "featured" || isDesk;
	const isMedium = variant === "medium";
	const coverWidth = isDesk ? 152 : isFeatured ? 144 : isMedium ? 72 : 48;
	const coverHeight = isDesk ? 228 : isFeatured ? 216 : isMedium ? 108 : 72;
	const titleSize = isDesk ? "clamp(2rem, 3vw, 2.75rem)" : isFeatured ? "2.25rem" : isMedium ? "1.35rem" : "1rem";
	const actionLabel = loggedToday ? "Edit today’s entry" : "Log today’s reading";
	const bookHref = `/books/${encodeURIComponent(book.openLibraryId)}`;
	const cover = (
		<Link
			href={bookHref}
			aria-label={`View ${book.title}`}
			className="shrink-0 rounded-lg overflow-hidden"
			style={{
				width: coverWidth,
				height: coverHeight,
				border: "2px solid var(--fg)",
			}}
		>
			{book.coverUrl ? (
				<Image
					src={book.coverUrl}
					alt={book.title}
					width={coverWidth}
					height={coverHeight}
					className="object-cover w-full h-full"
				/>
			) : (
				<div
					className="w-full h-full flex items-end p-1"
					style={{ background: getPastelColor(book.title) }}
				>
					<span
						className="text-xs font-bold leading-tight"
						style={{ fontFamily: "var(--font-cormorant)" }}
					>
						{book.title}
					</span>
				</div>
			)}
		</Link>
	);
	const details = (
		<div className="flex-1 min-w-0">
			{isFeatured && (
				<p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
					Reading now
				</p>
			)}
			<Link
				href={bookHref}
				className="block w-fit hover:underline"
			>
				<span
				className={`font-bold leading-tight ${isFeatured ? "line-clamp-2" : "truncate"}`}
				style={{
					fontFamily: "var(--font-cormorant)",
					fontSize: titleSize,
				}}
				>
				{book.title}
				</span>
			</Link>
			<p
				className={`${isFeatured ? "text-sm line-clamp-2" : "text-xs truncate"} mt-1`}
				style={{ color: "var(--muted)" }}
			>
				{book.authors.join(", ")}
			</p>
			{isFeatured && (
				<>
					{loggedToday && <p className="mt-4 text-sm font-semibold" style={{ color: "var(--fg)", opacity: 0.78 }}>Logged today. You can adjust it anytime.</p>}
					<button type="button" onClick={() => setOpen(true)} className="btn-primary mt-4">
						{actionLabel}
					</button>
				</>
			)}
		</div>
	);

	return (
		<>
			{isFeatured ? (
				<article
					className={isDesk ? "w-full grid sm:grid-cols-[9.5rem_minmax(0,1fr)] gap-5 sm:gap-6 items-center" : "w-full brutalist-card p-5 sm:p-6 grid sm:grid-cols-[9rem_minmax(0,1fr)] gap-5 sm:gap-6 items-center"}
					style={isDesk ? undefined : { background: "var(--sage)", position: "relative", overflow: "hidden" }}
				>
					{cover}
					{details}
				</article>
			) : (
				<article
					className="w-full brutalist-card p-4 flex gap-3 items-start"
					style={{
						background: "var(--surface)",
						position: "relative",
						overflow: "hidden",
					}}
				>
					{cover}
					{details}
					<button type="button" onClick={() => setOpen(true)} className="btn-primary shrink-0 self-center min-h-11 min-w-11 px-3 text-xs">
						{loggedToday ? "Edit" : "Log"}
					</button>
				</article>
			)}

			{open && createPortal(
				<CheckInModal
					book={book}
					knownTodayEntry={loggedToday}
					todayDate={todayDate}
					onClose={() => setOpen(false)}
					onSuccess={(result) => {
						handleSuccess(result);
						setOpen(false);
					}}
				/>,
				document.body,
			)}
		</>
	);
}
