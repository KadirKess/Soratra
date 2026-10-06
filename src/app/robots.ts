import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/books/',
        '/forgot-password',
        '/friends',
        '/journal',
        '/library',
        '/profile',
        '/reset-password',
        '/search',
        '/signin',
        '/signup',
      ],
    },
    sitemap: new URL('/sitemap.xml', siteConfig.siteUrl).toString(),
  }
}
