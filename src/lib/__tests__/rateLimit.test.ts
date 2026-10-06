import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'

vi.mock('server-only', () => ({}))
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('@/server/db', () => ({ db: { execute } }))

import { getClientIp, rateLimit, rateLimitKey } from '../rateLimit'

afterEach(() => {
  vi.unstubAllEnvs()
  execute.mockReset()
})

describe('shared rate limiting helpers', () => {
  it('hashes rate-limit subjects instead of retaining raw account data', () => {
    const key = rateLimitKey('signin:email', 'Reader@Example.com')
    expect(key).toMatch(/^signin:email:[a-f0-9]{64}$/)
    expect(key).not.toContain('reader@example.com')
  })

  it('uses a configured single-address proxy header only', () => {
    vi.stubEnv('TRUSTED_PROXY_IP_HEADER', 'x-real-ip')
    const request = new Request('https://instance.test', {
      headers: { 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '198.51.100.4' },
    })
    expect(getClientIp(request)).toBe('203.0.113.9')
  })

  it('ignores spoofable headers when no proxy trust is configured', () => {
    vi.stubEnv('TRUSTED_PROXY_IP_HEADER', '')
    expect(getClientIp(new Request('http://localhost', { headers: { 'x-real-ip': '203.0.113.9' } }))).toBe('unknown')
  })

  it('rejects forwarding chains and malformed addresses', () => {
    vi.stubEnv('TRUSTED_PROXY_IP_HEADER', 'x-real-ip')
    for (const value of ['203.0.113.9, 198.51.100.1', 'spoofed']) {
      expect(getClientIp(new Request('http://localhost', { headers: { 'x-real-ip': value } }))).toBe('unknown')
    }
    vi.stubEnv('TRUSTED_PROXY_IP_HEADER', 'x-forwarded-for')
    expect(getClientIp(new Request('http://localhost', { headers: { 'x-forwarded-for': '203.0.113.9' } }))).toBe('unknown')
  })

  it('enforces a fixed window across database-backed requests', async () => {
    const key = `example:${randomUUID()}`
    execute
      .mockResolvedValueOnce([{ count: 1, resetAt: new Date(Date.now() + 60_000) }])
      .mockResolvedValueOnce([{ count: 2, resetAt: new Date(Date.now() + 60_000) }])
      .mockResolvedValueOnce([{ count: 3, resetAt: new Date(Date.now() + 60_000) }])
    await expect(rateLimit(key, 2, 60_000)).resolves.toEqual({ ok: true, retryAfter: 0 })
    await expect(rateLimit(key, 2, 60_000)).resolves.toEqual({ ok: true, retryAfter: 0 })
    const result = await rateLimit(key, 2, 60_000)
    expect(result.ok).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('bypasses limits only for explicit E2E runs', async () => {
    vi.stubEnv('E2E', 'true')

    await expect(rateLimit('example:e2e', 1, 60_000)).resolves.toEqual({ ok: true, retryAfter: 0 })
    expect(execute).not.toHaveBeenCalled()
  })
})
