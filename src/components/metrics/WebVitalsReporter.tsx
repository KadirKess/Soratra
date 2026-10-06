'use client'

import { useReportWebVitals } from 'next/web-vitals'
import { normalizeMetricPath } from '@/lib/metricPath'

const supportedNames = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB'])

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!supportedNames.has(metric.name)) return
    void fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: metric.name, value: metric.value, path: normalizeMetricPath(window.location.pathname) }),
      keepalive: true,
    })
  })
  return null
}
