"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { CheckInModal } from "./CheckInModal";
import { useCheckInSuccess } from "./useCheckInSuccess";
import { getPastelColor } from "@/lib/pastel";
import type { Book } from "@/server/db";

interface LibraryReadingCardProps {
	book: Book;
	loggedToday: boolean;
	todayDate?: string;
}

export function LibraryReadingCard({ book, loggedToday, todayDate }: LibraryReadingCardProps) {
	const [open, setOpen] = useState(false);
	const [imageFailed, setImageFailed] = useState(false);
	const handleSuccess = useCheckInSuccess();

	return (
		<article className="brutalist-card p-3 flex flex-col h-full gap-3" style={{ background: loggedToday ? "var(--sage)" : "var(--surface)" }}>
			<Link href={`/books/${encodeURIComponent(book.openLibraryId)}`} prefetch={false} className="group block">
				<div className="relative overflow-hidden rounded-md" style={{ aspectRatio: "2 / 3", border: "2px solid var(--fg)" }}>
					{book.coverUrl && !imageFailed ? (
						<Image src={book.coverUrl} alt={book.title} fill sizes="(max-width: 768px) 50vw, 200px" className="object-cover transition-transform duration-300 group-hover:scale-105" onError={() => setImageFailed(true)} />
					) : (
						<div className="w-full h-full flex items-center justify-center p-4 text-center" style={{ background: getPastelColor(book.title) }}>
							<span className="font-bold leading-tight line-clamp-5" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.2rem" }}>{book.title}</span>
						</div>
					)}
				</div>
				<p className="mt-3 font-bold leading-tight line-clamp-2" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.3rem" }}>{book.title}</p>
				{book.authors[0] && <p className="text-xs truncate mt-1" style={{ color: "var(--muted)" }}>{book.authors.join(", ")}</p>}
			</Link>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="btn-primary w-full justify-center text-xs mt-auto"
			>
				{loggedToday ? "Edit today’s log" : "Log reading"}
			</button>
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
		</article>
	);
}
