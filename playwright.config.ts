import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000)
const externalBase = process.env.PLAYWRIGHT_BASE_URL
const baseURL = externalBase ?? `http://localhost:${port}`
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)) {
  throw new Error('Playwright requires an isolated loopback application, never a production URL.')
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: externalBase ? [] : [
    {
      command: 'node e2e/helpers/openLibraryMock.mjs',
      url: 'http://127.0.0.1:3101/health',
      reuseExistingServer: false,
    },
    {
      command: `E2E=true E2E_OPEN_LIBRARY_BASE=http://127.0.0.1:3101 npm run dev -- --port ${port}`,
      url: `http://localhost:${port}`,
      reuseExistingServer: false,
    },
  ],
})
