import { expect, request, type APIRequestContext } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Seeding and checking go through the HTTP API rather than the UI, so the same
// seed works against the previous release's screens.

// The lifecycle scenario seeds these on the previous release and checks them after.
export const LIFECYCLE_ADMIN = { username: 'lifecycle_host', password: 'lifecycle-host-password' }
export const LIFECYCLE_READERS = [
  { username: 'lifecycle_ada', password: 'lifecycle-ada-password' },
  { username: 'lifecycle_ben', password: 'lifecycle-ben-password' },
]
export const LIFECYCLE_OPERATOR = 'Lifecycle Operator'
export const LIFECYCLE_NOTE = 'Lifecycle note written before the update'

export function stateDir() {
  const dir = process.env.INSTALL_STATE_DIR
  if (!dir) throw new Error('Set INSTALL_STATE_DIR to a folder shared by the seed and verify runs.')
  return dir
}

export async function signInApi(baseURL: string, username: string, password: string) {
  const context = await request.newContext({ baseURL })
  const csrf = await context.get('/api/auth/csrf')
  expect(csrf.ok()).toBe(true)
  const { csrfToken } = await csrf.json() as { csrfToken: string }
  const response = await context.post('/api/auth/callback/credentials', {
    form: { username, password, csrfToken, callbackUrl: '/' },
    maxRedirects: 0,
  })
  expect(response.status(), `sign-in for ${username}`).toBeLessThan(400)
  expect(response.headers().location ?? '', `sign-in for ${username}`).not.toContain('error')
  return context
}

export async function trpcMutation<T>(context: APIRequestContext, path: string, input: unknown): Promise<T> {
  const response = await context.post(`/api/trpc/${path}`, { data: { json: input } })
  expect(response.ok(), `${path}: ${await response.text()}`).toBe(true)
  return (await response.json()).result.data.json as T
}

export async function trpcQuery<T>(context: APIRequestContext, path: string, input?: unknown): Promise<T> {
  const query = input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
  const response = await context.get(`/api/trpc/${path}${query}`)
  expect(response.ok(), `${path}: ${await response.text()}`).toBe(true)
  return (await response.json()).result.data.json as T
}

// The reader's data as their export shows it, minus what changes per request
// or per release.
export async function exportedData(context: APIRequestContext) {
  const response = await context.get('/api/profile/export')
  expect(response.status()).toBe(200)
  const { exportedAt: _exportedAt, version: _version, ...data } = await response.json()
  return data as Record<string, unknown>
}

// A newer release may add fields to the export. Data saved by an older one
// must come back unchanged, and the new fields may only be empty.
export function withoutNewEmptyFields(received: unknown, saved: unknown): unknown {
  if (Array.isArray(received) && Array.isArray(saved)) {
    return received.map((item, index) => withoutNewEmptyFields(item, saved[index]))
  }
  if (received && saved && typeof received === 'object' && typeof saved === 'object') {
    return Object.fromEntries(
      Object.entries(received)
        .filter(([key, value]) => key in saved || value !== null)
        .map(([key, value]) => [key, withoutNewEmptyFields(value, (saved as Record<string, unknown>)[key])]),
    )
  }
  return received
}

export function saveJson(name: string, value: unknown) {
  writeFileSync(join(stateDir(), name), JSON.stringify(value, null, 2))
}

export function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(stateDir(), name), 'utf8')) as T
}
