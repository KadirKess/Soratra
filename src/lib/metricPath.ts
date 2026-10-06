const staticPaths = new Set([
  '/', '/library', '/journal', '/friends', '/profile', '/search', '/signin', '/signup',
  '/forgot-password', '/reset-password', '/privacy', '/terms', '/support',
])

export const metricPaths = [
  ...staticPaths,
  '/books/[id]',
  '/profile/[username]',
  '/other',
] as const

export function normalizeMetricPath(pathname: string) {
  if (pathname.startsWith('/books/')) return '/books/[id]'
  if (pathname.startsWith('/profile/')) return '/profile/[username]'
  return staticPaths.has(pathname) ? pathname : '/other'
}
