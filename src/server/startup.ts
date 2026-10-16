import 'server-only'
import { assertConfiguration } from '@/lib/config'
import { getAuthSecret } from '@/server/instance'
import { startMaintenanceLoop } from '@/server/maintenance'

function startupErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  const cause = typeof error === 'object' && error && 'cause' in error ? error.cause : null
  const causeCode = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : ''
  const anyCode = code || causeCode
  if (anyCode === '42P01') return 'the database has no tables yet. Run the migrations first.'
  if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(anyCode)) return 'the database is not reachable. Check that it is running and POSTGRES_URL points to it.'
  if (anyCode === '28P01') return 'the database rejected the password in POSTGRES_URL.'
  return error instanceof Error ? error.message : String(error)
}

export async function startServer() {
  try {
    assertConfiguration()
    await getAuthSecret()
  } catch (error) {
    console.error(`Soratra cannot start: ${startupErrorMessage(error)}`)
    // Exit instead of serving errors, so the real reason is the last log line.
    if (process.env.NODE_ENV === 'production') process.exit(1)
    return
  }
  if (process.env.E2E !== 'true') startMaintenanceLoop()
}
