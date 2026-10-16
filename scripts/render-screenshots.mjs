// Retakes the README screenshots of the setup and admin pages. Needs a fresh,
// empty Soratra (it completes first-run setup with demo accounts), for example:
//   docker compose -p soratra-shots -f compose.yaml -f compose.build.yaml up -d --build --wait
//   node scripts/render-screenshots.mjs http://localhost:3000
//   docker compose -p soratra-shots down --volumes
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const base = process.argv[2] ?? 'http://localhost:3000'
const root = new URL('../', import.meta.url)
const output = (name) => fileURLToPath(new URL(`docs/images/${name}.png`, root))
const password = 'demo-reading-password'
const viewport = { width: 1200, height: 900 }

const browser = await chromium.launch()
try {
  const host = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  const page = await host.newPage()

  await page.goto(new URL('/setup', base).href)
  if (!page.url().endsWith('/setup')) throw new Error('This instance is already set up. Start from empty volumes.')
  // Wait for hydration, or the click submits the plain HTML form instead.
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.fill('[name=username]', 'maya')
  await page.fill('[name=password]', password)
  // Pad the crop so the card's offset shadow is not cut off.
  const card = await page.locator('.auth-card').boundingBox()
  await page.screenshot({ path: output('setup'), clip: { x: card.x - 40, y: card.y - 40, width: card.width + 80, height: card.height + 80 } })

  await page.getByRole('button', { name: 'Start my journal' }).click()
  await page.waitForURL(/\/admin/)

  let previousLink = ''
  for (const username of ['tomas', 'ines']) {
    await page.getByRole('button', { name: /^Make (an invite|another) link$/ }).click()
    // The field keeps showing the last, already used link until the new one arrives.
    await page.waitForFunction(
      (previous) => {
        const value = document.querySelector('input[readonly][id^="link-"]')?.value ?? ''
        return value.includes('invite=') && value !== previous
      },
      previousLink,
    )
    previousLink = await page.getByLabel('New invite link').inputValue()
    const link = new URL(previousLink)
    const guest = await browser.newContext()
    const guestPage = await guest.newPage()
    await guestPage.goto(new URL(link.pathname + link.search, base).href)
    await guestPage.waitForLoadState('networkidle')
    await guestPage.fill('[name=username]', username)
    await guestPage.fill('[name=password]', password)
    await guestPage.check('[name=gdprConsent]')
    await guestPage.click('button[type=submit]')
    await guestPage.waitForURL(/signin/)
    await guest.close()
  }

  await page.goto(new URL('/admin', base).href)
  await page.getByRole('button', { name: 'Make an invite link' }).click()
  await page.getByLabel('New invite link').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: output('admin') })
} finally {
  await browser.close()
}
