import { getOrCreateBook, resolveUnknownTitle } from "@/server/books";
import { auth } from "@/server/auth";
import { db, bookTitleResolutions, users } from "@/server/db";
import { LogBookForm } from "@/components/books/LogBookForm";
import { SessionHistory } from "@/components/books/SessionHistory";
import { StartReadingButton } from "@/components/books/StartReadingButton";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPastelColor } from "@/lib/pastel";
import ReactMarkdown from "react-markdown";
import { and, eq } from "drizzle-orm";
import { titlesMatch } from "@/lib/titles";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function BookPage({ params }: PageProps) {
	const { id } = await params;
	const openLibraryId = decodeURIComponent(id);

	const dbBook = await getOrCreateBook(openLibraryId);
	if (!dbBook) notFound();
	const session = await auth();
	const reader = session?.user?.id
		? await db.query.users.findFirst({ where: eq(users.id, session.user.id), columns: { preferredLanguage: true } })
		: null;
	let resolution = reader
		? await db.query.bookTitleResolutions.findFirst({ where: and(eq(bookTitleResolutions.bookId, dbBook.id), eq(bookTitleResolutions.language, reader.preferredLanguage)) })
		: null;
	if (!resolution && reader) {
		try {
			resolution = await resolveUnknownTitle(dbBook, reader.preferredLanguage as import('@/lib/catalogLanguages').CatalogLanguage);
		} catch {
			// A temporary catalog failure leaves the language unresolved for a later visit.
		}
	}
	const englishResolution = reader && !resolution?.title && reader.preferredLanguage !== 'en'
		? await db.query.bookTitleResolutions.findFirst({ where: and(eq(bookTitleResolutions.bookId, dbBook.id), eq(bookTitleResolutions.language, 'en')) })
		: null;
	const displayTitle = resolution?.title ?? englishResolution?.title ?? null;

	return (
		<div className="max-w-4xl">
			<div className="flex gap-8 flex-col sm:flex-row">
				{/* Cover */}
				<div className="shrink-0 w-40 sm:w-52">
					<div
						className="relative rounded-xl overflow-hidden"
						style={{
							aspectRatio: "2/3",
							border: "2px solid var(--fg)",
							boxShadow: "4px 4px 0 var(--fg)",
						}}
					>
						{dbBook.coverUrl ? (
							<Image
								src={dbBook.coverUrl}
								alt={dbBook.title}
								fill
								className="object-cover"
								sizes="(max-width: 640px) 160px, 208px"
								priority
							/>
						) : (
							<div
								className="w-full h-full flex items-end p-4 rounded-[10px]"
								style={{
									background: getPastelColor(dbBook.title),
									border: "2px solid var(--fg)",
								}}
							>
								<span
									className="text-lg font-bold leading-tight"
									style={{
										fontFamily: "var(--font-cormorant)",
										color: "var(--fg)",
									}}
								>
									{dbBook.title}
								</span>
							</div>
						)}
					</div>
				</div>

				{/* Details */}
				<div className="flex-1 space-y-4 min-w-0">
					<div>
						<h1
							className="text-3xl sm:text-4xl font-light leading-tight"
							style={{ fontFamily: "var(--font-cormorant)" }}
						>
							{dbBook.title}
						</h1>
						{displayTitle && !titlesMatch(displayTitle, dbBook.title) && (
							<p className="mt-1 text-xl leading-snug" style={{ color: "var(--fg)", fontFamily: "var(--font-cormorant)" }}>
								{displayTitle}
							</p>
						)}
						<p
							className="mt-1 text-base"
							style={{ color: "var(--muted)" }}
						>
							{dbBook.authors.join(", ")}
						</p>
					</div>

					<div
						className="flex gap-4 text-sm flex-wrap"
						style={{ color: "var(--muted)" }}
					>
						{dbBook.publishedDate && (
							<span>{dbBook.publishedDate}</span>
						)}
						{dbBook.pageCount && (
							<span>{dbBook.pageCount} pages</span>
						)}
					</div>

					{dbBook.genres.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{dbBook.genres.map((g) => (
								<span
									key={g}
									className="px-3 py-1 text-xs font-bold"
									style={{
										border: "2px solid var(--fg)",
										borderRadius: "8px",
										background: "var(--straw)",
										color: "var(--fg)",
										boxShadow: "2px 2px 0 var(--fg)",
									}}
								>
									{g}
								</span>
							))}
						</div>
					)}

					<div className="space-y-3">
						<StartReadingButton book={dbBook} />
						<LogBookForm bookId={dbBook.id} />
					</div>
				</div>
			</div>

			{dbBook.description && (
				<div className="mt-8 max-w-2xl">
					<h2
						className="text-xl font-light mb-3"
						style={{ fontFamily: "var(--font-cormorant)" }}
					>
						About
					</h2>
					<div
						className="space-y-2 text-sm leading-relaxed"
						style={{ color: "var(--muted)" }}
					>
						<ReactMarkdown>{dbBook.description}</ReactMarkdown>
					</div>
				</div>
			)}

			<SessionHistory bookId={dbBook.id} />
		</div>
	);
}
