import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.POSTGRES_URL ?? 'postgres://localhost:5432/soratra'
const configuredPoolMax = Number(process.env.POSTGRES_POOL_MAX ?? 5)

if (!Number.isSafeInteger(configuredPoolMax) || configuredPoolMax < 1 || configuredPoolMax > 20) {
  throw new Error('POSTGRES_POOL_MAX must be an integer between 1 and 20.')
}

const client = postgres(connectionString, { max: configuredPoolMax })

export const db = drizzle(client, { schema })
export * from './schema'
