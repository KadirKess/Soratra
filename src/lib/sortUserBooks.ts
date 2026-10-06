// publishedDate is free-form Open Library text ("2020", "2020-01-01", or null).
// Sort most-recent first, pushing unknown dates to the end. Pure so the router's
// date_released branch stays testable without a database.
type WithReleaseDate = { book: { publishedDate: string | null } }

export function sortByReleaseDate<T extends WithReleaseDate>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const da = a.book.publishedDate ?? ''
    const db = b.book.publishedDate ?? ''
    if (!da && !db) return 0
    if (!da) return 1
    if (!db) return -1
    return db.localeCompare(da)
  })
}
