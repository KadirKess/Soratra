import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { searchWorks, getWorkByOlid, OpenLibraryError, OpenLibraryUnavailableError } from '../openlibrary'

const realFetch = global.fetch

afterEach(() => {
  global.fetch = realFetch
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => undefined))

function mockFetch(impl: () => Promise<Response>) {
  global.fetch = vi.fn(impl) as unknown as typeof fetch
}

describe('searchWorks error handling', () => {
  it('fails without a network request when outage simulation is enabled', async () => {
    vi.stubEnv('OPEN_LIBRARY_OUTAGE_SIMULATION', 'true')
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    await expect(searchWorks('dune')).rejects.toBeInstanceOf(OpenLibraryError)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('throws OpenLibraryError when the request fails (timeout/network)', async () => {
    mockFetch(() => Promise.reject(new DOMException('timed out', 'TimeoutError')))
    await expect(searchWorks('dune')).rejects.toBeInstanceOf(OpenLibraryError)
  })

  it('throws OpenLibraryError on a 5xx from Open Library', async () => {
    mockFetch(() => Promise.resolve(new Response('', { status: 503 })))
    await expect(searchWorks('dune')).rejects.toBeInstanceOf(OpenLibraryError)
  })

  it('returns an empty list on a 4xx (not an error state)', async () => {
    mockFetch(() => Promise.resolve(new Response('', { status: 404 })))
    await expect(searchWorks('dune')).resolves.toEqual([])
  })

  it('returns an empty list when OL responds 200 with no docs', async () => {
    mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ docs: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    await expect(searchWorks('zzzznotarealbook')).resolves.toEqual([])
  })

  it('maps docs to OLWork on success', async () => {
    mockFetch(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            docs: [{ key: '/works/OL1W', title: 'Dune', author_name: ['Frank Herbert'] }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
    const out = await searchWorks('dune')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ openLibraryId: 'OL1W', title: 'Dune', authors: ['Frank Herbert'] })
  })
})

describe('getWorkByOlid error handling', () => {
  it('distinguishes a temporary detail outage from a missing work', async () => {
    mockFetch(() => Promise.reject(new TypeError('network unavailable')))
    await expect(getWorkByOlid('OL1W')).rejects.toBeInstanceOf(OpenLibraryUnavailableError)
  })
})
