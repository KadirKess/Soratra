import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('user can sign up with GDPR consent', async ({ page }) => {
    const email = `test-${Date.now()}@example.com`
    const username = `user${Date.now()}`

    await page.goto('/signup')

    await page.fill('[name=email]', email)
    await page.fill('[name=username]', username)
    await page.fill('[name=password]', 'securepassword123')
    await page.check('[name=gdprConsent]')
    await page.click('button[type=submit]')

    await page.waitForURL(/signin/, { timeout: 15_000 })
  })

  test('user cannot sign up without GDPR consent', async ({ page }) => {
    await page.goto('/signup')

    await page.fill('[name=email]', `test-${Date.now()}@example.com`)
    await page.fill('[name=username]', `user${Date.now()}`)
    await page.fill('[name=password]', 'securepassword123')
    // intentionally skip gdprConsent

    await page.click('button[type=submit]')
    await expect(page).toHaveURL(/signup/)
  })

  test('sign up explains when an email is invalid', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('[name=email]', 'not-an-email')
    await page.fill('[name=username]', `reader${Date.now()}`)
    await page.fill('[name=password]', 'securepassword123')
    await page.check('[name=gdprConsent]')
    await page.click('button[type=submit]')

    await expect(page.locator('#signup-email-error')).toHaveText('Enter a valid email address.')
    await expect(page).toHaveURL(/signup/)
  })

  test('sign up explains when an email is already registered', async ({ page }) => {
    const email = `duplicate-${Date.now()}@example.com`

    await page.goto('/signup')
    await page.fill('[name=email]', email)
    await page.fill('[name=username]', `reader${Date.now()}`)
    await page.fill('[name=password]', 'securepassword123')
    await page.check('[name=gdprConsent]')
    await page.click('button[type=submit]')
    await page.waitForURL(/signin/, { timeout: 15_000 })

    await page.goto('/signup')
    await page.fill('[name=email]', email)
    await page.fill('[name=username]', `another${Date.now()}`)
    await page.fill('[name=password]', 'securepassword123')
    await page.check('[name=gdprConsent]')
    await page.click('button[type=submit]')

    await expect(page.locator('.auth-error')).toHaveText('This email is already registered. Please sign in.')
    await expect(page).toHaveURL(/signup/)
  })

  test('user can sign in into the authenticated shell after signing up', async ({ page }) => {
    const email = `signin-${Date.now()}@example.com`

    // Sign up first
    await page.goto('/signup')
    await page.fill('[name=email]', email)
    await page.fill('[name=username]', `user${Date.now()}`)
    await page.fill('[name=password]', 'securepassword123')
    await page.check('[name=gdprConsent]')
    await page.click('button[type=submit]')
    await page.waitForURL(/signin/, { timeout: 15_000 })

    // Sign in
    await page.fill('[name=email]', email)
    await page.fill('[name=password]', 'securepassword123')
    await page.click('button[type=submit]')

    await page.waitForURL('/', { timeout: 15_000 })
    await expect(page.locator('aside')).toBeVisible()
  })

  test('sign in shows error for wrong password', async ({ page }) => {
    await page.goto('/signin')
    await page.fill('[name=email]', 'nonexistent@example.com')
    await page.fill('[name=password]', 'wrongpassword')
    await page.click('button[type=submit]')

    await expect(page.locator('.auth-error')).toBeVisible()
  })

  test('sign in explains when an email is invalid', async ({ page }) => {
    await page.goto('/signin')
    await page.fill('[name=email]', 'not-an-email')
    await page.fill('[name=password]', 'wrongpassword')
    await page.click('button[type=submit]')

    await expect(page.locator('#signin-email-error')).toHaveText('Enter a valid email address.')
    await expect(page).toHaveURL(/signin/)
  })

  test('unauthenticated readers are sent to the public landing page', async ({ page }) => {
    await page.goto('/library')
    await expect(page).toHaveURL(/landing/)
  })
})
