// Page progress helpers shared by the server summaries and the client.

export const MAX_PAGE = 100_000

// Below this, one quick entry would give a silly pace like 180 pages an hour.
export const PACE_MIN_SESSIONS = 3
export const PACE_MIN_MINUTES = 60

type PagedSession = { startPage: number | null; endPage: number | null; minutes: number }

// Pages read in a session, or null when it only records where the reader stopped.
export function sessionPages(session: Pick<PagedSession, 'startPage' | 'endPage'>): number | null {
  if (session.startPage == null || session.endPage == null) return null
  return session.endPage - session.startPage
}

export type PageSummary = {
  pagesRead: number
  // Sessions and minutes that have both ends, the only ones pace can use.
  pagedSessions: number
  pagedMinutes: number
}

export function summarizePages(sessions: PagedSession[]): PageSummary {
  let pagesRead = 0
  let pagedSessions = 0
  let pagedMinutes = 0
  for (const session of sessions) {
    const pages = sessionPages(session)
    if (pages == null) continue
    pagesRead += pages
    pagedSessions += 1
    pagedMinutes += session.minutes
  }
  return { pagesRead, pagedSessions, pagedMinutes }
}

// Pages an hour, or null until there is enough to say something honest.
export function pagesPerHour(summary: Pick<PageSummary, 'pagesRead' | 'pagedSessions' | 'pagedMinutes'>): number | null {
  if (summary.pagedSessions < PACE_MIN_SESSIONS || summary.pagedMinutes < PACE_MIN_MINUTES) return null
  return Math.round((summary.pagesRead / summary.pagedMinutes) * 60)
}

export function effectivePageCount(readerCount: number | null | undefined, catalogCount: number | null | undefined): number | null {
  return readerCount ?? catalogCount ?? null
}

export function formatPages(pages: number): string {
  return `${pages.toLocaleString('en')} ${pages === 1 ? 'page' : 'pages'}`
}

// "Page 150 of 320". Past the last page still reads as the end, not "of 320" with a bigger number.
export function formatPosition(page: number, total: number | null): string {
  if (total == null) return `Page ${page.toLocaleString('en')}`
  return `Page ${Math.min(page, total).toLocaleString('en')} of ${total.toLocaleString('en')}`
}

export function progressFraction(page: number, total: number | null): number | null {
  if (total == null || total <= 0) return null
  return Math.min(Math.max(page / total, 0), 1)
}

type DatedPosition = { sessionDate: string; endPage: number | null }

export type StartSuggestion = {
  // What "Picked up at" is pre-filled with, or null to leave it empty.
  startPage: number | null
  // The last page recorded before this date, for a hint when the field is left empty.
  lastRecordedPage: number | null
}

// Pre-fill for "Picked up at" on a session dated sessionDate. Only the sitting
// right before counts: if it had no page, the pages since the last bookmark
// were partly read then, so pre-filling the old bookmark would inflate pace.
export function suggestStartPage(sessions: DatedPosition[], sessionDate: string, total: number | null): StartSuggestion {
  const earlier = sessions
    .filter((session) => session.sessionDate < sessionDate)
    .sort((a, b) => (a.sessionDate < b.sessionDate ? 1 : -1))
  const lastRecordedPage = earlier.find((session) => session.endPage != null)?.endPage ?? null
  const previous = earlier[0]
  if (!previous) return { startPage: 0, lastRecordedPage }
  if (previous.endPage == null) return { startPage: null, lastRecordedPage }
  // Finished last time, so this is a reread starting over.
  if (total != null && previous.endPage >= total) return { startPage: 0, lastRecordedPage }
  return { startPage: previous.endPage, lastRecordedPage }
}
