import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

vi.mock('server-only', () => ({}))
const { transaction, hash, getAuthSecret } = vi.hoisted(() => ({ transaction: vi.fn(), hash: vi.fn(), getAuthSecret: vi.fn() }))
vi.mock('@/server/db', async () => ({ ...await import('@/server/db/schema'), db: { transaction } }))
vi.mock('bcryptjs', () => ({ default: { hash, truncates: () => false } }))
vi.mock('@/server/instance', () => ({ getAuthSecret }))

import { POST } from '../route'
import { users } from '@/server/db/schema'

const dialect = new PgDialect()

function request(body: Record<string, unknown> = {}, origin?: string) {
  return new Request('http://192.168.1.20:3000/api/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
    body: JSON.stringify({ username: 'host', password: 'securepassword123', timezone: 'UTC', registration: 'invite', ...body }),
  })
}

function setupTransaction(unclaimed = true) {
  const inserted: Record<string, unknown>[] = []
  const claims: Array<{ values: Record<string, unknown>; predicate: SQL }> = []
  const tx = {
    update: () => ({ set: (values: Record<string, unknown>) => ({ where: (predicate: SQL) => {
      claims.push({ values, predicate })
      return { returning: async () => unclaimed ? [{ id: 1 }] : [] }
    } }) }),
    insert: (table: unknown) => ({ values: async (values: Record<string, unknown>) => {
      if (table === users) inserted.push(values)
    } }),
  }
  transaction.mockImplementation((callback) => callback(tx))
  return { inserted, claims }
}

beforeEach(() => {
  vi.clearAllMocks()
  hash.mockResolvedValue('password-hash')
  getAuthSecret.mockResolvedValue('secret')
})

describe('POST /api/setup', () => {
  it('creates the admin and records the registration choice exactly once', async () => {
    const { inserted, claims } = setupTransaction()
    const response = await POST(request({ registration: 'open' }))

    expect(response.status).toBe(201)
    expect(inserted[0]).toEqual(expect.objectContaining({ username: 'host', isAdmin: true, passwordHash: 'password-hash' }))
    expect(claims[0].values).toEqual(expect.objectContaining({ registration: 'open' }))
    expect(dialect.sqlToQuery(claims[0].predicate).sql).toContain('"setup_completed_at" is null')
  })

  it('refuses a second setup without creating an account', async () => {
    const { inserted } = setupTransaction(false)
    const response = await POST(request())

    expect(response.status).toBe(409)
    expect(inserted).toHaveLength(0)
  })

  it('rejects cross-origin requests', async () => {
    setupTransaction()
    const response = await POST(request({}, 'https://attacker.example'))
    expect(response.status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('validates the registration choice', async () => {
    setupTransaction()
    const response = await POST(request({ registration: 'everyone' }))
    expect(response.status).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
  })
})
