import { test, expect } from '@playwright/test'
import { createReader } from '../helpers/auth'

// Needs an installation nobody has set up yet. The steps depend on each other,
// so this is one test rather than several.

const admin = { username: 'fresh_host', password: 'fresh-host-password' }

test('first-run setup, invite-only joining, then opening registration', async ({ browser, baseURL, playwright }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
  const guestContext = await browser.newContext()
  const anonymous = await playwright.request.newContext({ baseURL })
  try {
    const adminPage = await adminContext.newPage()
    await adminPage.goto('/')
    await expect(adminPage).toHaveURL(/\/setup$/)
    await adminPage.fill('#setup-username', admin.username)
    await adminPage.fill('#setup-password', admin.password)
    await adminPage.getByRole('radio', { name: /Me and people I invite/ }).check()
    await adminPage.getByRole('button', { name: 'Start my journal' }).click()
    await expect(adminPage).toHaveURL(/\/admin\?welcome=1$/, { timeout: 15_000 })
    await expect(adminPage.getByRole('status').filter({ hasText: /You.re all set/ })).toBeVisible()

    // Setup works exactly once.
    const guestPage = await guestContext.newPage()
    await guestPage.goto('/setup')
    await expect(guestPage).toHaveURL(/\/signin/)
    const secondSetup = await anonymous.post('/api/setup', {
      data: { username: 'fresh_intruder', password: 'fresh-intruder-password', timezone: 'UTC', registration: 'open' },
    })
    expect(secondSetup.status()).toBe(409)

    // Invite only: no form without a link, and the API agrees.
    await guestPage.goto('/signup')
    await expect(guestPage.getByRole('heading', { name: 'Invite only' })).toBeVisible()
    await expect(guestPage.getByText(`This Soratra is run by ${admin.username}.`)).toBeVisible()
    const uninvited = await anonymous.post('/api/auth/register', {
      data: { username: 'fresh_uninvited', password: 'fresh-uninvited-password', timezone: 'UTC', gdprConsent: true },
    })
    expect(uninvited.status()).toBe(403)

    await adminPage.getByRole('button', { name: 'Make an invite link' }).click()
    const link = new URL(await adminPage.getByLabel('New invite link').inputValue())
    const invited = await createReader(guestPage, link.pathname + link.search)
    await adminPage.reload()
    await expect(adminPage.getByText(`Joined as @${invited.username}`)).toBeVisible()

    const reused = await anonymous.post('/api/auth/register', {
      data: {
        username: 'fresh_reuser', password: 'fresh-reuser-password', timezone: 'UTC', gdprConsent: true,
        invite: link.searchParams.get('invite'),
      },
    })
    expect(reused.status()).toBe(403)

    // The admin names themself, adds a contact and opens registration.
    await adminPage.fill('#operator-name', 'Fresh Operator')
    await adminPage.fill('#operator-contact', 'help@example.org')
    await adminPage.getByRole('radio', { name: /Anyone who can open this page/ }).check()
    await adminPage.getByRole('button', { name: 'Save settings' }).click()
    await expect(adminPage.getByRole('button', { name: 'Saved' })).toBeVisible()

    await adminPage.reload()
    await expect(adminPage.locator('#operator-name')).toHaveValue('Fresh Operator')
    await expect(adminPage.locator('#operator-contact')).toHaveValue('help@example.org')
    await expect(adminPage.getByRole('radio', { name: /Anyone who can open this page/ })).toBeChecked()

    const visitorContext = await browser.newContext()
    try {
      const visitor = await visitorContext.newPage()
      await visitor.goto('/support')
      await expect(visitor.getByText(/This Soratra is run by Fresh Operator\./)).toBeVisible()
      await expect(visitor.getByRole('link', { name: 'help@example.org' })).toHaveAttribute('href', 'mailto:help@example.org')

      // Open registration: the form shows without an invite.
      await createReader(visitor)
    } finally {
      await visitorContext.close()
    }
  } finally {
    await anonymous.dispose()
    await guestContext.close()
    await adminContext.close()
  }
})
