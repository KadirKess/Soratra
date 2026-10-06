"use client";

import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { getPastelColor } from "@/lib/pastel";
import type { Book } from "@/server/db";

interface ShelfPickCardProps {
	book: Book;
	onPickAnother: () => void;
	pickingAnother: boolean;
	canPickAnother: boolean;
}

export function ShelfPickCard({ book, onPickAnother, pickingAnother, canPickAnother }: ShelfPickCardProps) {
	const utils = trpc.useUtils();
	const startReading = trpc.userBooks.upsert.useMutation({
		onSuccess: () => {
			utils.userBooks.library.invalidate();
			utils.users.dashboard.invalidate();
			toast.success(`${book.title} is now in your reading list.`);
		},
		onError: () => toast.error("Could not start this book. Please try again."),
	});

	return (
		<section aria-labelledby="from-shelf-title" className="brutalist-card overflow-hidden" style={{ background: "var(--sky)" }}>
				<div className="grid sm:grid-cols-[7rem_minmax(0,1fr)]">
					<Link href={`/books/${encodeURIComponent(book.openLibraryId)}`} aria-label={`View ${book.title}`} className="relative min-h-48 sm:min-h-full block brutalist-card-hover" style={{ background: "rgba(255,255,255,0.28)", borderRadius: 0, boxShadow: "none" }}>
						{book.coverUrl ? (
							<Image key={book.coverUrl} src={book.coverUrl} alt={book.title} fill className="object-contain p-4" sizes="112px" />
						) : (
							<div className="h-full min-h-48 flex items-end p-4" style={{ background: getPastelColor(book.title) }}>
								<p className="font-bold leading-tight" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.2rem" }}>{book.title}</p>
							</div>
						)}
					</Link>
					<div className="p-5 flex flex-col gap-3">
						<div>
							<p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>From your shelf</p>
							<h2 id="from-shelf-title" className="font-bold leading-tight mt-1" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.75rem" }}><Link href={`/books/${encodeURIComponent(book.openLibraryId)}`} className="hover:underline">{book.title}</Link></h2>
							<p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{book.authors.join(", ")}</p>
							<p className="text-sm mt-3" style={{ color: "var(--fg)", opacity: 0.8 }}>You saved this for later.</p>
						</div>
						<div className="flex flex-wrap gap-3 mt-auto">
							<button type="button" className="btn-primary" onClick={() => startReading.mutate({ bookId: book.id, status: "reading" })} disabled={startReading.isPending}>
								{startReading.isPending ? "Starting..." : "Start reading"}
							</button>
							{canPickAnother && (
								<button type="button" className="btn-secondary" onClick={onPickAnother} disabled={pickingAnother}>
									{pickingAnother ? "Choosing..." : "Pick another"}
								</button>
							)}
						</div>
					</div>
				</div>
		</section>
	);
}
