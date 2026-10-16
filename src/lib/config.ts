import 'server-only'

// Everything here is optional. Operator details live in the database and are
// edited from the admin page; see src/server/instance.ts.
export const siteConfig = {
  // Only used for absolute links in metadata and the sitemap. The app itself
  // answers on whatever address it is reached at.
  get siteUrl() { return process.env.SITE_URL?.trim() || 'http://localhost:3000' },
  get searchIndexing() { return process.env.SEARCH_INDEXING?.trim().toLowerCase() === 'true' },
}

export function getSourceCodeUrl() {
  const value = process.env.SOURCE_CODE_URL?.trim() || '/source.tar.gz'
  if (value === '/source.tar.gz') return value
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.username && !url.password) return value
  } catch {}
  throw new Error('SOURCE_CODE_URL must be an HTTPS URL without credentials.')
}

// Throws with a message meant for the person reading the container logs.
export function assertConfiguration() {
  if (process.env.NODE_ENV !== 'production') return
  if (!process.env.POSTGRES_URL?.trim()) throw new Error('POSTGRES_URL is not set, so Soratra cannot reach its database.')
  getSourceCodeUrl()

  const siteUrl = process.env.SITE_URL?.trim()
  if (siteUrl) {
    let site: URL
    try {
      site = new URL(siteUrl)
    } catch {
      throw new Error('SITE_URL must be a full address such as https://books.example.org.')
    }
    if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password ||
        site.pathname !== '/' || site.search || site.hash) {
      throw new Error('SITE_URL must be just an address such as https://books.example.org, without a path.')
    }
  }

  const header = process.env.TRUSTED_PROXY_IP_HEADER
  if (header && (!/^[a-z0-9-]+$/i.test(header) || header.toLowerCase() === 'x-forwarded-for')) {
    throw new Error('TRUSTED_PROXY_IP_HEADER must name a single-address header such as x-real-ip, not x-forwarded-for.')
  }

  const poolMax = process.env.POSTGRES_POOL_MAX
  if (poolMax && (!/^[1-9]\d*$/.test(poolMax) || Number(poolMax) > 20)) {
    throw new Error('POSTGRES_POOL_MAX must be a whole number between 1 and 20.')
  }

  if (process.env.SECURITY_EXPIRES && !Number.isFinite(Date.parse(process.env.SECURITY_EXPIRES))) {
    throw new Error('SECURITY_EXPIRES must be an ISO date such as 2027-09-30T00:00:00Z.')
  }
  if (process.env.SECURITY_CONTACT && !/^(mailto:[^\s]+@[^\s]+|https:\/\/[^\s]+)$/.test(process.env.SECURITY_CONTACT)) {
    throw new Error('SECURITY_CONTACT must be a mailto: or https:// link.')
  }
}
