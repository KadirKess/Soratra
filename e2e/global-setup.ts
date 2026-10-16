import { request, type FullConfig } from '@playwright/test'
import { E2E_ADMIN } from './helpers/auth'

// Completes first-run setup with open registration so specs can create readers.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL
  const context = await request.newContext({ baseURL })
  try {
    const response = await context.post('/api/setup', {
      data: { ...E2E_ADMIN, timezone: 'UTC', registration: 'open' },
    })
    if (![201, 409].includes(response.status())) {
      throw new Error(`First-run setup failed with ${response.status()}: ${await response.text()}`)
    }
  } finally {
    await context.dispose()
  }
}
