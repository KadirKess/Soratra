import { and, isNotNull, lt } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { users } from '@/server/db/schema'

async function main() {
  const connectionString = process.env.POSTGRES_URL
  if (!connectionString) {
    throw new Error('POSTGRES_URL is required to purge deleted users.')
  }

  const client = postgres(connectionString, { max: 1 })
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const purged = await drizzle(client)
      .delete(users)
      .where(and(isNotNull(users.deletedAt), lt(users.deletedAt, thirtyDaysAgo)))
      .returning({ id: users.id })

    process.stdout.write(`Purged ${purged.length} deleted users.\n`)
  } finally {
    await client.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
