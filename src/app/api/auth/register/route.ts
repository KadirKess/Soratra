import { db, users } from '@/server/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { rateLimit, rateLimitKey, getClientIp } from '@/lib/rateLimit'
import { assertProductionConfiguration } from '@/lib/config'
import { isValidTimeZone } from '@/lib/dates'
import { readJsonBody } from '@/lib/requestBody'

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  username: z.string().trim()
    .min(2, 'Username must be at least 2 characters.')
    .max(30, 'Username must be 30 characters or fewer.')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can use letters, numbers, and underscores only.'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters.')
    .refine((password) => !bcrypt.truncates(password), 'Password is too long. Please use 72 bytes or fewer.'),
  timezone: z.string().refine(isValidTimeZone, 'We could not determine your time zone. Refresh the page and try again.'),
  gdprConsent: z.literal(true, { error: 'You need to agree to the Privacy Policy and Terms of Use.' }),
})

const GDPR_CONSENT_VERSION = '2026-09-30-v3'

function validationResponse(fieldErrors: Record<string, string[] | undefined>) {
  return NextResponse.json(
    { error: 'Please correct the highlighted fields.', fieldErrors },
    { status: 400 },
  )
}

type DatabaseError = {
  code?: unknown
  constraint?: unknown
  constraint_name?: unknown
  cause?: unknown
}

function uniqueViolation(error: unknown): DatabaseError | null {
  let current = error

  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== 'object' || current === null) return null
    const details = current as DatabaseError
    if (details.code === '23505') return details
    current = details.cause
  }

  return null
}

function uniqueViolationResponse(error: DatabaseError) {
  const constraintName = error.constraint_name ?? error.constraint
  const constraint = typeof constraintName === 'string' ? constraintName.toLowerCase() : ''

  if (constraint.includes('username')) {
    const message = 'That username is already taken. Please choose another.'
    return NextResponse.json({ error: message, fieldErrors: { username: [message] } }, { status: 409 })
  }

  if (constraint.includes('email')) {
    const message = 'This email is already registered. Please sign in.'
    return NextResponse.json({ error: message, fieldErrors: { email: [message] } }, { status: 409 })
  }

  return NextResponse.json(
    { error: 'An account with these details already exists.' },
    { status: 409 },
  )
}

export async function POST(req: Request) {
  assertProductionConfiguration()
  const limit = await rateLimit(rateLimitKey('register:ip', getClientIp(req)), 5, 60 * 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  let body: unknown
  try {
    body = await readJsonBody(req, 8_192)
  } catch {
    return NextResponse.json({ error: 'We could not read that registration. Please try again.' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return validationResponse(parsed.error.flatten().fieldErrors)
  }

  const { email, username, password, timezone } = parsed.data
  const normalizedEmail = email.toLowerCase()
  const normalizedUsername = username

  const passwordHash = await bcrypt.hash(password, 12)

  try {
    await db.insert(users).values({
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash,
      timezone,
      preferredLanguage: 'en',
      gdprConsentAt: new Date(),
      gdprConsentVersion: GDPR_CONSENT_VERSION,
    })
  } catch (error) {
    const violation = uniqueViolation(error)
    if (violation) return uniqueViolationResponse(violation)
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
