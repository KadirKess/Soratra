import { auth } from '@/server/auth'
import { db, users } from '@/server/db'
import { and, eq, isNull } from 'drizzle-orm'

export async function createContext() {
  const authStartedAt = performance.now()
  const session = await auth()
  const authMs = Math.round(performance.now() - authStartedAt)

  const activeUserStartedAt = performance.now()
  const activeUser = session?.user?.id
    ? await db.query.users.findFirst({
      where: and(eq(users.id, session.user.id), isNull(users.deletedAt)),
    })
    : null
  const activeUserMs = Math.round(performance.now() - activeUserStartedAt)

  return { session, activeUser, db, timing: { authMs, activeUserMs } }
}

export type Context = Awaited<ReturnType<typeof createContext>>
