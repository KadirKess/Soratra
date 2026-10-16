import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { db, instanceSettings, users } from '@/server/db'
import { readJsonBody } from '@/lib/requestBody'
import { getAuthSecret } from '@/server/instance'
import {
  accountFields, duplicateAccountResponse, GDPR_CONSENT_VERSION, hashPassword, validationResponse,
} from '@/server/accounts'

const schema = z.object({
  ...accountFields,
  registration: z.enum(['invite', 'open'], { error: 'Choose who can join.' }),
})

class AlreadySetUp extends Error {}

// First-run setup: creates the one admin account. Works exactly once.
export async function POST(req: Request) {
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await readJsonBody(req, 8_192)
  } catch {
    return NextResponse.json({ error: 'We could not read that. Please try again.' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return validationResponse(parsed.error.flatten().fieldErrors)

  const { username, password, timezone, registration } = parsed.data
  // Makes sure the settings row exists before the transaction claims it.
  await getAuthSecret()
  const passwordHash = await hashPassword(password)

  try {
    await db.transaction(async (tx) => {
      const [claimed] = await tx.update(instanceSettings)
        .set({ setupCompletedAt: new Date(), registration, updatedAt: new Date() })
        .where(and(eq(instanceSettings.id, 1), isNull(instanceSettings.setupCompletedAt)))
        .returning({ id: instanceSettings.id })
      if (!claimed) throw new AlreadySetUp()
      await tx.insert(users).values({
        username,
        passwordHash,
        timezone,
        isAdmin: true,
        preferredLanguage: 'en',
        gdprConsentAt: new Date(),
        gdprConsentVersion: GDPR_CONSENT_VERSION,
      })
    })
  } catch (error) {
    if (error instanceof AlreadySetUp) {
      return NextResponse.json({ error: 'This Soratra is already set up. Sign in instead.' }, { status: 409 })
    }
    return duplicateAccountResponse(error)
      ?? NextResponse.json({ error: 'Setup failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
