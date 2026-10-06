import { z } from 'zod'
import { logExternalRequestMetric } from '@/lib/observability'
import { siteConfig } from '@/lib/config'
import { openLibraryLanguageMatches, type CatalogLanguage } from '@/lib/catalogLanguages'

const e2eOpenLibraryBase = process.env.E2E === 'true' ? process.env.E2E_OPEN_LIBRARY_BASE : undefined
const SEARCH_BASE = e2eOpenLibraryBase ? `${e2eOpenLibraryBase}/search.json` : 'https://openlibrary.org/search.json'
const WORKS_BASE = e2eOpenLibraryBase ? `${e2eOpenLibraryBase}/works` : 'https://openlibrary.org/works'
const EDITIONS_BASE = e2eOpenLibraryBase ? `${e2eOpenLibraryBase}/books` : 'https://openlibrary.org/books'
const COVERS_BASE = 'https://covers.openlibrary.org/b/id'

// Open Library is frequently slow and occasionally unreachable. Bound every
// request so a degraded OL fails fast within the serverless function budget
// instead of hanging to the platform timeout.
const OL_TIMEOUT_MS = 5000

export class OpenLibraryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'OpenLibraryError'
  }
}

export class OpenLibraryUnavailableError extends OpenLibraryError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'OpenLibraryUnavailableError'
  }
}

export const openLibraryIdSchema = z.string().regex(/^OL\d+(?:W|M)$/, 'Use a valid Open Library work or edition ID.')

type OLFetchInit = RequestInit & { next?: { revalidate: number } }

type OLOperation = 'search' | 'work' | 'edition' | 'author'

async function olFetch(operation: OLOperation, url: string, init?: OLFetchInit): Promise<Response> {
  if (process.env.OPEN_LIBRARY_OUTAGE_SIMULATION === 'true') {
    throw new OpenLibraryUnavailableError('Open Library outage simulation is enabled.')
  }

  const startedAt = performance.now()
  const { headers: initHeaders, signal: _signal, next, ...requestInit } = init ?? {}
  const headers = new Headers(initHeaders)
  headers.set('User-Agent', `Soratra (${siteConfig.supportEmail})`)

  try {
    const response = await fetch(url, {
      ...requestInit,
      headers,
      next,
      signal: AbortSignal.timeout(OL_TIMEOUT_MS),
    })
    logExternalRequestMetric({
      service: 'open_library',
      operation,
      status: response.ok ? 'ok' : 'error',
      durationMs: Math.round(performance.now() - startedAt),
      cacheTtlSeconds: next?.revalidate ?? 0,
    })
    return response
  } catch (error) {
    logExternalRequestMetric({
      service: 'open_library',
      operation,
      status: 'error',
      durationMs: Math.round(performance.now() - startedAt),
      cacheTtlSeconds: next?.revalidate ?? 0,
    })
    throw error
  }
}

export interface OLWork {
  openLibraryId: string
  title: string
  originalTitle: string
  requestedLanguage: CatalogLanguage | null
  displayTitleLanguage: CatalogLanguage | null
  authors: string[]
  coverUrl: string | null
  description: string | null
  publishedDate: string | null
  pageCount: number | null
  genres: string[]
  alternativeTitles: string[]
}

// Open Library data is genuinely inconsistent: most fields are absent on some
// records. These schemas validate field TYPES (so a changed OL shape is caught)
// while treating every field as optional. z.object() strips unknown keys.
const olSearchDocSchema = z.object({
  key: z.string().optional(),
  title: z.string().optional(),
  alternative_title: z.array(z.string()).optional(),
  author_name: z.array(z.string()).optional(),
  cover_i: z.number().optional(),
  first_publish_year: z.number().optional(),
  subject: z.array(z.string()).optional(),
  number_of_pages_median: z.number().optional(),
  editions: z.object({
    docs: z.array(z.object({
      title: z.string().optional(),
      language: z.array(z.string()).optional(),
    })).optional(),
  }).optional(),
})
type OLSearchDoc = z.infer<typeof olSearchDocSchema>

const olSearchResponseSchema = z.object({
  docs: z.array(z.unknown()).optional(),
})

// Shared shape for the works and editions endpoints (supersets both).
const olAuthorRefSchema = z.object({
  key: z.string().optional(),
  author: z.object({ key: z.string() }).optional(),
})

const olBookSchema = z.object({
  key: z.string().optional(),
  title: z.string().optional(),
  covers: z.array(z.number()).optional(),
  subjects: z.array(z.string()).optional(),
  description: z.unknown().optional(),
  number_of_pages: z.number().optional(),
  publish_date: z.unknown().optional(),
  first_publish_date: z.unknown().optional(),
  created: z.object({ value: z.string().optional() }).optional(),
  works: z.array(z.object({ key: z.string() })).optional(),
  authors: z.array(olAuthorRefSchema).optional(),
  alternative_title: z.array(z.string()).optional(),
  other_titles: z.unknown().optional(),
  translated_titles: z.unknown().optional(),
})
type OLBook = z.infer<typeof olBookSchema>

const olAuthorSchema = z.object({ name: z.string().optional() })

