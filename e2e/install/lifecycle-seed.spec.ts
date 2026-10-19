import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import {
  exportedData, LIFECYCLE_ADMIN, LIFECYCLE_NOTE, LIFECYCLE_OPERATOR, LIFECYCLE_READERS,
  saveJson, signInApi, stateDir, trpcMutation, trpcQuery,
} from './api'

// Runs against the previous release. It only uses API calls that release
// already had; if a future release changes them, seed with the old shape here.

test('seed an installation with readers, reading and a friendship', async ({ baseURL, playwright }) => {
  test.setTimeout(120_000)
  const anonymous = await playwright.request.newContext({ baseURL })
  const setup = await anonymous.post('/api/setup', {
    data: { ...LIFECYCLE_ADMIN, timezone: 'UTC', registration: 'open' },
  })
  expect(setup.status(), await setup.text()).toBe(201)
  for (const reader of LIFECYCLE_READERS) {
    const registered = await anonymous.post('/api/auth/register', {
      data: { ...reader, timezone: 'UTC', gdprConsent: true },
    })
    expect(registered.status(), await registered.text()).toBeLessThan(300)
  }
  await anonymous.dispose()

  const admin = await signInApi(baseURL!, LIFECYCLE_ADMIN.username, LIFECYCLE_ADMIN.password)
  await trpcMutation(admin, 'admin.updateSettings', {
    // Releases before 1.2.0 ignore checkForUpdates; later ones require it.
    operatorName: LIFECYCLE_OPERATOR, contact: 'books@example.org', registration: 'invite', checkForUpdates: false,
  })

  const [ada, ben] = await Promise.all(LIFECYCLE_READERS.map(r => signInApi(baseURL!, r.username, r.password)))
  const book = await trpcMutation<{ id: string }>(ada, 'books.getOrCreate', { openLibraryId: 'OL910004W' })
  await trpcMutation(ada, 'userBooks.upsert', { bookId: book.id, status: 'reading' })
  await trpcMutation(ada, 'readingSessions.log', {
    bookId: book.id,
    sessionDate: new Date().toISOString().slice(0, 10),
    rating: 4,
    minutes: 25,
    note: LIFECYCLE_NOTE,
    hasSpoiler: false,
    expectedRevision: 0,
  })

  const found = await trpcQuery<{ id: string } | null>(ada, 'friendships.findByUsername', { username: 'lifecycle_ben' })
  expect(found).not.toBeNull()
  await trpcMutation(ada, 'friendships.sendRequest', { addresseeId: found!.id })
  const adaId = (await trpcQuery<{ id: string }>(ben, 'friendships.findByUsername', { username: 'lifecycle_ada' })).id
  await trpcMutation(ben, 'friendships.accept', { requesterId: adaId })

  // The cookies are what the verify runs reuse: still signed in after the
  // update means the generated auth secret survived.
  for (const [name, context] of [['admin', admin], ['ada', ada], ['ben', ben]] as const) {
    await context.storageState({ path: join(stateDir(), `${name}.state.json`) })
    if (name !== 'admin') saveJson(`${name}.export.json`, await exportedData(context))
    await context.dispose()
  }
})
