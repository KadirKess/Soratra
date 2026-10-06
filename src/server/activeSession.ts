import 'server-only'
import { cache } from 'react'
import { and, eq, isNull } from 'drizzle-orm'
import { auth } from './auth'
import { db, users } from './db'

export const getActiveSession = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) return null
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, session.user.id), isNull(users.deletedAt)),
    columns: { authVersion: true },
  })
  return user && user.authVersion === session.user.authVersion ? session : null
})
