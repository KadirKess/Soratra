import 'server-only'
import { desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db, books, bookTitleResolutions, type Book, type BookTitleResolution } from './db'
import { getWorkByOlid, resolveWorkTitle, type OLWork } from '@/lib/openlibrary'
import { type CatalogLanguage } from '@/lib/catalogLanguages'

const inFlightLookups = new Map<string, Promise<Book | null>>()
const inFlightTitleResolutions = new Map<string, Promise<BookTitleResolution | null | undefined>>()
const missingUntil = new Map<string, number>()

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

function toSearchWork(book: Book): OLWork {
  return {
    openLibraryId: book.openLibraryId,
    title: book.title,
    originalTitle: book.title,
    requestedLanguage: null,
    displayTitleLanguage: null,
    authors: book.authors,
    coverUrl: book.coverUrl,
    description: book.description,
    publishedDate: book.publishedDate,
    pageCount: book.pageCount,
    genres: book.genres,
    alternativeTitles: book.alternativeTitles,
  }
}

function resolutionRows(work: OLWork, bookId: string) {
  if (!work.requestedLanguage) return []

  const rows: Array<{ bookId: string, language: CatalogLanguage, title: string | null }> = [{
    bookId,
    language: work.requestedLanguage,
    title: work.displayTitleLanguage === work.requestedLanguage ? work.title : null,
  }]

  if (work.displayTitleLanguage === 'en' && work.requestedLanguage !== 'en') {
    rows.push({ bookId, language: 'en', title: work.title })
  }

  return rows
}

export async function cacheSearchWorks(works: OLWork[]) {
  if (works.length === 0) return

  await db.transaction(async (tx) => {
    const cached = await tx.insert(books)
      .values(works.map((work) => ({
        openLibraryId: work.openLibraryId,
        title: work.originalTitle,
        authors: work.authors,
        alternativeTitles: work.alternativeTitles,
        coverUrl: work.coverUrl,
        description: work.description,
        publishedDate: work.publishedDate,
        pageCount: work.pageCount,
        genres: work.genres,
        cachedAt: new Date(),
      })))
      .onConflictDoUpdate({
        target: books.openLibraryId,
        set: {
          title: sql`excluded.title`,
          authors: sql`excluded.authors`,
          alternativeTitles: sql`excluded.alternative_titles`,
          coverUrl: sql`coalesce(excluded.cover_url, ${books.coverUrl})`,
          description: sql`coalesce(excluded.description, ${books.description})`,
          publishedDate: sql`coalesce(excluded.published_date, ${books.publishedDate})`,
          pageCount: sql`coalesce(excluded.page_count, ${books.pageCount})`,
          genres: sql`excluded.genres`,
          cachedAt: new Date(),
        },
      })
      .returning({ id: books.id, openLibraryId: books.openLibraryId })

    const ids = new Map(cached.map((book) => [book.openLibraryId, book.id]))
    const resolutions = works.flatMap((work) => resolutionRows(work, ids.get(work.openLibraryId) ?? ''))
      .filter((resolution) => resolution.bookId)
    if (resolutions.length === 0) return

    await tx.insert(bookTitleResolutions)
      .values(resolutions)
      .onConflictDoUpdate({
        target: [bookTitleResolutions.bookId, bookTitleResolutions.language],
        set: { title: sql`excluded.title`, checkedAt: new Date() },
      })
  })
}

export async function resolveUnknownTitle(book: Book, language: CatalogLanguage) {
  const existing = await db.query.bookTitleResolutions.findFirst({
    where: (resolution, { and, eq: equals }) => and(equals(resolution.bookId, book.id), equals(resolution.language, language)),
  })
  if (existing) return existing

  const key = `${book.id}:${language}`
  const inFlight = inFlightTitleResolutions.get(key)
  if (inFlight) return inFlight

  const lookup = (async () => {
    const work = await resolveWorkTitle(book.openLibraryId, language)
    if (work) {
      await cacheSearchWorks([work])
    } else {
      await db.insert(bookTitleResolutions)
        .values({ bookId: book.id, language, title: null })
        .onConflictDoNothing()
    }
    return db.query.bookTitleResolutions.findFirst({
      where: (resolution, { and, eq: equals }) => and(equals(resolution.bookId, book.id), equals(resolution.language, language)),
    }) ?? null
  })()
  inFlightTitleResolutions.set(key, lookup)
  try {
    return await lookup
  } finally {
    inFlightTitleResolutions.delete(key)
  }
}

// The local catalog is a read-only fallback for temporary Open Library
// failures. It never exposes reader-specific shelves or activity.
export async function searchCachedBooks(query: string, limit = 20): Promise<OLWork[]> {
  const pattern = `%${escapeLikePattern(query)}%`
  const matches = await db
    .select()
    .from(books)
    .where(or(
      ilike(books.title, pattern),
      sql`array_to_string(${books.authors}, ' ') ilike ${pattern}`,
      sql`array_to_string(${books.alternativeTitles}, ' ') ilike ${pattern}`,
    ))
    .orderBy(desc(books.cachedAt))
    .limit(limit)

  return matches.map(toSearchWork)
}

// Single source of truth for the book cache-on-read path. Returns the cached
// book, fetching and inserting from Open Library on a miss. Returns null only
// when OL has no work for the id. onConflictDoNothing keeps it safe if two
// requests race the same id.
export async function getOrCreateBook(openLibraryId: string): Promise<Book | null> {
  const existing = await db.query.books.findFirst({
    where: eq(books.openLibraryId, openLibraryId),
  })
  if (existing) return existing

  const missing = missingUntil.get(openLibraryId)
  if (missing && missing > Date.now()) return null

  const existingLookup = inFlightLookups.get(openLibraryId)
  if (existingLookup) return existingLookup

  const lookup = createBookFromOpenLibrary(openLibraryId)
  inFlightLookups.set(openLibraryId, lookup)
  try {
    return await lookup
  } finally {
    inFlightLookups.delete(openLibraryId)
  }
}

async function createBookFromOpenLibrary(openLibraryId: string) {
  const work = await getWorkByOlid(openLibraryId)
  if (!work) {
    missingUntil.set(openLibraryId, Date.now() + 5 * 60_000)
    return null
  }

  await db
    .insert(books)
    .values({
      openLibraryId: work.openLibraryId,
      title: work.title,
      authors: work.authors,
      alternativeTitles: work.alternativeTitles,
      alternativeTitlesFetchedAt: new Date(),
      coverUrl: work.coverUrl,
      description: work.description,
      publishedDate: work.publishedDate,
      pageCount: work.pageCount,
      genres: work.genres,
    })
    .onConflictDoNothing()

  const book = await db.query.books.findFirst({
    where: eq(books.openLibraryId, openLibraryId),
  })
  return book ?? null
}
