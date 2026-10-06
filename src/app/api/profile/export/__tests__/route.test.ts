import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const auth = vi.fn()
const rateLimit = vi.fn()
vi.mock('@/server/auth', () => ({ auth: () => auth() }))
vi.mock('@/lib/rateLimit', () => ({ rateLimit: (...args: unknown[]) => rateLimit(...args), rateLimitKey: () => 'export-fixture' }))
vi.mock('@/server/db', () => ({ db: {}, users: {}, userBooks: {}, readingSessions: {}, streakFreezes: {}, friendships: {} }))

import { GET } from '../route'
import { db } from '@/server/db'

const userId = '11111111-1111-4111-8111-111111111111'
const finishedAt = new Date('2026-09-20T18:30:00.000Z')
const createdAt = new Date('2026-09-01T12:00:00.000Z')

function setupDatabase() {
  const book = { title: 'Fixture book', authors: ['Fixture author'], openLibraryId: 'OL1W' }
  const findAccount = vi.fn()
    .mockResolvedValueOnce({ authVersion: 2 })
    .mockResolvedValueOnce({ username: 'reader', timezone: 'Europe/Paris', preferredLanguage: 'fr', gdprConsentAt: createdAt, gdprConsentVersion: 'fixture', createdAt })
  const query = {
    users: { findFirst: findAccount },
    userBooks: { findMany: vi.fn().mockResolvedValue([
      { book, status: 'read', rating: '4.5', review: 'A private review', reviewHasSpoiler: 1, finishedAt, createdAt, updatedAt: finishedAt },
      { book, status: 'reading', rating: null, review: null, reviewHasSpoiler: 0, finishedAt: null, createdAt, updatedAt: createdAt },
    ]) },
    readingSessions: { findMany: vi.fn().mockResolvedValue([{ book, sessionDate: '2026-09-19', rating: '4.0', minutes: 45, note: 'A session note', hasSpoiler: 1, createdAt }]) },
    streakFreezes: { findMany: vi.fn().mockResolvedValue([{ frozenDate: '2026-09-18', createdAt }]) },
    friendships: { findMany: vi.fn().mockResolvedValue([
      { requesterId: userId, addressee: { username: 'friend', deletedAt: null }, status: 'accepted', createdAt, updatedAt: createdAt },
      { requesterId: userId, addressee: { username: 'deleted-reader', deletedAt: createdAt }, status: 'accepted', createdAt, updatedAt: createdAt },
    ]) },
  }
  Object.assign(db, { query })
  return query
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.mockResolvedValue({ user: { id: userId, authVersion: 2 } })
  rateLimit.mockResolvedValue({ ok: true })
})

describe('account export', () => {
  it('preserves finish dates and writing without exporting deleted friends or credentials', async () => {
    setupDatabase()
    const response = await GET()
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('private, no-store')
    expect(body.version).toBe('1.7')
    expect(body.books[0]).toMatchObject({ finishedAt: finishedAt.toISOString(), rating: 4.5, review: 'A private review', reviewHasSpoiler: true })
    expect(body.books[1].finishedAt).toBeNull()
    expect(body.readingSessions[0]).toMatchObject({ sessionDate: '2026-09-19', minutes: 45, note: 'A session note', hasSpoiler: true })
    expect(body.streakFreezes[0].frozenDate).toBe('2026-09-18')
    expect(body.friendships).toEqual([expect.objectContaining({ counterpartUsername: 'friend', direction: 'sent', status: 'accepted' })])
    expect(body.account).not.toHaveProperty('passwordHash')
    expect(body.account).not.toHaveProperty('authVersion')
  })

  it('rejects an invalidated session before reading the journal', async () => {
    const query = setupDatabase()
    query.users.findFirst.mockReset().mockResolvedValue({ authVersion: 3 })
    const response = await GET()
    expect(response.status).toBe(401)
    expect(query.readingSessions.findMany).not.toHaveBeenCalled()
    expect(rateLimit).not.toHaveBeenCalled()
  })

  it('returns a retry delay without reading all data when the budget is exhausted', async () => {
    const query = setupDatabase()
    rateLimit.mockResolvedValueOnce({ ok: false, retryAfter: 120 })
    const response = await GET()
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('120')
    expect(query.userBooks.findMany).not.toHaveBeenCalled()
  })
})
