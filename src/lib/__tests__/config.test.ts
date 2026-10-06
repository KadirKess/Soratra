import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { assertProductionConfiguration, getSourceCodeUrl, siteConfig } from '../config'

beforeEach(() => {
  for (const [name, value] of Object.entries({
    NODE_ENV: 'production', DEPLOYMENT_MODE: 'local', EMAIL_MODE: 'disabled',
    SITE_URL: 'http://localhost:3000', AUTH_URL: 'http://localhost:3000',
    POSTGRES_URL: 'postgres://db/soratra', AUTH_SECRET: 'test-auth', CRON_SECRET: 'test-cron',
    TRUSTED_PROXY_IP_HEADER: '', SECURITY_CONTACT: '', SECURITY_EXPIRES: '', SOURCE_CODE_URL: '',
  })) vi.stubEnv(name, value)
})
afterEach(() => vi.unstubAllEnvs())

describe('instance configuration', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])('allows explicit local mode at %s without email delivery', (host) => {
    vi.stubEnv('SITE_URL', `http://${host}:3000`)
    vi.stubEnv('AUTH_URL', `http://${host}:3000`)
    expect(assertProductionConfiguration).not.toThrow()
  })

  it.each(['http://192.168.1.1:3000', 'http://localhost.evil.test:3000', 'http://0.0.0.0:3000'])('rejects non-loopback local origins %s', (origin) => {
    vi.stubEnv('SITE_URL', origin)
    vi.stubEnv('AUTH_URL', origin)
    expect(assertProductionConfiguration).toThrow('loopback')
  })

  it('rejects mismatched authentication and site origins', () => {
    vi.stubEnv('AUTH_URL', 'http://localhost:3001')
    expect(assertProductionConfiguration).toThrow('same origin')
  })

  it('requires HTTPS and email for a public deployment', () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'public')
    expect(assertProductionConfiguration).toThrow('HTTPS')
    vi.stubEnv('SITE_URL', 'https://books.test')
    vi.stubEnv('AUTH_URL', 'https://books.test')
    vi.stubEnv('SUPPORT_EMAIL', 'operator@books.test')
    vi.stubEnv('LEGAL_NAME', 'Test host')
    expect(assertProductionConfiguration).toThrow('Resend')
    vi.stubEnv('EMAIL_MODE', 'resend')
    vi.stubEnv('RESEND_API_KEY', 'test-api-key')
    vi.stubEnv('EMAIL_FROM', 'noreply@books.test')
    expect(assertProductionConfiguration).not.toThrow()
  })

  it('reads instance fields at runtime rather than capturing build values', () => {
    vi.stubEnv('SITE_URL', 'https://first.test')
    vi.stubEnv('SUPPORT_EMAIL', 'support@first.test')
    expect(siteConfig.siteUrl).toBe('https://first.test')
    vi.stubEnv('SITE_URL', 'https://second.test')
    vi.stubEnv('SUPPORT_EMAIL', 'support@second.test')
    expect(siteConfig.siteUrl).toBe('https://second.test')
    expect(siteConfig.supportEmail).toBe('support@second.test')
  })

  it('uses local display defaults for blank optional instance fields', () => {
    vi.stubEnv('SUPPORT_EMAIL', ' ')
    vi.stubEnv('LEGAL_NAME', '')
    vi.stubEnv('EMAIL_FROM', '')
    expect(siteConfig.supportEmail).toBe('support@example.com')
    expect(siteConfig.legalName).toBe('Local instance operator')
    expect(siteConfig.emailFrom).toBe('noreply@example.com')
    vi.stubEnv('DEPLOYMENT_MODE', 'public')
    vi.stubEnv('SITE_URL', 'https://books.test')
    vi.stubEnv('AUTH_URL', 'https://books.test')
    expect(assertProductionConfiguration).toThrow('SUPPORT_EMAIL')
  })

  it('uses the bundled source archive by default and reads overrides at runtime', () => {
    expect(getSourceCodeUrl()).toBe('/source.tar.gz')
    vi.stubEnv('SOURCE_CODE_URL', 'https://source.instance.test/release')
    expect(getSourceCodeUrl()).toBe('https://source.instance.test/release')
    expect(assertProductionConfiguration).not.toThrow()
  })

  it.each(['http://source.instance.test', 'https://user:secret@source.instance.test', 'not a URL'])('rejects an unsafe source URL at startup: %s', (value) => {
    vi.stubEnv('SOURCE_CODE_URL', value)
    expect(assertProductionConfiguration).toThrow('SOURCE_CODE_URL')
  })

  it('rejects a forwarding-chain header as the trusted IP source', () => {
    vi.stubEnv('TRUSTED_PROXY_IP_HEADER', 'x-forwarded-for')
    expect(assertProductionConfiguration).toThrow('single-address')
  })
})
