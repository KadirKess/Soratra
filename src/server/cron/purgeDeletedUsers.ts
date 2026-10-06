import { and, isNotNull, lt } from 'drizzle-orm'
import { db, rateLimitBuckets, users } from '@/server/db'

export async function purgeDeletedUsers() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [deleted, expiredBuckets] = await Promise.all([
    db
      .delete(users)
      .where(and(isNotNull(users.deletedAt), lt(users.deletedAt, thirtyDaysAgo)))
      .returning({ id: users.id }),
    db.delete(rateLimitBuckets)
      .where(lt(rateLimitBuckets.resetAt, new Date()))
      .returning({ key: rateLimitBuckets.key }),
  ])

  return { users: deleted.length, rateLimitBuckets: expiredBuckets.length }
}
