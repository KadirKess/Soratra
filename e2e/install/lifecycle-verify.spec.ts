import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import {
  exportedData, LIFECYCLE_ADMIN, LIFECYCLE_NOTE, LIFECYCLE_OPERATOR, LIFECYCLE_READERS,
  loadJson, signInApi, stateDir, trpcQuery,
} from './api'

// Runs after each step of the lifecycle scenario (update, restart, restore
// onto a fresh install) against whatever the seed left behind.

const statePath = (name: string) => join(stateDir(), `${name}.state.json`)

test('readers stay signed in and their data is unchanged', async ({ baseURL, playwright }) => {
  for (const name of ['ada', 'ben']) {
    const context = await playwright.request.newContext({ baseURL, storageState: statePath(name) })
    try {
      expect(await exportedData(context)).toEqual(loadJson(`${name}.export.json`))
    } finally {
      await context.dispose()
    }
  }
})

test('passwords still work', async ({ baseURL }) => {
  for (const account of [LIFECYCLE_ADMIN, ...LIFECYCLE_READERS]) {
    const context = await signInApi(baseURL!, account.username, account.password)
    await context.dispose()
  }
})

test('the admin and instance settings survive', async ({ baseURL, playwright }) => {
  const admin = await playwright.request.newContext({ baseURL, storageState: statePath('admin') })
  try {
    const overview = await trpcQuery<{
      settings: { operatorName: string; registration: string }
      members: { username: string; isAdmin: boolean }[]
    }>(admin, 'admin.overview')
    expect(overview.settings).toMatchObject({ operatorName: LIFECYCLE_OPERATOR, registration: 'invite' })
    expect(overview.members.map(m => m.username).sort())
      .toEqual([LIFECYCLE_ADMIN, ...LIFECYCLE_READERS].map(a => a.username).sort())
    expect(overview.members.find(m => m.isAdmin)?.username).toBe(LIFECYCLE_ADMIN.username)
  } finally {
    await admin.dispose()
  }

  const setup = await playwright.request.newContext({ baseURL })
  try {
    const again = await setup.post('/api/setup', {
      data: { username: 'second_admin', password: 'second-admin-password', timezone: 'UTC', registration: 'open' },
    })
    expect(again.status()).toBe(409)
  } finally {
    await setup.dispose()
  }
})

test('a kept session opens the journal in the browser', async ({ browser }) => {
  const context = await browser.newContext({ storageState: statePath('ada') })
  try {
    const page = await context.newPage()
    await page.goto('/journal')
    await expect(page.getByText(LIFECYCLE_NOTE, { exact: true })).toBeVisible()

    await context.clearCookies()
    await page.goto('/signup')
    await expect(page.getByRole('heading', { name: 'Invite only' })).toBeVisible()
    await expect(page.getByText(`This Soratra is run by ${LIFECYCLE_OPERATOR}.`)).toBeVisible()
  } finally {
    await context.close()
  }
})