const SEARCH_FIELDS = [
  'key',
  'title',
  'alternative_title',
  'author_name',
  'cover_i',
  'first_publish_year',
  'subject',
  'number_of_pages_median',
  'editions',
  'editions.title',
  'editions.language',
].join(',')

function buildCoverUrl(coverId: number | null | undefined): string | null {
  if (!coverId) return null
  return `${COVERS_BASE}/${coverId}-L.jpg`
}

function uniqueTitles(titles: string[], title: string) {
  return [...new Set(titles.map((value) => value.trim()).filter((value) => value && value !== title))]
}

function extractTitleValues(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (typeof item === 'string') return [item]
    if (typeof item !== 'object' || item === null) return []
    const record = item as Record<string, unknown>
    return typeof record.title === 'string'
      ? [record.title]
      : typeof record.text === 'string'
        ? [record.text]
        : []
  })
}

function alternativeTitlesForBook(book: OLBook) {
  const title = book.title ?? 'Unknown title'
  return uniqueTitles([
    ...(book.alternative_title ?? []),
    ...extractTitleValues(book.other_titles),
    ...extractTitleValues(book.translated_titles),
  ], title)
}

async function searchAlternativeTitlesByWorkOlid(olid: string) {
  const url = `${SEARCH_BASE}?q=${encodeURIComponent(`key:${olid}`)}&fields=key,title,alternative_title&limit=1`

  try {
    const res = await olFetch('search', url, { next: { revalidate: 3600 } })
    if (!res.ok) return []

    const parsed = olSearchResponseSchema.safeParse(await res.json())
    if (!parsed.success) return []

    for (const raw of parsed.data.docs ?? []) {
      const doc = olSearchDocSchema.safeParse(raw)
      if (!doc.success || (doc.data.key ?? '').replace('/works/', '') !== olid) continue
      return uniqueTitles(doc.data.alternative_title ?? [], doc.data.title ?? 'Unknown title')
    }
  } catch {
    // Alternative titles improve recognition but should not make an otherwise
    // available book detail page fail.
  }

  return []
}

function searchDisplayTitle(doc: OLSearchDoc, preferredLanguage: CatalogLanguage) {
  const canonicalTitle = doc.title ?? 'Unknown title'
  const editions = doc.editions?.docs ?? []
  const matchingEdition = editions.find((edition) => edition.title && openLibraryLanguageMatches(preferredLanguage, edition.language))
  const englishEdition = editions.find((edition) => edition.title && openLibraryLanguageMatches('en', edition.language))

  if (matchingEdition?.title) return { title: matchingEdition.title, language: preferredLanguage }
  if (englishEdition?.title) return { title: englishEdition.title, language: 'en' as const }
  return { title: canonicalTitle, language: null }
}

function toOLWork(doc: OLSearchDoc, preferredLanguage: CatalogLanguage): OLWork {
  const openLibraryId = (doc.key ?? '').replace('/works/', '')
  const originalTitle = doc.title ?? 'Unknown title'
  const displayTitle = searchDisplayTitle(doc, preferredLanguage)

  return {
    openLibraryId,
    title: displayTitle.title,
    originalTitle,
    requestedLanguage: preferredLanguage,
    displayTitleLanguage: displayTitle.language,
    authors: doc.author_name ?? [],
    coverUrl: buildCoverUrl(doc.cover_i),
    description: null,
    publishedDate: doc.first_publish_year != null ? String(doc.first_publish_year) : null,
    pageCount: doc.number_of_pages_median ?? null,
    genres: (doc.subject ?? []).slice(0, 5),
    alternativeTitles: doc.alternative_title ?? [],
  }
}

export async function searchWorks(query: string, preferredLanguage: CatalogLanguage = 'en', limit = 20): Promise<OLWork[]> {
  const url = `${SEARCH_BASE}?q=${encodeURIComponent(query)}&lang=${preferredLanguage}&fields=${SEARCH_FIELDS}&limit=${limit}`
  let res: Response
  try {
    res = await olFetch('search', url, { next: { revalidate: 300 } })
  } catch (err) {
    throw new OpenLibraryError('Open Library search request failed', { cause: err })
  }
  // 5xx (and timeouts above) are OL's fault -> surface as an error so the UI
  // shows "try again" rather than a misleading "no results". 4xx falls through
  // to an empty list.
  if (res.status >= 500) {
    throw new OpenLibraryError(`Open Library search returned ${res.status}`)
  }
  if (!res.ok) return []

  const parsed = olSearchResponseSchema.safeParse(await res.json())
  if (!parsed.success) {
    throw new OpenLibraryError('Open Library search response shape changed')
  }

  // Validate each doc on its own so one malformed record doesn't drop the
  // whole result set.
  const works: OLWork[] = []
  for (const raw of parsed.data.docs ?? []) {
    const doc = olSearchDocSchema.safeParse(raw)
    if (doc.success) works.push(toOLWork(doc.data, preferredLanguage))
  }
  return works
}

export async function resolveWorkTitle(openLibraryId: string, preferredLanguage: CatalogLanguage) {
  const works = await searchWorks(`key:/works/${openLibraryId}`, preferredLanguage, 1)
  return works.find((work) => work.openLibraryId === openLibraryId) ?? null
}

