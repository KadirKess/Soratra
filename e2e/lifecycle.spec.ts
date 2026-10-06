import { test, expect } from '@playwright/test'
import { createReader, signIn } from './helpers/auth'

test.beforeEach(async ({ baseURL }) => {
  const origin = new URL(baseURL ?? 'http://localhost:3000')
  if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
    throw new Error('Lifecycle tests require an isolated loopback installation.')
  }
})

test('reading sessions survive editing and export with the book finish date', async ({ page }) => {
  test.setTimeout(90_000)
  const reader = await createReader(page)
  await page.goto('/books/OL910004W')
  await page.getByRole('button', { name: 'Start reading & log a session', exact: true }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /Set rating to 3.5 or 4 stars/ }).press('Enter')
  await dialog.getByRole('button', { name: /Add time & notes/ }).click()
  await dialog.getByRole('spinbutton', { name: 'Exact minutes read' }).fill('37')
  await dialog.locator('#check-in-note').fill('Synthetic lifecycle note before editing')
  await dialog.locator('button[type=submit]').click()
  await expect(dialog).toBeHidden()

  await page.goto('/journal')
  await expect(page.getByText('Synthetic lifecycle note before editing', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(dialog.locator('#check-in-note')).toHaveValue('Synthetic lifecycle note before editing')
  await expect(dialog.getByRole('spinbutton', { name: 'Exact minutes read' })).toHaveValue('37')
  await dialog.getByRole('spinbutton', { name: 'Exact minutes read' }).fill('43')
  await dialog.locator('#check-in-note').fill('Synthetic lifecycle note after editing')
  await dialog.getByRole('button', { name: 'Update entry', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Synthetic lifecycle note after editing', { exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic lifecycle note before editing', { exact: true })).toHaveCount(0)

  await page.goto('/books/OL910004W')
  await page.getByRole('radio', { name: 'Read', exact: true }).click()
  await page.getByLabel('Your note about this book').fill('Synthetic completed-book review')
  const save = page.waitForResponse(response => response.url().includes('userBooks.upsert') && response.ok())
  await page.getByRole('button', { name: 'Update', exact: true }).click()
  await save

  const exported = await page.request.get('/api/profile/export')
  expect(exported.status()).toBe(200)
  expect(exported.headers()['cache-control']).toContain('no-store')
  const archive = await exported.json()
  expect(archive.version).toBe('1.7')
  expect(archive.books).toHaveLength(1)
  expect(archive.books[0]).toMatchObject({
    openLibraryId: 'OL910004W', status: 'read', review: 'Synthetic completed-book review',
  })
  expect(Number.isFinite(Date.parse(archive.books[0].finishedAt))).toBe(true)
  expect(archive.readingSessions).toHaveLength(1)
  expect(archive.readingSessions[0]).toMatchObject({
    openLibraryId: 'OL910004W', minutes: 43, rating: 4,
    note: 'Synthetic lifecycle note after editing', hasSpoiler: false,
  })
  expect(archive.readingSessions[0].sessionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

  const removed = await page.request.post('/api/profile/delete', {
    data: { email: reader.email, currentPassword: reader.password },
  })
  expect(removed.status()).toBe(200)
  expect((await page.request.get('/api/profile/export')).status()).toBe(401)
})

test('password changes invalidate existing sessions and deletion prevents sign-in', async ({ browser }) => {
  test.setTimeout(90_000)
  const first = await browser.newContext()
  const second = await browser.newContext()
  try {
    const firstPage = await first.newPage()
    const reader = await createReader(firstPage)
    const secondPage = await second.newPage()
    await signIn(secondPage, reader.email, reader.password)
    expect((await secondPage.request.get('/api/profile/export')).status()).toBe(200)

    const rejectedChange = await firstPage.request.post('/api/profile/password', {
      data: { currentPassword: 'incorrect-current-password', password: 'changed-password456' },
    })
    expect(rejectedChange.status()).toBe(400)
    const changed = await firstPage.request.post('/api/profile/password', {
      data: { currentPassword: reader.password, password: 'changed-password456' },
    })
    expect(changed.status()).toBe(200)
    expect((await secondPage.request.get('/api/profile/export')).status()).toBe(401)
    expect((await firstPage.request.get('/api/profile/export')).status()).toBe(401)

    await firstPage.goto('/signin')
    await firstPage.fill('[name=email]', reader.email)
    await firstPage.fill('[name=password]', reader.password)
    await firstPage.click('button[type=submit]')
    await expect(firstPage.locator('.auth-error')).toBeVisible()
    await signIn(firstPage, reader.email, 'changed-password456')
    expect((await firstPage.request.get('/api/profile/export')).status()).toBe(200)

    const rejectedDelete = await firstPage.request.post('/api/profile/delete', {
      data: { email: 'different@example.com', currentPassword: 'changed-password456' },
    })
    expect(rejectedDelete.status()).toBe(400)
    const removed = await firstPage.request.post('/api/profile/delete', {
      data: { email: reader.email, currentPassword: 'changed-password456' },
    })
    expect(removed.status()).toBe(200)
    expect((await firstPage.request.get('/api/profile/export')).status()).toBe(401)
    await firstPage.goto('/signin')
    await firstPage.fill('[name=email]', reader.email)
    await firstPage.fill('[name=password]', 'changed-password456')
    await firstPage.click('button[type=submit]')
    await expect(firstPage.locator('.auth-error')).toBeVisible()
  } finally {
    await first.close()
    await second.close()
  }
})
