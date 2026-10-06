import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { books } from '@/server/db/schema'
import {
  POPULAR_CATALOG_SOURCES,
  buildPopularCatalogSearchUrl,
  extractPopularCatalogWorks,
  type PopularCatalogBook,
  type PopularCatalogSource,
} from '@/lib/popularCatalogSeed'

const PAGE_SIZE = 50
const MAX_BOOKS_PER_SOURCE = 5_000
const REQUEST_DELAY_MS = 500
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000
const MIN_REQUEST_TIMEOUT_MS = 5_000
const MAX_REQUEST_TIMEOUT_MS = 60_000
const MAX_REQUEST_ATTEMPTS = 3
const RETRY_DELAYS_MS = [2_000, 5_000]

interface Options {
  apply: boolean
  sources: PopularCatalogSource[]
  limit: number
}

function parseOptions(args: string[]): Options {
  let apply = false
  let limit = MAX_BOOKS_PER_SOURCE
  let sourceArgument = 'all'

  for (const arg of args) {
    if (arg === '--apply') {
      apply = true
    } else if (arg.startsWith('--source=')) {
      sourceArgument = arg.slice('--source='.length)
    } else if (arg.startsWith('--limit=')) {
      limit = Number(arg.slice('--limit='.length))
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BOOKS_PER_SOURCE) {
    throw new Error(`--limit must be an integer between 1 and ${MAX_BOOKS_PER_SOURCE}.`)
  }

  const sources = sourceArgument === 'all'
    ? [...POPULAR_CATALOG_SOURCES]
    : sourceArgument.split(',').map((source) => {
      if (!POPULAR_CATALOG_SOURCES.includes(source as PopularCatalogSource)) {
        throw new Error(`--source must be one of: all, ${POPULAR_CATALOG_SOURCES.join(', ')}.`)
      }
      return source as PopularCatalogSource
    })

  return { apply, sources, limit }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function getRequestTimeoutMs() {
  const configured = process.env.CATALOG_SEED_REQUEST_TIMEOUT_MS
  if (!configured) return DEFAULT_REQUEST_TIMEOUT_MS

  const timeout = Number(configured)
  if (!Number.isSafeInteger(timeout) || timeout < MIN_REQUEST_TIMEOUT_MS || timeout > MAX_REQUEST_TIMEOUT_MS) {
    throw new Error(`CATALOG_SEED_REQUEST_TIMEOUT_MS must be an integer between ${MIN_REQUEST_TIMEOUT_MS} and ${MAX_REQUEST_TIMEOUT_MS}.`)
  }
  return timeout
}

function isRetryableRequestError(error: unknown) {
  if (error instanceof DOMException) return error.name === 'AbortError' || error.name === 'TimeoutError'
  return error instanceof TypeError
}

async function fetchPage(source: PopularCatalogSource, page: number) {
  let lastError: unknown
  const timeout = getRequestTimeoutMs()

  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(buildPopularCatalogSearchUrl(source, page, PAGE_SIZE), {
        headers: { 'User-Agent': `Soratra popular catalog seed (${process.env.SUPPORT_EMAIL || 'self-hosted instance'})` },
        signal: AbortSignal.timeout(timeout),
      })

      if (response.ok) return response
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`${source} page ${page} returned ${response.status}.`)
      }
      lastError = new Error(`${source} page ${page} returned ${response.status}.`)
    } catch (error) {
      if (!isRetryableRequestError(error)) throw error
      lastError = error
    }

    if (attempt < MAX_REQUEST_ATTEMPTS) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS.at(-1) ?? REQUEST_DELAY_MS
      process.stderr.write(`${source} page ${page} failed on attempt ${attempt}; retrying in ${delay / 1_000} seconds.\n`)
      await sleep(delay)
    }
  }

  throw new Error(`${source} page ${page} failed after ${MAX_REQUEST_ATTEMPTS} attempts.`, { cause: lastError })
}

async function fetchSource(source: PopularCatalogSource, limit: number): Promise<PopularCatalogBook[]> {
  const works = new Map<string, PopularCatalogBook>()
  const pages = Math.ceil(limit / PAGE_SIZE)

  for (let page = 1; page <= pages && works.size < limit; page += 1) {
    const response = await fetchPage(source, page)

    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || !('docs' in payload) || !Array.isArray(payload.docs)) {
      throw new Error(`${source} page ${page} returned an unexpected response.`)
    }
    if (payload.docs.length === 0) break

    for (const work of extractPopularCatalogWorks(payload.docs)) {
      if (!works.has(work.openLibraryId)) works.set(work.openLibraryId, work)
      if (works.size === limit) break
    }

    if (page < pages && works.size < limit) await sleep(REQUEST_DELAY_MS)
  }

  return [...works.values()]
}

async function insertMissingWorks(works: PopularCatalogBook[]) {
  const connectionString = process.env.POSTGRES_URL
  if (!connectionString) throw new Error('POSTGRES_URL is required when using --apply.')

  const client = postgres(connectionString, { max: 1 })
  try {
    const inserted = await drizzle(client)
      .insert(books)
      .values(works.map((work) => ({ ...work, genres: [] })))
      .onConflictDoNothing({ target: books.openLibraryId })
      .returning({ openLibraryId: books.openLibraryId })

    return inserted.length
  } finally {
    await client.end({ timeout: 5 })
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const collected = new Map<string, PopularCatalogBook>()

  for (const source of options.sources) {
    const works = await fetchSource(source, options.limit)
    for (const work of works) {
      if (!collected.has(work.openLibraryId)) collected.set(work.openLibraryId, work)
    }
    process.stdout.write(`Collected ${works.length} work records from ${source}.\n`)
  }

  const works = [...collected.values()]
  if (!options.apply) {
    process.stdout.write(`Dry run complete. Would insert up to ${works.length} missing work records. Re-run with --apply to insert.\n`)
    return
  }

  const inserted = await insertMissingWorks(works)
  process.stdout.write(`Inserted ${inserted} new work records. Existing records were not changed.\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
