import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { GET } from '../route'

afterEach(() => vi.unstubAllEnvs())

describe('instance security contact', () => {
  it('does not advertise an expired or unconfigured reporting channel', () => {
    vi.stubEnv('SECURITY_EXPIRES', '')
    expect(GET().status).toBe(404)
    vi.stubEnv('SECURITY_EXPIRES', '2020-01-01T00:00:00Z')
    expect(GET().status).toBe(404)
  })

  it('uses a host-owned contact and future expiry', async () => {
    vi.stubEnv('SECURITY_EXPIRES', new Date(Date.now() + 86_400_000).toISOString())
    vi.stubEnv('SECURITY_CONTACT', 'mailto:security@instance.test')
    const response = GET()
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Contact: mailto:security@instance.test')
  })

  it('falls back to the runtime support address when the optional contact is blank', async () => {
    vi.stubEnv('SECURITY_EXPIRES', new Date(Date.now() + 86_400_000).toISOString())
    vi.stubEnv('SECURITY_CONTACT', '')
    vi.stubEnv('SUPPORT_EMAIL', 'support@instance.test')
    const response = GET()
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Contact: mailto:support@instance.test')
  })

  it('rejects multiline contacts', () => {
    vi.stubEnv('SECURITY_EXPIRES', new Date(Date.now() + 86_400_000).toISOString())
    vi.stubEnv('SECURITY_CONTACT', 'mailto:security@instance.test\nInjected: value')
    expect(GET().status).toBe(404)
  })
})
