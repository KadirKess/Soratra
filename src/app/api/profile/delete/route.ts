import { auth } from '@/server/auth'
import { db, friendships, passwordResetTokens, readingSessions, streakFreezes, userBooks, users } from '@/server/db'
import { and, eq, isNull, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { readJsonBody } from '@/lib/requestBody'

const MAX_PASSWORD_LENGTH = 256

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await readJsonBody(req, 8_192)
  } catch {
    return NextResponse.json({ error: 'Confirmation is required.' }, { status: 400 })
  }
  const confirmationEmail = typeof body === 'object' && body && 'email' in body && typeof body.email === 'string'
    ? body.email.trim().toLowerCase()
    : ''
  const currentPassword = typeof body === 'object' && body && 'currentPassword' in body && typeof body.currentPassword === 'string'
    ? body.currentPassword
    : ''

  const userId = session.user.id
  const activeUser = await db.query.users.findFirst({
    where: and(eq(users.id, userId), isNull(users.deletedAt)),
    columns: { id: true, authVersion: true, email: true, passwordHash: true },
  })
  if (!activeUser || activeUser.authVersion !== session.user.authVersion) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (confirmationEmail !== activeUser.email) {
    return NextResponse.json({ error: 'Confirmation does not match.' }, { status: 400 })
  }
  if (currentPassword.length > MAX_PASSWORD_LENGTH || !activeUser.passwordHash || !await bcrypt.compare(currentPassword, activeUser.passwordHash)) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })
  }

  await db.transaction(async (tx) => {
    const [deletedUser] = await tx.update(users)
      .set({
        email: `deleted-${userId}@deleted.invalid`,
        username: `deleted-${userId.slice(0, 8)}`,
        passwordHash: null,
        timezone: null,
        preferredLanguage: 'en',
        dataExportRequestedAt: null,
        isPro: 0,
        purchasedFreezes: 0,
        periodicFreezeUsed: 0,
        freezePeriodStart: null,
        weeklyFreezeUsed: 0,
        freezeWeekStart: null,
        authVersion: activeUser.authVersion + 1,
        activeDataVersion: 0,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({ id: users.id })
    if (!deletedUser) return

    await Promise.all([
      tx.delete(readingSessions).where(eq(readingSessions.userId, userId)),
      tx.delete(userBooks).where(eq(userBooks.userId, userId)),
      tx.delete(streakFreezes).where(eq(streakFreezes.userId, userId)),
      tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId)),
      tx.delete(friendships).where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId))),
    ])
  })

  const response = NextResponse.json({ ok: true })
  response.cookies.set('authjs.session-token', '', { expires: new Date(0), path: '/' })
  response.cookies.set('__Secure-authjs.session-token', '', { expires: new Date(0), path: '/', secure: true })
  return response
}
