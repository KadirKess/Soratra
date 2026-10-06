import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { and, eq, isNull, ne } from 'drizzle-orm'
import { db, passwordResetTokens, users } from '@/server/db'
import { sendPasswordResetEmail } from '@/lib/email'
import {
  clearEmailDeliveryStatus,
  emailDeliveryIssueFromCode,
  getEmailDeliveryStatus,
  recordEmailDeliveryIssue,
} from '@/lib/emailDeliveryStatus'
import { getClientIp, rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { isEmailDisabled } from '@/lib/config'
import { readJsonBody } from '@/lib/requestBody'

const genericResponse = () => NextResponse.json({ ok: true })

function deliveryUnavailableResponse(issue: 'daily_quota' | 'monthly_quota' | 'unavailable', expiresAt: number) {
  const message = issue === 'daily_quota'
    ? 'Password reset emails have reached today\'s sending limit. Please try again tomorrow.'
    : issue === 'monthly_quota'
      ? 'Password reset emails are temporarily unavailable. Please try again next month or contact support.'
      : 'Password reset emails are temporarily unavailable. Please try again in a few minutes.'
  const retryAfter = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1_000))
  return NextResponse.json(
    { error: message },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retryAfter) } },
  )
}

function emailDeliveryErrorDetails(error: unknown) {
  if (typeof error !== 'object' || error === null) return {}
  const details = error as Record<string, unknown>
  return {
    name: typeof details.name === 'string' ? details.name : undefined,
    code: typeof details.code === 'string' ? details.code : undefined,
    command: typeof details.command === 'string' ? details.command : undefined,
    responseCode: typeof details.responseCode === 'number' ? details.responseCode : undefined,
  }
}

async function deliverResetEmail(user: { id: string; email: string }) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60_000),
  })

  try {
    const result = await sendPasswordResetEmail(user.email, token)
    try {
      await db.delete(passwordResetTokens).where(and(
        eq(passwordResetTokens.userId, user.id),
        ne(passwordResetTokens.tokenHash, tokenHash),
      ))
    } catch {
      console.error('Password reset token cleanup failed')
    }
    if (result.dailyQuota !== null && result.dailyQuota >= 100) {
      recordEmailDeliveryIssue('daily_quota')
    } else {
      clearEmailDeliveryStatus()
    }
  } catch (error) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash))
    console.error('Password reset email delivery failed', emailDeliveryErrorDetails(error))
    const code = typeof error === 'object' && error && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined
    recordEmailDeliveryIssue(emailDeliveryIssueFromCode(code))
  }
}

export async function POST(req: Request) {
  if (isEmailDisabled()) {
    return NextResponse.json({ error: 'Password recovery is disabled on this instance. Contact the instance operator.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  const deliveryStatus = getEmailDeliveryStatus()
  if (deliveryStatus) return deliveryUnavailableResponse(deliveryStatus.issue, deliveryStatus.expiresAt)

  const ipLimit = await rateLimit(rateLimitKey('password-reset:ip', getClientIp(req)), 5, 60 * 60_000)
  if (!ipLimit.ok) return genericResponse()

  let body: unknown
  try {
    body = await readJsonBody(req, 4_096)
  } catch {
    return genericResponse()
  }
  const email = typeof body === 'object' && body && 'email' in body && typeof body.email === 'string'
    ? body.email.trim().toLowerCase()
    : null
  if (!email) return genericResponse()

  const emailLimit = await rateLimit(rateLimitKey('password-reset:email', email), 5, 60 * 60_000)
  if (!emailLimit.ok) return genericResponse()

  const user = await db.query.users.findFirst({
    where: and(eq(users.email, email), isNull(users.deletedAt)),
    columns: { id: true, email: true },
  })
  if (user) {
    after(async () => {
      try {
        await deliverResetEmail(user)
      } catch (error) {
        console.error('Password reset setup failed', emailDeliveryErrorDetails(error))
      }
    })
  }
  return genericResponse()
}
