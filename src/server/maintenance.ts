import 'server-only'
import { and, isNotNull, isNull, lt, or } from 'drizzle-orm'
import { db, invites, passwordResetTokens, rateLimitBuckets, users } from '@/server/db'

const DAY_MS = 24 * 60 * 60_000
const RETRY_MS = 5 * 60_000

export async function runMaintenance() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS)
  const [deleted, expiredBuckets] = await Promise.all([
    db.delete(users)
      .where(and(isNotNull(users.deletedAt), lt(users.deletedAt, thirtyDaysAgo)))
      .returning({ id: users.id }),
    db.delete(rateLimitBuckets)
      .where(lt(rateLimitBuckets.resetAt, now))
      .returning({ key: rateLimitBuckets.key }),
    db.delete(passwordResetTokens)
      .where(or(lt(passwordResetTokens.expiresAt, now), isNotNull(passwordResetTokens.usedAt))),
    // Used invites are kept a while so the admin can see who joined through them.
    db.delete(invites)
      .where(or(and(isNull(invites.usedAt), lt(invites.expiresAt, now)), lt(invites.usedAt, thirtyDaysAgo))),
  ])
  return { users: deleted.length, rateLimitBuckets: expiredBuckets.length }
}

let started = false

// Runs once at startup, then daily; a failed run retries after five minutes.
export function startMaintenanceLoop() {
  if (started) return
  started = true
  const tick = async () => {
    let delay = DAY_MS
    try {
      const result = await runMaintenance()
      console.info(JSON.stringify({ event: 'scheduled_purge', users: result.users, rateLimitBuckets: result.rateLimitBuckets }))
    } catch {
      console.error('Scheduled cleanup failed; retrying in five minutes.')
      delay = RETRY_MS
    }
    setTimeout(tick, delay).unref()
  }
  void tick()
}
