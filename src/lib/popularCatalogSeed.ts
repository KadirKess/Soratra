import { z } from 'zod'

export const POPULAR_CATALOG_SOURCES = ['global-trending', 'french-trending'] as const
export type PopularCatalogSource = (typeof POPULAR_CATALOG_SOURCES)[number]

const searchDocSchema = z.object({
  key: z.string(),
  title: z.string().min(1),
  author_name: z.array(z.string()).optional(),
  alternative_title: z.array(z.string()).optional(),
  cover_i: z.number().int().positive().optional(),
  first_publish_year: z.number().int().optional(),
})

const workKeySchema = z.string().regex(/^\/works\/(OL\d+W)$/)

export interface PopularCatalogBook {
  openLibraryId: string
  title: string
  authors: string[]
  alternativeTitles: string[]
  coverUrl: string | null
  publishedDate: string | null
}

export function buildPopularCatalogSearchUrl(source: PopularCatalogSource, page: number, limit: number) {
  const params = new URLSearchParams({
    q: source === 'global-trending'
      ? 'trending_score_hourly_sum:[1 TO *]'
      : 'language:fre AND trending_score_hourly_sum:[1 TO *]',
    sort: 'trending',
    fields: 'key,title,author_name,alternative_title,cover_i,first_publish_year',
    page: String(page),
    limit: String(limit),
  })

  if (source === 'french-trending') params.set('lang', 'fr')

  return `https://openlibrary.org/search.json?${params}`
}

export function extractPopularCatalogWorks(docs: unknown[]): PopularCatalogBook[] {
  const works = new Map<string, PopularCatalogBook>()

  for (const raw of docs) {
    const doc = searchDocSchema.safeParse(raw)
    if (!doc.success) continue

    const workKey = workKeySchema.safeParse(doc.data.key)
    if (!workKey.success) continue

    const openLibraryId = workKey.data.match(/^\/works\/(OL\d+W)$/)?.[1]
    if (!openLibraryId || works.has(openLibraryId)) continue

    works.set(openLibraryId, {
      openLibraryId,
      title: doc.data.title,
      authors: doc.data.author_name ?? [],
      alternativeTitles: doc.data.alternative_title ?? [],
      coverUrl: doc.data.cover_i ? `https://covers.openlibrary.org/b/id/${doc.data.cover_i}-L.jpg` : null,
      publishedDate: doc.data.first_publish_year != null ? String(doc.data.first_publish_year) : null,
    })
  }

  return [...works.values()]
}
