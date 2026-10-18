import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { compareVersions, currentVersion, getUpdateStatus, parseVersion, resetUpdateCheckForTests } from '../updateCheck'

function release(tag: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({
    tag_name: tag,
    html_url: `https://github.com/KadirKess/Soratra/releases/tag/${tag}`,
    draft: false,
    prerelease: false,
    ...extra,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  resetUpdateCheckForTests()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('SORATRA_VERSION', '1.1.0')
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('parseVersion', () => {
  it('reads plain releases with or without a leading v', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 })
    expect(parseVersion('v10.0.12')).toEqual({ major: 10, minor: 0, patch: 12 })
  })

  it('ignores prereleases, build tags and partial versions', () => {
    for (const value of ['1.2.0-rc.1', '1.2.0+build', 'dev', 'ci', 'local', '1', '1.2', '01.2.3', '', undefined, null]) {
      expect(parseVersion(value)).toBeNull()
    }
  })
})

describe('compareVersions', () => {
  const v = (value: string) => parseVersion(value)!

  it('orders by major, then minor, then patch', () => {
    expect(compareVersions(v('2.0.0'), v('1.9.9'))).toBeGreaterThan(0)
    expect(compareVersions(v('1.10.0'), v('1.9.0'))).toBeGreaterThan(0)
    expect(compareVersions(v('1.1.2'), v('1.1.10'))).toBeLessThan(0)
    expect(compareVersions(v('1.1.0'), v('v1.1.0'))).toBe(0)
  })
})

describe('currentVersion', () => {
  it('is null for images not built from a release', () => {
    for (const value of ['dev', 'ci', 'local', '', '1.2.0-rc.1']) {
      vi.stubEnv('SORATRA_VERSION', value)
      expect(currentVersion()).toBeNull()
    }
    vi.stubEnv('SORATRA_VERSION', undefined)
    expect(currentVersion()).toBeNull()
  })
})

describe('getUpdateStatus', () => {
  it('reports a newer minor release with its notes link', async () => {
    fetchMock.mockResolvedValue(release('v1.2.0'))
    await expect(getUpdateStatus({ enabled: true, fetch: true })).resolves.toEqual({
      current: '1.1.0',
      latest: { version: '1.2.0', url: 'https://github.com/KadirKess/Soratra/releases/tag/v1.2.0' },
      updateAvailable: true,
      majorUpdate: false,
    })
  })

  it('flags a new major version', async () => {
    fetchMock.mockResolvedValue(release('v2.0.0'))
    const status = await getUpdateStatus({ enabled: true, fetch: true })
    expect(status).toMatchObject({ updateAvailable: true, majorUpdate: true })
  })

  it('reports nothing when the running release is current or newer', async () => {
    fetchMock.mockResolvedValue(release('v1.1.0'))
    await expect(getUpdateStatus({ enabled: true, fetch: true })).resolves.toMatchObject({ updateAvailable: false, latest: null })
    resetUpdateCheckForTests()
    fetchMock.mockResolvedValue(release('v1.0.9'))
    await expect(getUpdateStatus({ enabled: true, fetch: true })).resolves.toMatchObject({ updateAvailable: false })
  })

  it('ignores prereleases, drafts and links outside the project', async () => {
    for (const response of [
      release('v1.2.0-rc.1'),
      release('v1.2.0', { prerelease: true }),
      release('v1.2.0', { draft: true }),
      release('v1.2.0', { html_url: 'https://example.org/v1.2.0' }),
    ]) {
      resetUpdateCheckForTests()
      fetchMock.mockResolvedValueOnce(response)
      await expect(getUpdateStatus({ enabled: true, fetch: true })).resolves.toMatchObject({ updateAvailable: false })
    }
  })

  it('sends no identifiers, only a User-Agent with the version, and a timeout', async () => {
    fetchMock.mockResolvedValue(release('v1.2.0'))
    await getUpdateStatus({ enabled: true, fetch: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.github.com/repos/KadirKess/Soratra/releases/latest')
    expect(init?.headers).toEqual({
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Soratra/1.1.0',
      'X-GitHub-Api-Version': '2022-11-28',
    })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('checks at most once a day', async () => {
    fetchMock.mockResolvedValue(release('v1.2.0'))
    await getUpdateStatus({ enabled: true, fetch: true })
    vi.setSystemTime(new Date('2026-10-19T11:59:00Z'))
    await getUpdateStatus({ enabled: true, fetch: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date('2026-10-19T12:00:01Z'))
    await getUpdateStatus({ enabled: true, fetch: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shares one request between concurrent page loads', async () => {
    fetchMock.mockResolvedValue(release('v1.2.0'))
    await Promise.all([getUpdateStatus({ enabled: true, fetch: true }), getUpdateStatus({ enabled: true, fetch: true })])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('only reads the cache when fetching is not allowed', async () => {
    await expect(getUpdateStatus({ enabled: true, fetch: false })).resolves.toMatchObject({ updateAvailable: false })
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockResolvedValue(release('v1.2.0'))
    await getUpdateStatus({ enabled: true, fetch: true })
    await expect(getUpdateStatus({ enabled: true, fetch: false })).resolves.toMatchObject({ updateAvailable: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('makes no request when turned off or on a non-release build', async () => {
    await expect(getUpdateStatus({ enabled: false, fetch: true })).resolves.toMatchObject({ current: '1.1.0', updateAvailable: false })
    for (const value of ['dev', 'ci']) {
      vi.stubEnv('SORATRA_VERSION', value)
      await expect(getUpdateStatus({ enabled: true, fetch: true })).resolves.toMatchObject({ current: null, updateAvailable: false })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('hides a cached update once the check is turned off', async () => {
    fetchMock.mockResolvedValue(release('v1.2.0'))
    await getUpdateStatus({ enabled: true, fetch: true })
    await expect(getUpdateStatus({ enabled: false, fetch: false })).resolves.toMatchObject({ updateAvailable: false })
  })

  it('treats a repository without releases as up to date', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }))
    await expect(getUpdateStatus({ enabled: true, fetch: true })).resolves.toMatchObject({ updateAvailable: false })
    expect(console.error).not.toHaveBeenCalled()
  })

  it('fails quietly with one log line, and waits a day before trying again', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'))
    await expect(getUpdateStatus({ enabled: true, fetch: true })).resolves.toMatchObject({ updateAvailable: false })
    fetchMock.mockResolvedValue(new Response('rate limited', { status: 403 }))
    await getUpdateStatus({ enabled: true, fetch: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(console.error).mock.calls[0][0])).toContain('update_check_failed')

    vi.setSystemTime(new Date('2026-10-19T12:00:01Z'))
    await expect(getUpdateStatus({ enabled: true, fetch: true })).resolves.toMatchObject({ updateAvailable: false })
    expect(console.error).toHaveBeenCalledTimes(2)
  })

  it('survives a malformed response', async () => {
    fetchMock.mockResolvedValue(new Response('{"unexpected":true}', { status: 200 }))
    await expect(getUpdateStatus({ enabled: true, fetch: true })).resolves.toMatchObject({ updateAvailable: false })
    expect(console.error).toHaveBeenCalledTimes(1)
  })
})
