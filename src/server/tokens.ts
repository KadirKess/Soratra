// Shared by the app and the rescue CLI, so it takes the database as an argument
// and avoids 'server-only'.
import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from './db/schema'

type Database = PostgresJsDatabase<typeof schema>

export const RESET_LINK_TTL_MS = 24 * 60 * 60_000
export const INVITE_TTL_MS = 7 * 24 * 60 * 60_000

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function newToken() {
  return randomBytes(32).toString('base64url')
}

// Replaces any earlier link for this reader, so only the newest one works.
export async function createPasswordResetToken(db: Database, userId: string) {
  const token = newToken()
  const expiresAt = new Date(Date.now() + RESET_LINK_TTL_MS)
  await db.transaction(async (tx) => {
    await tx.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, userId))
    await tx.insert(schema.passwordResetTokens).values({ userId, tokenHash: hashToken(token), expiresAt })
  })
  return { token, path: `/reset-password?token=${token}`, expiresAt }
}

export async function createInviteToken(db: Database, createdBy: string) {
  const token = newToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
  const [invite] = await db.insert(schema.invites)
    .values({ tokenHash: hashToken(token), createdBy, expiresAt })
    .returning({ id: schema.invites.id })
  return { id: invite.id, token, path: `/signup?invite=${token}`, expiresAt }
}
