import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRPCError } from '@trpc/server'

vi.mock('server-only', () => ({}))
vi.mock('@/server/db', () => ({
  db: {}, books: {}, userBooks: {}, users: {}, readingSessions: {}, friendships: {}, streakFreezes: {}, passwordResetTokens: {}, rateLimitBuckets: { resetAt: {} },
}))

const getOrCreateBook = vi.fn()
const searchCachedBooks = vi.fn()
const cacheSearchWorks = vi.fn()
vi.mock('@/server/books', () => ({
  cacheSearchWorks: (...args: unknown[]) => cacheSearchWorks(...args),
  getOrCreateBook: (...args: unknown[]) => getOrCreateBook(...args),
  searchCachedBooks: (...args: unknown[]) => searchCachedBooks(...args),
}))

const searchWorks = vi.fn()
vi.mock('@/lib/openlibrary', async () => {
  const actual = await vi.importActual<typeof import('@/lib/openlibrary')>('@/lib/openlibrary')
  return { ...actual, searchWorks: (...args: unknown[]) => searchWorks(...args) }
})

import { createCallerFactory } from '@/server/trpc'
import { booksRouter } from '../books'
import { friendshipsRouter } from '../friendships'
import { readingSessionsRouter } from '../readingSessions'
import { userBooksRouter } from '../userBooks'
import { usersRouter } from '../users'
import { db } from '@/server/db'

const userId = '11111111-1111-1111-1111-111111111111'
const session = { user: { id: userId, authVersion: 0 } }
const ctx = { session, db } as never
const booksCaller = createCallerFactory(booksRouter)(ctx)
const friendshipsCaller = createCallerFactory(friendshipsRouter)(ctx)
const sessionsCaller = createCallerFactory(readingSessionsRouter)(ctx)
const userBooksCaller = createCallerFactory(userBooksRouter)(ctx)
const usersCaller = createCallerFactory(usersRouter)(ctx)

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  const dbMock = db as unknown as Record<string, unknown>
  for (const key of Object.keys(dbMock)) delete dbMock[key]
  let sharedBucketCalls = 0
  dbMock.execute = vi.fn().mockImplementation(() => {
    sharedBucketCalls += 1
    return Promise.resolve([{ count: Math.ceil(sharedBucketCalls / 2), resetAt: new Date(Date.now() + 60_000), streak: 1 }])
  })
  dbMock.delete = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }))
  dbMock.select = vi.fn(() => ({
    from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ bookId: '22222222-2222-4222-8222-222222222222', minutes: 30 }]) })),
  }))
  dbMock.query = {
    users: {
      findFirst: vi.fn().mockResolvedValue({ id: userId, authVersion: 0, timezone: 'Europe/Paris', preferredLanguage: 'fr', weeklyFreezeUsed: 0, freezeWeekStart: null }),
    },
    userBooks: {
      findFirst: vi.fn().mockResolvedValue({ id: 'user-book-1' }),
    },
  }
})

