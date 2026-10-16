import 'server-only'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { isValidTimeZone } from '@/lib/dates'

export const GDPR_CONSENT_VERSION = '2026-10-16-v4'

export const accountFields = {
  username: z.string().trim()
    .min(2, 'Username must be at least 2 characters.')
    .max(30, 'Username must be 30 characters or fewer.')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can use letters, numbers, and underscores only.'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters.')
    .refine((password) => !bcrypt.truncates(password), 'Password is too long. Please use 72 bytes or fewer.'),
  timezone: z.string().refine(isValidTimeZone, 'We could not determine your time zone. Refresh the page and try again.'),
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

export function validationResponse(fieldErrors: Record<string, string[] | undefined>) {
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

// Maps a duplicate username to a field error; returns null for anything else.
export function duplicateAccountResponse(error: unknown) {
  const violation = uniqueViolation(error)
  if (!violation) return null
  const constraintName = violation.constraint_name ?? violation.constraint
  const constraint = typeof constraintName === 'string' ? constraintName.toLowerCase() : ''

  if (constraint.includes('username')) {
    const message = 'That username is already taken. Please choose another.'
    return NextResponse.json({ error: message, fieldErrors: { username: [message] } }, { status: 409 })
  }

  return NextResponse.json(
    { error: 'An account with these details already exists.' },
    { status: 409 },
  )
}
