import { db, invites, users } from '@/server/db'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { rateLimit, rateLimitKey, getClientIp } from '@/lib/rateLimit'
import { readJsonBody } from '@/lib/requestBody'
import { getInstance, isSetupComplete } from '@/server/instance'
import { hashToken } from '@/server/tokens'
import {
  accountFields, duplicateAccountResponse, GDPR_CONSENT_VERSION, hashPassword, validationResponse,
} from '@/server/accounts'

const schema = z.object({
  ...accountFields,
  invite: z.string().max(128).optional(),
  gdprConsent: z.literal(true, { error: 'You need to agree to the Privacy Policy and Terms of Use.' }),
})

class InviteUnavailable extends Error {}

export async function POST(req: Request) {
  if (!await isSetupComplete()) {
    return NextResponse.json({ error: 'This Soratra has not been set up yet.' }, { status: 409 })
  }
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

  const { username, password, timezone, invite } = parsed.data
  const { registration } = await getInstance()
  if (registration === 'invite' && !invite) {
    return NextResponse.json({ error: 'This Soratra is invite-only. Ask the person who runs it for an invite link.' }, { status: 403 })
  }

  const passwordHash = await hashPassword(password)

  try {
    await db.transaction(async (tx) => {
      // In open mode an invite link still works, it just is not required.
      let inviteId: string | null = null
      if (invite) {
        const [claimed] = await tx.update(invites)
          .set({ usedAt: new Date() })
          .where(and(eq(invites.tokenHash, hashToken(invite)), isNull(invites.usedAt), gt(invites.expiresAt, new Date())))
          .returning({ id: invites.id })
        if (!claimed && registration === 'invite') throw new InviteUnavailable()
        inviteId = claimed?.id ?? null
      }
      const [user] = await tx.insert(users).values({
        username,
        passwordHash,
        timezone,
        preferredLanguage: 'en',
        gdprConsentAt: new Date(),
        gdprConsentVersion: GDPR_CONSENT_VERSION,
      }).returning({ id: users.id })
      if (inviteId) await tx.update(invites).set({ usedBy: user.id }).where(eq(invites.id, inviteId))
    })
  } catch (error) {
    if (error instanceof InviteUnavailable) {
      return NextResponse.json({ error: 'This invite link has expired or was already used. Ask for a new one.' }, { status: 403 })
    }
    return duplicateAccountResponse(error)
      ?? NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
