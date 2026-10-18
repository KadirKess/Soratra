"use client";

import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { CoverPlaceholder } from "./CoverPlaceholder";
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
		<section aria-labelledby="from-shelf-title" className="card-flat overflow-hidden">
				<div className="grid sm:grid-cols-[7rem_minmax(0,1fr)]">
					<Link href={`/books/${encodeURIComponent(book.openLibraryId)}`} aria-label={`View ${book.title}`} className="group flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
						<div className="cover w-24 sm:w-full transition-transform duration-150 group-hover:-translate-y-0.5">
							<CoverPlaceholder key={book.id} title={book.title} author={book.authors[0]} />
							{book.coverUrl && <Image key={book.coverUrl} src={book.coverUrl} alt={book.title} fill className="object-cover" sizes="112px" />}
						</div>
					</Link>
					<div className="p-5 flex flex-col gap-3">
						<div>
							<p className="eyebrow">From your shelf</p>
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
