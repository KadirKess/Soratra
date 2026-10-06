import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { purge } = vi.hoisted(() => ({ purge: vi.fn() }))
vi.mock('@/server/cron/purgeDeletedUsers', () => ({ purgeDeletedUsers: purge }))
import { GET } from '../route'

function request(authorization?: string) {
  return new Request('http://localhost/api/cron/purge-deleted-users', {
    headers: authorization ? { authorization } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'synthetic-cron-secret')
})
afterEach(() => vi.unstubAllEnvs())

describe('purge endpoint authorization and result', () => {
  it.each([undefined, 'Bearer wrong-secret', 'Basic synthetic-cron-secret'])('rejects missing or incorrect authentication', async (authorization) => {
    expect((await GET(request(authorization))).status).toBe(401)
    expect(purge).not.toHaveBeenCalled()
  })

  it('rejects an unconfigured secret even if the caller sends an empty bearer value', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await GET(request('Bearer '))).status).toBe(401)
    expect(purge).not.toHaveBeenCalled()
  })

  it('returns aggregate cleanup counts after authorized execution', async () => {
    purge.mockResolvedValue({ users: 2, rateLimitBuckets: 3 })
    const response = await GET(request('Bearer synthetic-cron-secret'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ purged: 2, expiredRateLimitBuckets: 3 })
  })

  it('returns a bounded error without disclosing database details', async () => {
    purge.mockRejectedValue(new Error('database failure with private details'))
    const response = await GET(request('Bearer synthetic-cron-secret'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Purge failed' })
  })
})
