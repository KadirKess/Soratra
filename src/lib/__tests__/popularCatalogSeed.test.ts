import { describe, expect, it } from 'vitest'
import { buildPopularCatalogSearchUrl, extractPopularCatalogWorks } from '../popularCatalogSeed'

describe('popular catalog seed', () => {
  it('builds a constrained work-search request', () => {
    const url = new URL(buildPopularCatalogSearchUrl('french-trending', 2, 50))

    expect(url.searchParams.get('q')).toBe('language:fre AND trending_score_hourly_sum:[1 TO *]')
    expect(url.searchParams.get('sort')).toBe('trending')
    expect(url.searchParams.get('lang')).toBe('fr')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('limit')).toBe('50')
    expect(url.searchParams.get('fields')).toBe('key,title,author_name,alternative_title,cover_i,first_publish_year')
  })

  it('accepts only unique work records', () => {
    const works = extractPopularCatalogWorks([
      { key: '/works/OL1W', title: 'First work', author_name: ['One'], cover_i: 10, first_publish_year: 1999 },
      { key: '/books/OL2M', title: 'An edition', author_name: ['Two'] },
      { key: '/works/OL1W', title: 'Duplicate work', author_name: ['Three'] },
      { key: '/works/not-a-work-id', title: 'Malformed work' },
      { key: '/works/OL3W' },
    ])

    expect(works).toEqual([
      {
        openLibraryId: 'OL1W',
        title: 'First work',
        authors: ['One'],
        alternativeTitles: [],
        coverUrl: 'https://covers.openlibrary.org/b/id/10-L.jpg',
        publishedDate: '1999',
      },
    ])
  })
})
