import { type Page } from '@playwright/test'

export interface TestReader {
  email: string
  password: string
  username: string
}

function readerSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/signin')
  await page.fill('[name=email]', email)
  await page.fill('[name=password]', password)
  await page.click('button[type=submit]')
  await page.waitForURL('/', { timeout: 15_000 })
}

export async function createReader(page: Page): Promise<TestReader> {
  const suffix = readerSuffix()
  const reader = {
    email: `reader-${suffix}@example.com`,
    password: 'securepassword123',
    username: `reader${suffix}`,
  }

  await page.goto('/signup')
  await page.fill('[name=email]', reader.email)
  await page.fill('[name=username]', reader.username)
  await page.fill('[name=password]', reader.password)
  await page.check('[name=gdprConsent]')
  await page.click('button[type=submit]')
  await page.waitForURL(/signin/, { timeout: 15_000 })
  await signIn(page, reader.email, reader.password)

  return reader
}
