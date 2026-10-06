import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { findFirst, onConflictDoNothing, values, insert, getWorkByOlid } = vi.hoisted(() => {
  const onConflictDoNothing = vi.fn(() => Promise.resolve())
  const values = vi.fn(() => ({ onConflictDoNothing }))
  return {
    findFirst: vi.fn(),
    onConflictDoNothing,
    values,
    insert: vi.fn(() => ({ values })),
    getWorkByOlid: vi.fn(),
  }
})

vi.mock('@/server/db', async () => {
  const schema = await vi.importActual<typeof import('@/server/db/schema')>('@/server/db/schema')
  return {
    ...schema,
    db: {
      query: { books: { findFirst } },
      insert,
    },
  }
})

vi.mock('@/lib/openlibrary', () => ({ getWorkByOlid }))

import { getOrCreateBook } from '../books'

const work = {
  openLibraryId: 'OL123W',
  title: 'A Book',
  authors: ['An Author'],
  alternativeTitles: [],
  coverUrl: null,
  description: null,
  publishedDate: '2020',
  pageCount: null,
  genres: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getOrCreateBook', () => {
  it('returns the cached book without hitting Open Library on a hit', async () => {
    const cached = { id: 'uuid-1', ...work, alternativeTitlesFetchedAt: new Date() }
    findFirst.mockResolvedValueOnce(cached)

    const result = await getOrCreateBook('OL123W')

    expect(result).toBe(cached)
    expect(getWorkByOlid).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it('fetches, inserts, and returns the book on a cache miss', async () => {
    const inserted = { id: 'uuid-2', ...work }
    findFirst
      .mockResolvedValueOnce(undefined) // initial lookup misses
      .mockResolvedValueOnce(inserted) // post-insert lookup hits
    getWorkByOlid.mockResolvedValueOnce(work)

    const result = await getOrCreateBook('OL123W')

    expect(getWorkByOlid).toHaveBeenCalledWith('OL123W')
    expect(insert).toHaveBeenCalledOnce()
    expect(onConflictDoNothing).toHaveBeenCalledOnce()
    expect(result).toBe(inserted)
  })

  it('returns null when Open Library has no work for the id', async () => {
    findFirst.mockResolvedValueOnce(undefined)
    getWorkByOlid.mockResolvedValueOnce(null)

    const result = await getOrCreateBook('OL404W')

    expect(result).toBeNull()
    expect(insert).not.toHaveBeenCalled()
  })

  it('returns null if the row is missing after a conflicting insert', async () => {
    findFirst
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
    getWorkByOlid.mockResolvedValueOnce(work)

    const result = await getOrCreateBook('OL123W')

    expect(result).toBeNull()
  })
})