function parseDescription(raw: unknown): string | null {
  if (!raw) return null
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    return (raw as { value: string }).value ?? null
  }
  return null
}

function extractYear(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const raw = String(value)
  const match = raw.match(/\b(\d{4})\b/)
  return match?.[1] ?? null
}

function parsePublishedDate(book: OLBook): string | null {
  const firstPublishDate = extractYear(book.first_publish_date)
  if (firstPublishDate) return firstPublishDate

  return extractYear(book.created?.value)
}

function extractAuthorKeys(book: OLBook): string[] {
  return (book.authors ?? [])
    .map((ref) => ref.author?.key ?? ref.key ?? null)
    .filter((key): key is string => key !== null)
}

async function fetchAuthorName(authorKey: string): Promise<string | null> {
  // Author names are best-effort enrichment; never let a slow author lookup
  // abort the whole book fetch.
  try {
    const res = await olFetch('author', `https://openlibrary.org${authorKey}.json`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const parsed = olAuthorSchema.safeParse(await res.json())
    return parsed.success ? (parsed.data.name ?? null) : null
  } catch {
    return null
  }
}

// A changed work/edition shape returns null here (surfaces as notFound to the
// caller) rather than throwing -- a single missing book detail isn't worth
// white-screening, and the search path above already fails loudly on shape drift.
async function getEditionByOlid(olid: string): Promise<OLWork | null> {
  let res: Response
  try {
    res = await olFetch('edition', `${EDITIONS_BASE}/${olid}.json`, {
      next: { revalidate: 3600 },
    })
  } catch (error) {
    throw new OpenLibraryUnavailableError('Open Library details are temporarily unavailable', { cause: error })
  }
  if (res.status >= 500) throw new OpenLibraryUnavailableError(`Open Library details returned ${res.status}`)
  if (!res.ok) return null

  const parsed = olBookSchema.safeParse(await res.json())
  if (!parsed.success) return null
  const data = parsed.data
  if (!data.key) return null

  const coverId = data.covers?.[0] ?? null
  const authorKeys = extractAuthorKeys(data)
  const authors = (
    await Promise.all(authorKeys.slice(0, 3).map(fetchAuthorName))
  ).filter((name): name is string => name !== null)

  const workKey = data.works?.[0]?.key
  let description = parseDescription(data.description)
  let genres = (data.subjects ?? []).slice(0, 5)

  if (workKey && (!description || genres.length === 0)) {
    try {
      const workRes = await olFetch('work', `https://openlibrary.org${workKey}.json`, {
        next: { revalidate: 3600 },
      })
      if (workRes.ok) {
        const workParsed = olBookSchema.safeParse(await workRes.json())
        if (workParsed.success) {
          description = description ?? parseDescription(workParsed.data.description)
          genres = genres.length > 0 ? genres : (workParsed.data.subjects ?? []).slice(0, 5)
        }
      }
    } catch { }
  }

  return {
    openLibraryId: olid,
    title: data.title ?? 'Unknown title',
    originalTitle: data.title ?? 'Unknown title',
    requestedLanguage: null,
    displayTitleLanguage: null,
    authors,
    coverUrl: buildCoverUrl(coverId),
    description,
    publishedDate: extractYear(data.publish_date) ?? parsePublishedDate(data),
    pageCount: data.number_of_pages ?? null,
    genres,
    alternativeTitles: alternativeTitlesForBook(data),
  }
}

export async function getWorkByOlid(olid: string): Promise<OLWork | null> {
  if (!openLibraryIdSchema.safeParse(olid).success) return null
  if (olid.endsWith('M')) {
    return getEditionByOlid(olid)
  }

  let res: Response
  try {
    res = await olFetch('work', `${WORKS_BASE}/${olid}.json`, {
      next: { revalidate: 3600 },
    })
  } catch (error) {
    throw new OpenLibraryUnavailableError('Open Library details are temporarily unavailable', { cause: error })
  }
  if (res.status >= 500) throw new OpenLibraryUnavailableError(`Open Library details returned ${res.status}`)
  if (!res.ok) return null

  const parsed = olBookSchema.safeParse(await res.json())
  if (!parsed.success) return null
  const data = parsed.data
  if (!data.key) return null

  const coverId = data.covers?.[0] ?? null
  const authors = (
    await Promise.all(extractAuthorKeys(data).slice(0, 3).map(fetchAuthorName))
  ).filter((n): n is string => n !== null)
  const alternativeTitles = alternativeTitlesForBook(data)

  return {
    openLibraryId: olid,
    title: data.title ?? 'Unknown title',
    originalTitle: data.title ?? 'Unknown title',
    requestedLanguage: null,
    displayTitleLanguage: null,
    authors,
    coverUrl: buildCoverUrl(coverId),
    description: parseDescription(data.description),
    publishedDate: parsePublishedDate(data),
    pageCount: null,
    genres: (data.subjects ?? []).slice(0, 5),
    alternativeTitles: alternativeTitles.length > 0 ? alternativeTitles : await searchAlternativeTitlesByWorkOlid(olid),
  }
}
