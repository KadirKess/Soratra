"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { MAX_PAGE } from "@/lib/pages";

// The page count in the book's details. Open Library's figure is often for
// another edition, so readers with the book on their shelf can correct it in
// place: tap the number, type, Enter.
export function PageCountEditor({ bookId, catalogPageCount }: { bookId: string; catalogPageCount: number | null }) {
	const utils = trpc.useUtils();
	const { data: userBook } = trpc.userBooks.getForBook.useQuery({ bookId });
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");
	const cancelled = useRef(false);
	const setPageCount = trpc.userBooks.setPageCount.useMutation({
		onSuccess: (entry) => {
			utils.userBooks.getForBook.setData({ bookId }, entry);
			utils.readingSessions.pageContext.invalidate({ bookId });
			utils.userBooks.library.invalidate();
			utils.users.dashboard.invalidate();
		},
		onError: () => toast.error("Could not save the page count. Try again."),
	});

	const own = userBook?.pageCount ?? null;
	const shown = own ?? catalogPageCount;

	if (!userBook) return shown ? <span>{shown} pages</span> : null;

	function save() {
		setEditing(false);
		if (cancelled.current) {
			cancelled.current = false;
			return;
		}
		const value = draft.trim() === "" ? null : Number(draft);
		if (value !== null && (!Number.isInteger(value) || value < 1 || value > MAX_PAGE)) {
			toast.error("Use a page count of at least 1.");
			return;
		}
		// Clearing the field goes back to Open Library's count.
		if (value === own) return;
		setPageCount.mutate({ bookId, pageCount: value });
	}

	if (editing) {
		return (
			<span className="inline-flex items-center gap-2">
				<label htmlFor="book-page-count" className="sr-only">Pages in your copy</label>
				<input
					id="book-page-count"
					type="number"
					inputMode="numeric"
					min={1}
					max={MAX_PAGE}
					autoFocus
					value={draft}
					placeholder={catalogPageCount ? String(catalogPageCount) : "Pages"}
					onChange={(event) => setDraft(event.target.value)}
					onBlur={save}
					onKeyDown={(event) => {
						if (event.key === "Enter") event.currentTarget.blur();
						if (event.key === "Escape") {
							cancelled.current = true;
							event.currentTarget.blur();
						}
					}}
					className="brutalist-input w-24 py-1 text-center"
				/>
				<span>pages in your copy</span>
			</span>
		);
	}

	return (
		<button
			type="button"
			onClick={() => {
				setDraft(String(shown ?? ""));
				setEditing(true);
			}}
			className="underline decoration-dotted underline-offset-4 hover:decoration-solid"
			title="Change to match your copy"
		>
			{shown
				? `${shown} pages${own != null ? " in your copy" : ""}`
				: "Add the page count"}
		</button>
	);
}
