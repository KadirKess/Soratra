import { test, expect } from '@playwright/test'

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

test.describe('Authentication', () => {
  test('user can sign up with GDPR consent', async ({ page }) => {
    await page.goto('/signup')

    await page.fill('[name=username]', `user${unique()}`)
    await page.fill('[name=password]', 'securepassword123')
    await page.check('[name=gdprConsent]')
    await page.click('button[type=submit]')

    await page.waitForURL(/signin/, { timeout: 15_000 })
  })

  test('user cannot sign up without GDPR consent', async ({ page }) => {
    await page.goto('/signup')

    await page.fill('[name=username]', `user${unique()}`)
    await page.fill('[name=password]', 'securepassword123')
    // intentionally skip gdprConsent

    await page.click('button[type=submit]')
    await expect(page).toHaveURL(/signup/)
  })

  test('sign up explains when a username is already taken', async ({ page }) => {
    const username = `taken${unique()}`

    await page.goto('/signup')
    await page.fill('[name=username]', username)
    await page.fill('[name=password]', 'securepassword123')
    await page.check('[name=gdprConsent]')
    await page.click('button[type=submit]')
    await page.waitForURL(/signin/, { timeout: 15_000 })

    await page.goto('/signup')
    await page.fill('[name=username]', username.toUpperCase())
    await page.fill('[name=password]', 'securepassword123')
    await page.check('[name=gdprConsent]')
    await page.click('button[type=submit]')

    await expect(page.locator('#signup-username-error')).toHaveText('That username is already taken. Please choose another.')
    await expect(page).toHaveURL(/signup/)
  })

  test('user can sign in into the authenticated shell after signing up', async ({ page }) => {
    const username = `signin${unique()}`

    await page.goto('/signup')
    await page.fill('[name=username]', username)
    await page.fill('[name=password]', 'securepassword123')
    await page.check('[name=gdprConsent]')
    await page.click('button[type=submit]')
    await page.waitForURL(/signin/, { timeout: 15_000 })

    // Usernames are not case-sensitive at sign-in.
    await page.fill('[name=username]', username.toUpperCase())
    await page.fill('[name=password]', 'securepassword123')
    await page.click('button[type=submit]')

    await page.waitForURL('/', { timeout: 15_000 })
    await expect(page.locator('aside')).toBeVisible()
  })

  test('sign in shows error for wrong password', async ({ page }) => {
    await page.goto('/signin')
    await page.fill('[name=username]', 'nobody_here')
    await page.fill('[name=password]', 'wrongpassword')
    await page.click('button[type=submit]')

    await expect(page.locator('.auth-error')).toContainText('Invalid username or password.')
  })

  test('sign in asks for a username when it is left blank', async ({ page }) => {
    await page.goto('/signin')
    await page.fill('[name=password]', 'wrongpassword')
    await page.click('button[type=submit]')

    await expect(page.locator('#signin-username-error')).toHaveText('Enter your username.')
    await expect(page).toHaveURL(/signin/)
  })

  test('forgot password explains who can help instead of sending email', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible()
    await expect(page.getByText('Soratra does not send email.')).toBeVisible()
  })

  test('setup cannot be run twice', async ({ page }) => {
    await page.goto('/setup')
    await expect(page).toHaveURL(/signin/)
  })

  test('unauthenticated readers are sent to the public landing page', async ({ page }) => {
    await page.goto('/library')
    await expect(page).toHaveURL(/landing/)
  })
})
