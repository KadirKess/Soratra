import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { getInstance } = vi.hoisted(() => ({ getInstance: vi.fn() }))
vi.mock('@/server/instance', async () => ({
  ...await vi.importActual<typeof import('@/server/instance')>('@/server/instance'),
  getInstance,
}))
vi.mock('@/server/db', () => ({ db: {}, instanceSettings: {}, users: {} }))
import { GET } from '../route'

beforeEach(() => getInstance.mockResolvedValue({ contact: null }))
afterEach(() => vi.unstubAllEnvs())

describe('instance security contact', () => {
  it('does not advertise an expired or unconfigured reporting channel', async () => {
    vi.stubEnv('SECURITY_CONTACT', 'mailto:security@instance.test')
    vi.stubEnv('SECURITY_EXPIRES', '')
    expect((await GET()).status).toBe(404)
    vi.stubEnv('SECURITY_EXPIRES', '2020-01-01T00:00:00Z')
    expect((await GET()).status).toBe(404)
  })

  it('uses a host-owned contact and future expiry', async () => {
    vi.stubEnv('SECURITY_EXPIRES', new Date(Date.now() + 86_400_000).toISOString())
    vi.stubEnv('SECURITY_CONTACT', 'mailto:security@instance.test')
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Contact: mailto:security@instance.test')
  })

  it('falls back to the contact the admin set when it is an email or link', async () => {
    vi.stubEnv('SECURITY_EXPIRES', new Date(Date.now() + 86_400_000).toISOString())
    vi.stubEnv('SECURITY_CONTACT', '')
    getInstance.mockResolvedValue({ contact: 'support@instance.test' })
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Contact: mailto:support@instance.test')
    getInstance.mockResolvedValue({ contact: 'Message me on Signal' })
    expect((await GET()).status).toBe(404)
  })

  it('rejects multiline contacts', async () => {
    vi.stubEnv('SECURITY_EXPIRES', new Date(Date.now() + 86_400_000).toISOString())
    vi.stubEnv('SECURITY_CONTACT', 'mailto:security@instance.test\nInjected: value')
    expect((await GET()).status).toBe(404)
  })
})