describe('protected procedures', () => {
  it('rejects anonymous callers', async () => {
    const caller = createCallerFactory(booksRouter)({ session: null, db } as never)
    await expect(caller.getOrCreate({ openLibraryId: 'OL1W' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('rejects deleted or invalidated sessions', async () => {
    ;(db as unknown as { query: { users: { findFirst: ReturnType<typeof vi.fn> } } }).query.users.findFirst.mockResolvedValueOnce(null)
    await expect(booksCaller.getOrCreate({ openLibraryId: 'OL1W' })).rejects.toBeInstanceOf(TRPCError)
  })

  it('rejects anonymous social callers', async () => {
    const caller = createCallerFactory(friendshipsRouter)({ session: null, db } as never)
    await expect(caller.summary()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(caller.findByUsername({ username: 'reader_1' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('books and friendships', () => {
  it('returns null when a book has no shelf entry', async () => {
    const dbMock = db as unknown as { query: { userBooks: { findFirst: ReturnType<typeof vi.fn> } } }
    dbMock.query.userBooks.findFirst.mockResolvedValueOnce(undefined)
    await expect(userBooksCaller.getForBook({ bookId: '22222222-2222-4222-8222-222222222222' })).resolves.toBeNull()
  })

  it('returns null when a book is absent from the cache', async () => {
    const dbMock = db as unknown as { query: Record<string, unknown> }
    dbMock.query.books = { findFirst: vi.fn().mockResolvedValueOnce(undefined) }
    await expect(booksCaller.getById({ openLibraryId: 'OL404W' })).resolves.toBeNull()
  })

  it('uses the reader language when querying Open Library', async () => {
    const works = [{ openLibraryId: 'OL1W', title: 'Crime et Châtiment' }]
    searchWorks.mockResolvedValueOnce(works)

    await expect(booksCaller.search({ query: 'crime' })).resolves.toEqual({
      works: [{ openLibraryId: 'OL1W', title: 'Crime et Châtiment' }],
      unavailable: false,
    })
    expect(searchWorks).toHaveBeenCalledWith('crime', 'fr')
    expect(cacheSearchWorks).toHaveBeenCalledWith(works)
  })

  it('returns cached matches while Open Library is unavailable', async () => {
    searchWorks.mockRejectedValueOnce(new Error('Open Library timed out'))
    searchCachedBooks.mockResolvedValueOnce([{ openLibraryId: 'OL1W', title: 'Dune' }])

    await expect(booksCaller.search({ query: 'dune' })).resolves.toEqual({
      works: [{ openLibraryId: 'OL1W', title: 'Dune' }],
      unavailable: true,
    })
    expect(searchCachedBooks).toHaveBeenCalledWith('dune')
  })

  it('uses the existing book error contract', async () => {
    getOrCreateBook.mockResolvedValueOnce(null)
    await expect(booksCaller.getOrCreate({ openLibraryId: 'OL404W' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('rejects self-directed friend requests', async () => {
    await expect(friendshipsCaller.sendRequest({ addresseeId: userId })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('rejects a second request between the same two readers', async () => {
    const otherUserId = '22222222-2222-4222-8222-222222222222'
    const dbMock = db as unknown as { query: Record<string, unknown> }
    dbMock.query.friendships = {
      findFirst: vi.fn().mockResolvedValue({
        requesterId: otherUserId,
        addresseeId: userId,
        status: 'pending',
      }),
    }

    await expect(friendshipsCaller.sendRequest({ addresseeId: otherUserId })).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'This reader has already sent you a request',
    })
  })

  it('does not return the current reader from exact username lookup', async () => {
    const result = await friendshipsCaller.findByUsername({ username: 'reader_1' })
    expect(result).toBeNull()
  })

  it('only cancels a pending request sent by the current reader', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'friendship-1' }])
    const where = vi.fn(() => ({ returning }))
    ;(db as unknown as Record<string, unknown>).delete = vi.fn(() => ({ where }))

    await friendshipsCaller.cancelSentRequest({ addresseeId: '22222222-2222-4222-8222-222222222222' })
    expect(where).toHaveBeenCalledOnce()
  })

  it('caps friend requests per sender and returns a retry message', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'friendship-1' }])
    const values = vi.fn(() => ({ returning }))
    const dbMock = db as unknown as { query: Record<string, unknown>; insert: ReturnType<typeof vi.fn> }
    dbMock.query.friendships = { findFirst: vi.fn().mockResolvedValue(null) }
    dbMock.insert = vi.fn(() => ({ values }))

    const addresseeId = '22222222-2222-4222-8222-222222222222'
    for (let index = 0; index < 10; index += 1) {
      await friendshipsCaller.sendRequest({ addresseeId })
    }
    await expect(friendshipsCaller.sendRequest({ addresseeId })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      message: expect.stringContaining('Try again in'),
    })
  })
})

describe('reading sessions', () => {
  const bookId = '22222222-2222-4222-8222-222222222222'
  const input = { bookId, sessionDate: '2026-06-03', rating: 4, minutes: 30, expectedRevision: 0 }

  function mockInsert() {
    const values = vi.fn()
    const returning = vi.fn().mockResolvedValue([{ id: 'session-1', ...input }])
    const onConflictDoUpdate = vi.fn(() => ({ returning }))
    values.mockReturnValue({ onConflictDoUpdate })
    ;(db as unknown as Record<string, unknown>).insert = vi.fn(() => ({ values }))
    return { values, onConflictDoUpdate }
  }

  it('upserts a valid check-in', async () => {
    const mock = mockInsert()
    const result = await sessionsCaller.log(input)
    expect(result).toMatchObject({ id: 'session-1', minutes: 30 })
    expect(mock.values).toHaveBeenCalledWith(expect.objectContaining({ rating: '4', minutes: 30 }))
  })

  it('rejects invalid dates and future dates before writing', async () => {
    const mock = mockInsert()
    await expect(sessionsCaller.log({ ...input, sessionDate: '2026-02-30' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(sessionsCaller.log({ ...input, sessionDate: '9999-01-01' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(mock.values).not.toHaveBeenCalled()
  })

  it('rejects sessions for books outside the user library', async () => {
    const mock = mockInsert()
    const dbMock = db as unknown as { query: { userBooks: { findFirst: ReturnType<typeof vi.fn> } } }
    dbMock.query.userBooks.findFirst.mockResolvedValueOnce(null)
    await expect(sessionsCaller.log(input)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(mock.values).not.toHaveBeenCalled()
  })

  it('rejects a save when the entry changed after it was opened', async () => {
    const values = vi.fn()
    const returning = vi.fn().mockResolvedValue([])
    const onConflictDoUpdate = vi.fn(() => ({ returning }))
    values.mockReturnValue({ onConflictDoUpdate })
    ;(db as unknown as Record<string, unknown>).insert = vi.fn(() => ({ values }))

    await expect(sessionsCaller.log({ ...input, expectedRevision: 1 })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('returns null when a book has no entry for the selected date', async () => {
    const dbMock = db as unknown as { query: Record<string, unknown> }
    dbMock.query.readingSessions = { findFirst: vi.fn().mockResolvedValue(undefined) }

    await expect(sessionsCaller.forBookDate({ bookId, sessionDate: input.sessionDate })).resolves.toBeNull()
  })

  it('returns only safe session and completed-book fields in the friend feed', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-08-01T00:00:00.000Z').getTime())
    const otherUserId = '22222222-2222-4222-8222-222222222222'
    const sessionRows = [{
      id: 'session-1',
      sessionDate: '2026-07-30',
      createdAt: new Date('2026-07-30T10:00:00.000Z'),
      minutes: 45,
      rating: '4.5',
      note: 'A spoiler from the middle.',
      hasSpoiler: 1,
      user: { username: 'friend' },
      book: { openLibraryId: 'OL1W', title: 'A Session Book' },
    }, {
      id: 'session-0',
      sessionDate: '2026-07-30',
      createdAt: new Date('2026-07-30T10:00:00.000Z'),
      minutes: 20,
      rating: '3.5',
      note: 'A quick thought.',
      hasSpoiler: 0,
      user: { username: 'friend' },
      book: { openLibraryId: 'OL3W', title: 'Another Session Book' },
    }, {
      id: 'session-stale',
      sessionDate: '2020-01-01',
      createdAt: new Date('2020-01-01T10:00:00.000Z'),
      minutes: 15,
      rating: '2.5',
      note: null,
      hasSpoiler: 0,
      user: { username: 'friend' },
      book: { openLibraryId: 'OL4W', title: 'An Old Session Book' },
    }]
    const completedRows = [{
      id: 'user-book-1',
      finishedAt: new Date('2026-07-31T10:00:00.000Z'),
      updatedAt: new Date('2026-07-31T10:00:00.000Z'),
      rating: '5',
      review: 'A favourite.',
      reviewHasSpoiler: 1,
      user: { username: 'friend', timezone: 'UTC' },
      book: { openLibraryId: 'OL2W', title: 'A Finished Book' },
    }]
    const queryFor = (rows: unknown[]) => {
      const limit = vi.fn().mockResolvedValue(rows)
      const orderBy = vi.fn(() => ({ limit }))
      const where = vi.fn(() => ({ orderBy }))
      const joins = { innerJoin: vi.fn(() => joins), where }
      return { from: vi.fn(() => joins) }
    }
    const dbMock = db as unknown as { query: Record<string, unknown>; select: ReturnType<typeof vi.fn> }
    dbMock.query.friendships = {
      findMany: vi.fn().mockResolvedValue([{ requesterId: userId, addresseeId: otherUserId, status: 'accepted' }]),
    }
    dbMock.select = vi.fn()
      .mockReturnValueOnce(queryFor(sessionRows))
      .mockReturnValueOnce(queryFor(completedRows))

    try {
      await expect(sessionsCaller.friendFeed({ limit: 4 })).resolves.toEqual([
        {
          kind: 'finished',
          activityId: 'user-book-1',
          activityDate: '2026-07-31',
          rating: '5',
          review: 'A favourite.',
          reviewHasSpoiler: true,
          user: { username: 'friend' },
          book: { openLibraryId: 'OL2W', title: 'A Finished Book' },
        },
        {
          kind: 'session',
          activityId: 'session-0',
          activityDate: '2026-07-30',
          minutes: 20,
          rating: '3.5',
          note: 'A quick thought.',
          hasSpoiler: false,
          user: { username: 'friend' },
          book: { openLibraryId: 'OL3W', title: 'Another Session Book' },
        },
        {
          kind: 'session',
          activityId: 'session-1',
          activityDate: '2026-07-30',
          minutes: 45,
          rating: '4.5',
          note: 'A spoiler from the middle.',
          hasSpoiler: true,
          user: { username: 'friend' },
          book: { openLibraryId: 'OL1W', title: 'A Session Book' },
        },
      ])
    } finally {
      now.mockRestore()
    }
  })

  it('keeps friend profiles forbidden until the friendship is accepted', async () => {
    const friendId = '33333333-3333-4333-8333-333333333333'
    const dbMock = db as unknown as { query: Record<string, unknown> }
    const findMany = vi.fn()
    dbMock.query.users = {
      findFirst: vi.fn()
        .mockResolvedValueOnce({ id: userId, authVersion: 0, timezone: 'Europe/Paris' })
        .mockResolvedValueOnce({ id: friendId, username: 'friend', timezone: 'UTC' }),
    }
    dbMock.query.friendships = { findFirst: vi.fn().mockResolvedValue(null) }
    dbMock.query.userBooks = { findMany }

    await expect(usersCaller.friendProfile({ username: 'friend' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(findMany).not.toHaveBeenCalled()
  })
})

describe('user books', () => {
  const bookId = '22222222-2222-4222-8222-222222222222'

  it('sets updatedAt on an upsert conflict', async () => {
    const values = vi.fn()
    const returning = vi.fn().mockResolvedValue([{ id: 'book-1' }])
    const onConflictDoUpdate = vi.fn(() => ({ returning }))
    values.mockReturnValue({ onConflictDoUpdate })
    ;(db as unknown as Record<string, unknown>).insert = vi.fn(() => ({ values }))
    await userBooksCaller.upsert({ bookId, status: 'read', rating: 4.5 })
    const conflict = (onConflictDoUpdate.mock.calls as unknown as Array<[{ set: { updatedAt: unknown } }]>)[0]![0]
    expect(conflict.set.updatedAt).toBeInstanceOf(Date)
  })

  it('does not retain ratings or notes for unread statuses', async () => {
    const values = vi.fn()
    const returning = vi.fn().mockResolvedValue([{ id: 'book-1' }])
    const onConflictDoUpdate = vi.fn(() => ({ returning }))
    values.mockReturnValue({ onConflictDoUpdate })
    ;(db as unknown as Record<string, unknown>).insert = vi.fn(() => ({ values }))

    await userBooksCaller.upsert({ bookId, status: 'reading', rating: 4.5, review: 'private note' })

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      rating: null,
      review: null,
      reviewHasSpoiler: 0,
      finishedAt: null,
    }))
  })

  it('stores a spoiler setting only with a finished-book review', async () => {
    const values = vi.fn()
    const returning = vi.fn().mockResolvedValue([{ id: 'book-1' }])
    const onConflictDoUpdate = vi.fn(() => ({ returning }))
    values.mockReturnValue({ onConflictDoUpdate })
    ;(db as unknown as Record<string, unknown>).insert = vi.fn(() => ({ values }))

    await userBooksCaller.upsert({ bookId, status: 'read', review: 'The ending changes everything.', reviewHasSpoiler: true })

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      review: 'The ending changes everything.',
      reviewHasSpoiler: 1,
    }))
  })
})
