import 'server-only'

type OpenLibraryOperation = 'search' | 'work' | 'edition' | 'author'

export function logRequestMetric(metric: {
  route: string
  status: 'ok' | 'error'
  durationMs: number
  responseBytes: number
  authMs?: number
  activeUserMs?: number
}) {
  console.info(JSON.stringify({ event: 'request_metric', ...metric }))
}

export function logExternalRequestMetric(metric: {
  service: 'open_library'
  operation: OpenLibraryOperation
  status: 'ok' | 'error'
  durationMs: number
  cacheTtlSeconds: number
}) {
  console.info(JSON.stringify({ event: 'external_request_metric', ...metric }))
}

export function logClientMetric(metric: {
  name: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB'
  value: number
  path: string
}) {
  console.info(JSON.stringify({ event: 'web_vital', ...metric }))
}
