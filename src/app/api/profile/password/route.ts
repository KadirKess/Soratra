import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { auth } from '@/server/auth'
import { db, passwordResetTokens, users } from '@/server/db'
import { readJsonBody } from '@/lib/requestBody'
import { isSupportedPassword } from '@/server/password'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  let body: unknown
  try {
    body = await readJsonBody(req, 8_192)
  } catch {
    return NextResponse.json({ error: 'Invalid input.' }, { status: 400 })
  }
  const currentPassword = typeof body === 'object' && body && 'currentPassword' in body && typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const password = typeof body === 'object' && body && 'password' in body && typeof body.password === 'string' ? body.password : ''
  if (!isSupportedPassword(currentPassword) || !isSupportedPassword(password)) {
    return NextResponse.json({ error: 'Use a password between 8 and 72 bytes.' }, { status: 400 })
  }
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, session.user.id), isNull(users.deletedAt)),
  })
  if (!user?.passwordHash || user.authVersion !== session.user.authVersion || !await bcrypt.compare(currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })
  }
  const passwordHash = await bcrypt.hash(password, 12)
  await db.transaction(async (tx) => {
    await tx.update(users)
      .set({ passwordHash, authVersion: sql`${users.authVersion} + 1`, updatedAt: new Date() })
      .where(eq(users.id, user.id))
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id))
  })
  return NextResponse.json({ ok: true })
}
