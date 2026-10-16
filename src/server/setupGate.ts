import 'server-only'
import { redirect } from 'next/navigation'
import { isSetupComplete } from './instance'

// Sends every visitor to the welcome screen until the first account exists.
export async function requireSetup() {
  if (!await isSetupComplete()) redirect('/setup')
}
