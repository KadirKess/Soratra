import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db, readingSessions } from './db'

// Where the reader last stopped in each book, from their newest session that recorded a page.
export async function latestPages(userId: string, bookIds: string[]): Promise<Map<string, number>> {
  if (bookIds.length === 0) return new Map()
  const rows = await db
    .selectDistinctOn([readingSessions.bookId], { bookId: readingSessions.bookId, endPage: readingSessions.endPage })
    .from(readingSessions)
    .where(and(
      eq(readingSessions.userId, userId),
      inArray(readingSessions.bookId, bookIds),
      isNotNull(readingSessions.endPage),
    ))
    .orderBy(readingSessions.bookId, desc(readingSessions.sessionDate))
  return new Map(rows.flatMap((row) => (row.endPage == null ? [] : [[row.bookId, row.endPage] as const])))
}
