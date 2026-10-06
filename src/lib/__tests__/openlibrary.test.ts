import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { getWorkByOlid, resolveWorkTitle, searchWorks } from '../openlibrary'

afterEach(() => vi.restoreAllMocks())
let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  logSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
})

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response
}

describe('searchWorks', () => {
  it('maps valid documents and ignores malformed ones', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(response({ docs: [
      { key: '/works/OL1W', title: 'The Great Gatsby', author_name: ['F. Scott Fitzgerald'], first_publish_year: 1925 },
      { key: 42 },
    ] }))
    await expect(searchWorks('gatsby')).resolves.toEqual([expect.objectContaining({
      openLibraryId: 'OL1W', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publishedDate: '1925',
    })])
  })

  it('prefers an edition title in the reader language and sends that preference to Open Library', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(response({ docs: [{
      key: '/works/OL1W',
      title: 'Преступление и наказание',
      editions: { docs: [
        { title: 'Crime et Châtiment', language: ['fre'] },
        { title: 'Crime and Punishment', language: ['eng'] },
      ] },
    }] }))

    await expect(searchWorks('crime', 'fr')).resolves.toEqual([expect.objectContaining({
      title: 'Crime et Châtiment',
      originalTitle: 'Преступление и наказание',
      displayTitleLanguage: 'fr',
    })])

    const [url] = fetchMock.mock.calls[0]
    expect(new URL(String(url)).searchParams.get('lang')).toBe('fr')
  })

  it('falls back to an English edition title when the reader language is unavailable', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(response({ docs: [{
      key: '/works/OL1W',
      title: 'Преступление и наказание',
      editions: { docs: [{ title: 'Crime and Punishment', language: ['eng'] }] },
    }] }))

    await expect(searchWorks('crime', 'fr')).resolves.toEqual([expect.objectContaining({
      title: 'Crime and Punishment',
      originalTitle: 'Преступление и наказание',
      displayTitleLanguage: 'en',
    })])
  })

  it('resolves a cached work by its exact Open Library work key', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(response({ docs: [{
      key: '/works/OL1W',
      title: 'Преступление и наказание',
      editions: { docs: [{ title: 'Crime et Châtiment', language: ['fre'] }] },
    }] }))

    await expect(resolveWorkTitle('OL1W', 'fr')).resolves.toEqual(expect.objectContaining({
      openLibraryId: 'OL1W',
      title: 'Crime et Châtiment',
    }))

    const [url] = fetchMock.mock.calls[0]
    expect(new URL(String(url)).searchParams.get('q')).toBe('key:/works/OL1W')
  })

  it('returns an empty list for an unavailable client response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(response({}, false, 404))
    await expect(searchWorks('missing')).resolves.toEqual([])
  })

  it('identifies and records catalog searches without logging the query', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(response({ docs: [] }))

    await searchWorks('private search text')

    const [, init] = fetchMock.mock.calls[0]
    expect(new Headers(init?.headers).get('User-Agent')).toMatch(/^Soratra \(.+\)$/)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"operation":"search"'))
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('private search text'))
  })
})

describe('getWorkByOlid', () => {
  it('maps a work and author response deterministically', async () => {
    const fetchMock = vi.spyOn(global, 'fetch')
    fetchMock.mockResolvedValueOnce(response({
      key: '/works/OL45804W', title: 'The Great Gatsby', first_publish_date: 'April 10, 1925', covers: [123],
      authors: [{ author: { key: '/authors/OL1A' } }], subjects: ['Fiction'],
    }))
    fetchMock.mockResolvedValueOnce(response({ name: 'F. Scott Fitzgerald' }))
    fetchMock.mockResolvedValueOnce(response({ docs: [] }))
    await expect(getWorkByOlid('OL45804W')).resolves.toEqual(expect.objectContaining({
      openLibraryId: 'OL45804W', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publishedDate: '1925',
    }))
  })

  it('keeps every alternative title Open Library includes on the work', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(response({
      key: '/works/OL45804W',
      title: 'Преступление и наказание',
      other_titles: ['Crime and Punishment'],
      translated_titles: [{ text: 'Crime et Châtiment' }],
      authors: [],
    }))

    await expect(getWorkByOlid('OL45804W')).resolves.toEqual(expect.objectContaining({
      alternativeTitles: ['Crime and Punishment', 'Crime et Châtiment'],
    }))
  })

  it('falls back to the work search result when the work omits alternative titles', async () => {
    const fetchMock = vi.spyOn(global, 'fetch')
    fetchMock
      .mockResolvedValueOnce(response({
        key: '/works/OL45804W', title: 'Преступление и наказание', authors: [],
      }))
      .mockResolvedValueOnce(response({ docs: [{
        key: '/works/OL45804W', title: 'Преступление и наказание',
        alternative_title: ['Crime and Punishment', 'Crime et Châtiment'],
      }] }))

    await expect(getWorkByOlid('OL45804W')).resolves.toEqual(expect.objectContaining({
      alternativeTitles: ['Crime and Punishment', 'Crime et Châtiment'],
    }))

    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('q')).toBe('key:OL45804W')
  })

  it('returns null when Open Library has no work', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(response({}, false, 404))
    await expect(getWorkByOlid('OL00000000INVALID')).resolves.toBeNull()
  })

  it('records an edition lookup and its fallback work lookup separately', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(response({
        key: '/books/OL1M', title: 'Edition title', works: [{ key: '/works/OL1W' }],
      }))
      .mockResolvedValueOnce(response({
        key: '/works/OL1W', description: 'Work description', subjects: ['Fiction'],
      }))

    await getWorkByOlid('OL1M')

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"operation":"edition"'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"operation":"work"'))
  })
})
