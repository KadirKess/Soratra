import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

vi.mock('server-only', () => ({}))
const { transaction, budget, hash } = vi.hoisted(() => ({ transaction: vi.fn(), budget: vi.fn(), hash: vi.fn() }))
vi.mock('@/server/db', async () => ({
  ...await import('@/server/db/schema'), db: { transaction },
}))
vi.mock('@/lib/rateLimit', () => ({
  getClientIp: () => 'unknown', rateLimitKey: () => 'hashed-fixture-ip', rateLimit: budget,
}))
vi.mock('bcryptjs', () => ({ default: { hash, truncates: (value: string) => Buffer.byteLength(value) > 72 } }))
import { POST } from '../route'
import { passwordResetTokens, users } from '@/server/db/schema'

const token = 'synthetic-reset-token-012345678901234567890123456789'
const dialect = new PgDialect()
const request = (body: unknown = { token, password: 'replacement-password' }) => new Request('http://localhost/api/auth/password-reset/confirm', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

function setupTransaction(available = true, activeUser = true) {
  const predicates: SQL[] = []
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = []
  const deleteWhere = vi.fn().mockResolvedValue(undefined)
  const tx = {
    update: (table: unknown) => ({ set: (values: Record<string, unknown>) => {
      updates.push({ table, values })
      return { where: (predicate: SQL) => {
        predicates.push(predicate)
        return { returning: async () => table === passwordResetTokens
          ? available ? [{ userId: 'fixture-user' }] : []
          : activeUser ? [{ id: 'fixture-user' }] : [] }
      } }
    } }),
    delete: vi.fn(() => ({ where: deleteWhere })),
  }
  transaction.mockImplementation((callback) => callback(tx))
  return { predicates, updates, tx, deleteWhere }
}

beforeEach(() => {
  vi.clearAllMocks()
  budget.mockResolvedValue({ ok: true, retryAfter: 0 })
  hash.mockResolvedValue('new-bcrypt-hash')
})

describe('password reset confirmation', () => {
  it('requires an unused matching token that has not expired before changing a password', async () => {
    const { predicates, updates, tx } = setupTransaction(false)
    const response = await POST(request())
    expect(response.status).toBe(400)
    expect(hash).not.toHaveBeenCalled()
    expect(updates.some(({ table }) => table === users)).toBe(false)
    expect(tx.delete).not.toHaveBeenCalled()
    const query = dialect.sqlToQuery(predicates[0])
    expect(query.sql).toContain('"used_at" is null')
    expect(query.sql).toContain('"expires_at" >')
    expect(query.params).toContain(createHash('sha256').update(token).digest('hex'))
    expect(query.params).not.toContain(token)
    expect(Date.parse(String(query.params[1]))).toBeGreaterThan(Date.now() - 1_000)
    expect(Date.parse(String(query.params[1]))).toBeLessThanOrEqual(Date.now())
  })

  it('updates the password and invalidates sessions in the token-consumption transaction', async () => {
    const { updates, tx, deleteWhere } = setupTransaction()
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(hash).toHaveBeenCalledWith('replacement-password', 12)
    const update = updates.find(({ table }) => table === users)!.values
    expect(update.passwordHash).toBe('new-bcrypt-hash')
    expect(update.updatedAt).toBeInstanceOf(Date)
    expect(dialect.sqlToQuery(update.authVersion as SQL).sql).toContain('"auth_version" + 1')
    expect(tx.delete).toHaveBeenCalledWith(passwordResetTokens)
    expect(dialect.sqlToQuery(deleteWhere.mock.calls[0][0]).params).toContain('fixture-user')
  })

  it('does not reset a deleted or missing account', async () => {
    const { predicates, tx } = setupTransaction(true, false)
    const response = await POST(request())
    expect(response.status).toBe(400)
    expect(dialect.sqlToQuery(predicates[1]).sql).toContain('"deleted_at" is null')
    expect(tx.delete).not.toHaveBeenCalled()
  })

  it.each([
    { token: 'short', password: 'replacement-password' },
    { token, password: 'short' },
    { token, password: 'a'.repeat(73) },
    { token: 'a'.repeat(129), password: 'replacement-password' },
    null,
  ])('rejects invalid reset data before accessing the database', async (body) => {
    setupTransaction()
    expect((await POST(request(body))).status).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('enforces the attempt budget before checking a token', async () => {
    setupTransaction()
    budget.mockResolvedValue({ ok: false, retryAfter: 60 })
    const response = await POST(request())
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(transaction).not.toHaveBeenCalled()
    expect(hash).not.toHaveBeenCalled()
  })
})
