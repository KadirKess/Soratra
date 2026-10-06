import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { lookup, send, schedule } = vi.hoisted(() => ({ lookup: vi.fn(), send: vi.fn(), schedule: vi.fn() }))
vi.mock('@/server/db', () => ({ db: { query: { users: { findFirst: lookup } } }, users: {}, passwordResetTokens: {} }))
vi.mock('@/lib/email', () => ({ sendPasswordResetEmail: send }))
vi.mock('@/lib/rateLimit', () => ({ getClientIp: vi.fn(), rateLimit: vi.fn(), rateLimitKey: vi.fn() }))
vi.mock('next/server', async (importOriginal) => ({ ...await importOriginal<typeof import('next/server')>(), after: schedule }))
import { POST } from '../route'

afterEach(() => vi.unstubAllEnvs())

describe('email-disabled password recovery', () => {
  it('reports instance-wide unavailability without looking up a reader or creating a token', async () => {
    vi.stubEnv('EMAIL_MODE', 'disabled')
    const response = await POST(new Request('http://localhost/api/auth/password-reset/request', {
      method: 'POST', body: JSON.stringify({ email: 'reader@example.com' }),
    }))
    expect(response.status).toBe(503)
    expect((await response.json()).error).toContain('disabled on this instance')
    expect(lookup).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    expect(schedule).not.toHaveBeenCalled()
  })
})
