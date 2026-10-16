import { type Page } from '@playwright/test'

export interface TestReader {
  password: string
  username: string
}

// Created by e2e/global-setup.ts on a fresh database.
export const E2E_ADMIN = { username: 'e2e_host', password: 'e2e-host-password' }

function readerSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export async function signIn(page: Page, username: string, password: string) {
  await page.goto('/signin')
  await page.fill('[name=username]', username)
  await page.fill('[name=password]', password)
  await page.click('button[type=submit]')
  await page.waitForURL('/', { timeout: 15_000 })
}

export async function createReader(page: Page, signupPath = '/signup'): Promise<TestReader> {
  const reader = {
    password: 'securepassword123',
    username: `reader${readerSuffix()}`,
  }

  await page.goto(signupPath)
  await page.fill('[name=username]', reader.username)
  await page.fill('[name=password]', reader.password)
  await page.check('[name=gdprConsent]')
  await page.click('button[type=submit]')
  await page.waitForURL(/signin/, { timeout: 15_000 })
  await signIn(page, reader.username, reader.password)

  return reader
}
