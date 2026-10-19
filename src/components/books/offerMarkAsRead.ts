import { toast } from "sonner";
import type { Book } from "@/server/db";
import { trpc } from "@/lib/trpc/client";
import { celebrateFinished } from "@/lib/celebrate";

type Utils = ReturnType<typeof trpc.useUtils>;

// Reaching the last page only suggests finishing: people stop at the end of the
// main text, skip the notes, or have the wrong total. The toast outlives the
// check-in dialog, so it calls the client directly rather than a mutation hook.
export function offerMarkAsRead(utils: Utils, book: Pick<Book, "id" | "title">) {
	toast(`Last page of ${book.title}`, {
		description: "Move it to your read shelf?",
		duration: 10_000,
		action: {
			label: "Mark as read",
			onClick: async () => {
				try {
					await utils.client.userBooks.upsert.mutate({ bookId: book.id, status: "read" });
					celebrateFinished(book.title);
				} catch {
					toast.error("Could not mark it as read. Try again from the book page.");
				} finally {
					utils.userBooks.invalidate();
					utils.users.dashboard.invalidate();
				}
			},
		},
	});
}
