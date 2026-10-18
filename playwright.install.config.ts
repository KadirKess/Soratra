import { defineConfig, devices } from '@playwright/test'

// Install scenarios (docker/ci/*.sh) each start their own installation and run
// one project here against it. No global setup: some of them need an
// installation nobody has set up yet. No retries either, since a retry would
// meet the state the first attempt left behind.
const baseURL = process.env.PLAYWRIGHT_BASE_URL
if (!baseURL) throw new Error('Set PLAYWRIGHT_BASE_URL to the scenario installation.')
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)) {
  throw new Error('Playwright requires an isolated loopback application, never a production URL.')
}

export default defineConfig({
  testDir: './e2e/install',
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'fresh-install', testMatch: 'fresh-install.spec.ts' },
    { name: 'lifecycle-seed', testMatch: 'lifecycle-seed.spec.ts' },
    { name: 'lifecycle-verify', testMatch: 'lifecycle-verify.spec.ts' },
  ],
})
