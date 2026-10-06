import 'server-only'
import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { sql } from 'drizzle-orm'
import { db } from '@/server/db'

export interface RateLimitResult {
  ok: boolean
  retryAfter: number
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (process.env.E2E === 'true') return { ok: true, retryAfter: 0 }

  const now = Date.now()
  const resetAt = new Date(now + windowMs).toISOString()
  const [bucket] = await db.execute(sql<{ count: number; resetAt: Date }>`
    insert into rate_limit_buckets (key, count, reset_at, updated_at)
    values (${key}, 1, ${resetAt}::timestamptz, now())
    on conflict (key) do update set
      count = case
        when rate_limit_buckets.reset_at <= now() then 1
        else rate_limit_buckets.count + 1
      end,
      reset_at = case
        when rate_limit_buckets.reset_at <= now() then ${resetAt}::timestamptz
        else rate_limit_buckets.reset_at
      end,
      updated_at = now()
    returning count, reset_at as "resetAt"
  `)
  const count = Number(bucket?.count ?? limit + 1)
  const bucketResetAt = new Date(String(bucket?.resetAt ?? resetAt)).getTime()
  if (count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucketResetAt - now) / 1_000)) }
  }
  return { ok: true, retryAfter: 0 }
}

export function getClientIp(req: Request): string {
  const header = process.env.TRUSTED_PROXY_IP_HEADER
  if (!header || header.toLowerCase() === 'x-forwarded-for') return 'unknown'
  const address = req.headers.get(header)?.trim()
  return address && isIP(address) ? address : 'unknown'
}

export function rateLimitKey(scope: string, value: string) {
  const digest = createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
  return `${scope}:${digest}`
}
