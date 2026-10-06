import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
await mkdir(new URL('docs/images/', root), { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 })
  await page.goto(new URL('docs/readme-figures.html', root).href)
  await page.evaluate(() => document.fonts.ready)
  for (const name of ['banner', 'reading', 'hosting']) {
    await page.locator(`#${name}`).screenshot({ path: fileURLToPath(new URL(`docs/images/${name}.png`, root)) })
  }
} finally {
  await browser.close()
}
