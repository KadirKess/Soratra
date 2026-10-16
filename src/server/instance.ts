import 'server-only'
import { randomBytes } from 'node:crypto'
import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { db, instanceSettings, users } from './db'

export type RegistrationMode = 'invite' | 'open'

async function ensureSettingsRow() {
  await db.insert(instanceSettings)
    .values({ id: 1, authSecret: randomBytes(32).toString('base64url') })
    .onConflictDoNothing()
  const row = await db.query.instanceSettings.findFirst({ where: eq(instanceSettings.id, 1) })
  if (!row) throw new Error('Could not create the instance settings row.')
  return row
}

let authSecret: Promise<string> | null = null

// AUTH_SECRET from the environment wins; otherwise the secret generated on first start.
export function getAuthSecret() {
  const fromEnv = process.env.AUTH_SECRET?.trim()
  if (fromEnv) return Promise.resolve(fromEnv)
  authSecret ??= ensureSettingsRow().then((row) => row.authSecret).catch((error) => {
    authSecret = null
    throw error
  })
  return authSecret
}

// Once setup has finished it can never be undone, so cache the positive answer.
let setupDone = false

export async function isSetupComplete() {
  if (setupDone) return true
  const row = await ensureSettingsRow()
  setupDone = Boolean(row.setupCompletedAt)
  return setupDone
}

export const getInstance = cache(async () => {
  const row = await ensureSettingsRow()
  const admin = await db.query.users.findFirst({
    where: eq(users.isAdmin, true),
    columns: { username: true },
  })
  return {
    operatorName: row.operatorName?.trim() || admin?.username || 'the person who runs this Soratra',
    contact: row.contact?.trim() || null,
    adminUsername: admin?.username ?? null,
    registration: row.registration as RegistrationMode,
  }
})

export function contactHref(contact: string) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return `mailto:${contact}`
  if (/^https?:\/\//i.test(contact)) return contact
  return null
}
