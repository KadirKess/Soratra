import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

vi.mock('server-only', () => ({}))

const { transaction, hash, rateLimit, getInstance, isSetupComplete } = vi.hoisted(() => ({
  transaction: vi.fn(),
  hash: vi.fn(),
  rateLimit: vi.fn(),
  getInstance: vi.fn(),
  isSetupComplete: vi.fn(),
}))

vi.mock('@/server/db', async () => ({ ...await import('@/server/db/schema'), db: { transaction } }))
vi.mock('bcryptjs', () => ({ default: { hash, truncates: () => false } }))
vi.mock('@/lib/rateLimit', () => ({
  getClientIp: () => '203.0.113.9',
  rateLimit,
  rateLimitKey: (scope: string) => scope,
}))
vi.mock('@/server/instance', () => ({ getInstance, isSetupComplete }))

import { POST } from '../route'
import { invites, users } from '@/server/db/schema'

const dialect = new PgDialect()
const inviteToken = 'synthetic-invite-token-0123456789012345678901'

function request(body: Record<string, unknown> = {}) {
  return new Request('https://instance.test/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'reader_name',
      password: 'securepassword123',
      timezone: 'UTC',
      gdprConsent: true,
      ...body,
    }),
  })
}

function setupTransaction({ inviteAvailable = true, insertError }: { inviteAvailable?: boolean; insertError?: unknown } = {}) {
  const inserted: Record<string, unknown>[] = []
  const inviteUpdates: Array<{ values: Record<string, unknown>; predicate: SQL }> = []
  const tx = {
    update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: (predicate: SQL) => {
      if (table === invites) inviteUpdates.push({ values, predicate })
      return { returning: async () => inviteAvailable ? [{ id: 'invite-1' }] : [], then: (resolve: (value: unknown) => void) => resolve(undefined) }
    } }) }),
    insert: (table: unknown) => ({ values: (values: Record<string, unknown>) => {
      if (table === users) inserted.push(values)
      return { returning: async () => {
        if (insertError) throw insertError
        return [{ id: 'new-user' }]
      } }
    } }),
  }
  transaction.mockImplementation((callback) => callback(tx))
  return { inserted, inviteUpdates }
}

beforeEach(() => {
  vi.clearAllMocks()
  rateLimit.mockResolvedValue({ ok: true, retryAfter: 0 })
  hash.mockResolvedValue('password-hash')
  isSetupComplete.mockResolvedValue(true)
  getInstance.mockResolvedValue({ registration: 'open' })
})

describe('POST /api/auth/register', () => {
  it('creates an account with a username and no email in open mode', async () => {
    const { inserted } = setupTransaction()
    const response = await POST(request())

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true })
    expect(inserted[0]).toEqual(expect.objectContaining({
      username: 'reader_name',
      passwordHash: 'password-hash',
      preferredLanguage: 'en',
    }))
    expect(inserted[0]).not.toHaveProperty('email')
    expect(inserted[0]).not.toHaveProperty('isAdmin')
  })

  it('refuses registration in invite mode without an invite', async () => {
    getInstance.mockResolvedValue({ registration: 'invite' })
    setupTransaction()
    const response = await POST(request())

    expect(response.status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('claims an unused, unexpired invite by its hash in the same transaction', async () => {
    getInstance.mockResolvedValue({ registration: 'invite' })
    const { inserted, inviteUpdates } = setupTransaction()
    const response = await POST(request({ invite: inviteToken }))

    expect(response.status).toBe(201)
    expect(inserted).toHaveLength(1)
    const claim = dialect.sqlToQuery(inviteUpdates[0].predicate)
    expect(claim.sql).toContain('"used_at" is null')
    expect(claim.sql).toContain('"expires_at" >')
    expect(claim.params).toContain(createHash('sha256').update(inviteToken).digest('hex'))
    expect(claim.params).not.toContain(inviteToken)
    expect(inviteUpdates[1].values).toEqual({ usedBy: 'new-user' })
  })

  it('rejects a used or expired invite without creating an account', async () => {
    getInstance.mockResolvedValue({ registration: 'invite' })
    const { inserted } = setupTransaction({ inviteAvailable: false })
    const response = await POST(request({ invite: inviteToken }))

    expect(response.status).toBe(403)
    expect(inserted).toHaveLength(0)
  })

  it('refuses registration before first-run setup', async () => {
    isSetupComplete.mockResolvedValue(false)
    const response = await POST(request())
    expect(response.status).toBe(409)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('tells the reader when their username is already taken', async () => {
    setupTransaction({ insertError: { cause: { code: '23505', constraint_name: 'users_username_normalized_unique' } } })
    const response = await POST(request())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'That username is already taken. Please choose another.',
      fieldErrors: { username: ['That username is already taken. Please choose another.'] },
    })
  })

  it('returns field-specific validation feedback', async () => {
    const response = await POST(request({ username: 'not allowed!' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Please correct the highlighted fields.',
      fieldErrors: {
        username: ['Username can use letters, numbers, and underscores only.'],
      },
    })
  })
})
