import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

async function main() {
  const connectionString = process.env.POSTGRES_URL
  if (!connectionString) {
    throw new Error('POSTGRES_URL is required to run migrations.')
  }

  const client = postgres(connectionString, { max: 1 })
  try {
    await migrate(drizzle(client), { migrationsFolder: 'drizzle' })
  } finally {
    await client.end({ timeout: 5 })
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
