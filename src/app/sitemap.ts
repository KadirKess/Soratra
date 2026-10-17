import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL('/privacy', siteConfig.siteUrl).toString(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: new URL('/terms', siteConfig.siteUrl).toString(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: new URL('/support', siteConfig.siteUrl).toString(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ]
}
