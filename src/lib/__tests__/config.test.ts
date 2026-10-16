import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { assertConfiguration, getSourceCodeUrl, siteConfig } from '../config'

beforeEach(() => {
  for (const [name, value] of Object.entries({
    NODE_ENV: 'production', POSTGRES_URL: 'postgres://db/soratra', SITE_URL: '', SEARCH_INDEXING: '',
    TRUSTED_PROXY_IP_HEADER: '', SECURITY_CONTACT: '', SECURITY_EXPIRES: '', SOURCE_CODE_URL: '', POSTGRES_POOL_MAX: '',
  })) vi.stubEnv(name, value)
})
afterEach(() => vi.unstubAllEnvs())

describe('instance configuration', () => {
  it('starts with nothing but a database connection', () => {
    expect(assertConfiguration).not.toThrow()
  })

  it('explains a missing database connection', () => {
    vi.stubEnv('POSTGRES_URL', '')
    expect(assertConfiguration).toThrow('POSTGRES_URL')
  })

  it.each(['http://192.168.1.20:3000', 'https://books.example.org', 'http://reading.tailnet.ts.net'])('accepts any plain site address: %s', (origin) => {
    vi.stubEnv('SITE_URL', origin)
    expect(assertConfiguration).not.toThrow()
  })

  it.each(['books.example.org', 'https://books.example.org/soratra', 'https://user:secret@books.example.org', 'ftp://books.example.org'])('rejects a site address that is not a bare origin: %s', (origin) => {
    vi.stubEnv('SITE_URL', origin)
    expect(assertConfiguration).toThrow('SITE_URL')
  })

  it('reads instance fields at runtime rather than capturing build values', () => {
    vi.stubEnv('SITE_URL', 'https://first.test')
    expect(siteConfig.siteUrl).toBe('https://first.test')
    vi.stubEnv('SITE_URL', 'https://second.test')
    expect(siteConfig.siteUrl).toBe('https://second.test')
  })

  it('keeps search engines out unless indexing is switched on', () => {
    expect(siteConfig.searchIndexing).toBe(false)
    vi.stubEnv('SEARCH_INDEXING', 'TRUE')
    expect(siteConfig.searchIndexing).toBe(true)
  })

  it('uses the bundled source archive by default and reads overrides at runtime', () => {
    expect(getSourceCodeUrl()).toBe('/source.tar.gz')
    vi.stubEnv('SOURCE_CODE_URL', 'https://source.instance.test/release')
    expect(getSourceCodeUrl()).toBe('https://source.instance.test/release')
    expect(assertConfiguration).not.toThrow()
  })

  it.each(['http://source.instance.test', 'https://user:secret@source.instance.test', 'not a URL'])('rejects an unsafe source URL at startup: %s', (value) => {
    vi.stubEnv('SOURCE_CODE_URL', value)
    expect(assertConfiguration).toThrow('SOURCE_CODE_URL')
  })

  it('rejects a forwarding-chain header as the trusted IP source', () => {
    vi.stubEnv('TRUSTED_PROXY_IP_HEADER', 'x-forwarded-for')
    expect(assertConfiguration).toThrow('single-address')
  })

  it.each(['0', '21', 'five'])('rejects an out-of-range pool size: %s', (value) => {
    vi.stubEnv('POSTGRES_POOL_MAX', value)
    expect(assertConfiguration).toThrow('POSTGRES_POOL_MAX')
  })
})
