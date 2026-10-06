import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { db, passwordResetTokens, users } from '@/server/db'
import { getClientIp, rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { readJsonBody } from '@/lib/requestBody'
import { isSupportedPassword } from '@/server/password'

const MAX_TOKEN_LENGTH = 128

export async function POST(req: Request) {
  const limit = await rateLimit(rateLimitKey('password-reset-confirm:ip', getClientIp(req)), 10, 15 * 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  let body: unknown
  try {
    body = await readJsonBody(req, 4_096)
  } catch {
    return NextResponse.json({ error: 'Invalid reset request.' }, { status: 400 })
  }
  const token = typeof body === 'object' && body && 'token' in body && typeof body.token === 'string' ? body.token : ''
  const password = typeof body === 'object' && body && 'password' in body && typeof body.password === 'string' ? body.password : ''
  if (token.length < 40 || token.length > MAX_TOKEN_LENGTH || !isSupportedPassword(password)) {
    return NextResponse.json({ error: 'This reset link is invalid or expired.' }, { status: 400 })
  }

  const tokenHash = createHash('sha256').update(token).digest('hex')
  const result = await db.transaction(async (tx) => {
    const [reset] = await tx.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
    ))
      .returning({ userId: passwordResetTokens.userId })
    if (!reset) return false

    const passwordHash = await bcrypt.hash(password, 12)
    const [user] = await tx.update(users)
      .set({ passwordHash, authVersion: sql`${users.authVersion} + 1`, updatedAt: new Date() })
      .where(and(eq(users.id, reset.userId), isNull(users.deletedAt)))
      .returning({ id: users.id })
    if (user) {
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, reset.userId))
    }
    return Boolean(user)
  })
  if (!result) {
    return NextResponse.json({ error: 'This reset link is invalid or expired.' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
