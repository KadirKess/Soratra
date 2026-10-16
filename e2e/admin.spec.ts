import { test, expect, type Browser } from '@playwright/test'
import { createReader, E2E_ADMIN, signIn } from './helpers/auth'

async function adminPage(browser: Browser) {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage()
  await signIn(page, E2E_ADMIN.username, E2E_ADMIN.password)
  return { context, page }
}

test('readers who are not the admin cannot open the admin page', async ({ page }) => {
  await createReader(page)
  await page.goto('/admin')
  await expect(page).toHaveURL(/profile/)
  await expect(page.getByRole('link', { name: 'Manage members' })).toHaveCount(0)
})

test('an invite link works once', async ({ browser }) => {
  test.setTimeout(60_000)
  const admin = await adminPage(browser)
  const guest = await browser.newContext()
  try {
    await admin.page.goto('/profile')
    await admin.page.getByRole('link', { name: 'Manage members' }).click()
    await admin.page.getByRole('button', { name: 'Make an invite link' }).click()
    const link = await admin.page.getByLabel('New invite link').inputValue()
    expect(link).toContain('/signup?invite=')

    const guestPage = await guest.newPage()
    const reader = await createReader(guestPage, new URL(link).pathname + new URL(link).search)

    await admin.page.reload()
    await expect(admin.page.getByText(`Joined as @${reader.username}`)).toBeVisible()

  } finally {
    await admin.context.close()
    await guest.close()
  }
})

test('the admin can hand a reader a password reset link', async ({ browser }) => {
  test.setTimeout(60_000)
  const admin = await adminPage(browser)
  const member = await browser.newContext()
  try {
    const memberPage = await member.newPage()
    const reader = await createReader(memberPage)

    await admin.page.goto('/admin')
    const row = admin.page.locator('.brutalist-card', { hasText: `@${reader.username}` })
    await row.getByRole('button', { name: 'Password reset link' }).click()
    await admin.page.getByRole('button', { name: 'Make link' }).click()
    const link = await admin.page.getByLabel(`Password reset link for ${reader.username}`).inputValue()

    // A reader who forgot their password is signed out.
    await member.clearCookies()
    await memberPage.goto(new URL(link).pathname + new URL(link).search)
    await memberPage.fill('#new-password', 'a-brand-new-password')
    await memberPage.getByRole('button', { name: 'Reset password' }).click()
    await memberPage.waitForURL(/signin\?reset=1/)
    await signIn(memberPage, reader.username, 'a-brand-new-password')

    await member.clearCookies()
    await memberPage.goto(new URL(link).pathname + new URL(link).search)
    await memberPage.fill('#new-password', 'another-new-password')
    await memberPage.getByRole('button', { name: 'Reset password' }).click()
    await expect(memberPage.locator('.auth-error')).toBeVisible()
  } finally {
    await admin.context.close()
    await member.close()
  }
})
