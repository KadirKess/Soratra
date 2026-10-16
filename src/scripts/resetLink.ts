// Prints a one-time password reset link for a reader. Meant for an admin who is
// locked out: docker compose exec app soratra reset-link <username>
import { and, eq, isNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/server/db/schema'
import { createPasswordResetToken } from '@/server/tokens'

async function main() {
  const username = process.argv[2]?.trim().replace(/^@/, '')
  if (!username) {
    console.error('Usage: reset-link <username>')
    process.exitCode = 2
    return
  }
  const connectionString = process.env.POSTGRES_URL
  if (!connectionString) throw new Error('POSTGRES_URL is required.')

  const client = postgres(connectionString, { max: 1 })
  try {
    const db = drizzle(client, { schema })
    const user = await db.query.users.findFirst({
      where: and(eq(schema.users.usernameNormalized, username.toLowerCase()), isNull(schema.users.deletedAt)),
      columns: { id: true, username: true },
    })
    if (!user) {
      console.error(`No reader is called ${username}.`)
      process.exitCode = 1
      return
    }
    const { path, expiresAt } = await createPasswordResetToken(db, user.id)
    const base = process.env.SITE_URL?.trim()
    const link = base ? new URL(path, base).toString() : `<your Soratra address>${path}`
    process.stdout.write(`Password reset link for ${user.username}, valid until ${expiresAt.toISOString()}:\n\n  ${link}\n\n`)
  } finally {
    await client.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
