import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const auth = vi.fn()
vi.mock('@/server/auth', () => ({ auth: () => auth() }))
const bcrypt = vi.hoisted(() => ({ compare: vi.fn() }))
vi.mock('bcryptjs', () => ({ default: bcrypt }))
vi.mock('@/server/db', () => ({
  db: {}, users: {}, friendships: {}, passwordResetTokens: {}, readingSessions: {}, streakFreezes: {}, userBooks: {},
}))

import { POST } from '../route'
import { db } from '@/server/db'

const userId = '11111111-1111-1111-1111-111111111111'

function setupDatabase(active = true) {
  const returning = vi.fn().mockResolvedValue([{ id: userId }])
  const where = vi.fn(() => ({ returning }))
  const set = vi.fn(() => ({ where }))
  const tx = {
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    update: vi.fn(() => ({ set })),
  }
  const dbMock = db as unknown as Record<string, unknown>
  dbMock.query = { users: { findFirst: vi.fn().mockResolvedValue(active ? { id: userId, authVersion: 0, email: 'reader@example.com', passwordHash: 'hash' } : null) } }
  dbMock.transaction = vi.fn(async (callback: (value: typeof tx) => Promise<void>) => callback(tx))
  return { tx, set }
}

function deleteRequest(body: Record<string, string> = { email: 'reader@example.com', currentPassword: 'correct-password' }, origin?: string) {
  return new Request('https://instance.test/api/profile/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  bcrypt.compare.mockResolvedValue(true)
})

describe('POST /api/profile/delete', () => {
  it('returns 401 without a session', async () => {
    auth.mockResolvedValue(null)
    const { tx } = setupDatabase()
    const response = await POST(deleteRequest())
    expect(response.status).toBe(401)
    expect(tx.delete).not.toHaveBeenCalled()
  })

  it('creates a tombstone before cleaning up personal rows', async () => {
    auth.mockResolvedValue({ user: { id: userId, authVersion: 0 } })
    const { tx, set } = setupDatabase()
    const response = await POST(deleteRequest())
    expect(response.status).toBe(200)
    expect(tx.delete).toHaveBeenCalledTimes(5)
    expect(tx.update.mock.invocationCallOrder[0]).toBeLessThan(tx.delete.mock.invocationCallOrder[0])
    const values = (set.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]![0]
    expect(values.passwordHash).toBeNull()
    expect(values.timezone).toBeNull()
    expect(values.gdprConsentAt).toBeUndefined()
    expect(values.authVersion).toBe(1)
    expect(values.activeDataVersion).toBe(0)
    expect(values.deletedAt).toBeInstanceOf(Date)
  })

  it('clears both Auth.js session-cookie variants', async () => {
    auth.mockResolvedValue({ user: { id: userId, authVersion: 0 } })
    setupDatabase()
    const response = await POST(deleteRequest())
    const cookies = response.headers.get('set-cookie') ?? ''
    expect(cookies).toContain('authjs.session-token=')
    expect(cookies).toContain('__Secure-authjs.session-token=')
  })

  it('requires a matching email confirmation', async () => {
    auth.mockResolvedValue({ user: { id: userId, authVersion: 0 } })
    const { tx } = setupDatabase()
    const response = await POST(deleteRequest({ email: 'other@example.com', currentPassword: 'correct-password' }))
    expect(response.status).toBe(400)
    expect(tx.delete).not.toHaveBeenCalled()
  })

  it('rejects cross-origin requests', async () => {
    auth.mockResolvedValue({ user: { id: userId, authVersion: 0 } })
    const { tx } = setupDatabase()
    const response = await POST(deleteRequest({ email: 'reader@example.com', currentPassword: 'correct-password' }, 'https://attacker.example'))
    expect(response.status).toBe(403)
    expect(tx.delete).not.toHaveBeenCalled()
  })

  it('requires the current password', async () => {
    auth.mockResolvedValue({ user: { id: userId, authVersion: 0 } })
    bcrypt.compare.mockResolvedValue(false)
    const { tx } = setupDatabase()
    const response = await POST(deleteRequest())
    expect(response.status).toBe(400)
    expect(tx.delete).not.toHaveBeenCalled()
  })
})
