import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logClientMetric } from '@/lib/observability'
import { readJsonBody } from '@/lib/requestBody'
import { metricPaths } from '@/lib/metricPath'
import { getClientIp, rateLimit, rateLimitKey } from '@/lib/rateLimit'

const metricSchema = z.object({
  name: z.enum(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']),
  value: z.number().finite().nonnegative(),
  path: z.enum(metricPaths),
})

export async function POST(request: Request) {
  try {
    const limit = await rateLimit(rateLimitKey('metrics:ip', getClientIp(request)), 120, 60_000)
    if (!limit.ok) return new NextResponse(null, { status: 204 })
    const data = metricSchema.parse(await readJsonBody(request, 2_048))
    logClientMetric(data)
  } catch {
    return new NextResponse(null, { status: 204 })
  }
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
