import { test, expect } from '@playwright/test'
import { createReader } from './helpers/auth'

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await createReader(page)
  })

  test('search page is available without making a catalog request', async ({ page }) => {
    await page.goto('/search')

    await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible()
    await expect(page.getByText('Search the catalog by title, author, or ISBN.', { exact: true })).toBeVisible()
  })

  test('prefers the reader language, then English, then the canonical title', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/profile')
    await page.selectOption('#catalog-language', 'fr')
    const saveResponse = page.waitForResponse((response) => response.url().includes('users.setPreferredLanguage') && response.ok())
    await page.getByRole('button', { name: 'Save preferred language' }).click()
    await saveResponse

    await page.goto('/search?q=e2e-title-in-reader-language')
    await expect(page.getByTestId('book-card-original-title')).toHaveText('Преступление и наказание')
    await expect(page.getByTestId('book-card-localized-title')).toHaveText('Crime et Châtiment')
    await page.goto('/books/OL910001W')
    await expect(page.getByRole('heading', { name: 'Преступление и наказание', exact: true })).toBeVisible()
    await expect(page.getByText('Crime et Châtiment', { exact: true }).filter({ visible: true })).toBeVisible()

    await page.goto('/search?q=e2e-english-fallback')
    await expect(page.getByTestId('book-card-original-title')).toHaveText('Преступление и наказание')
    await expect(page.getByTestId('book-card-localized-title')).toHaveText('Crime and Punishment')
    await page.goto('/books/OL910002W')
    await expect(page.getByText('Crime and Punishment', { exact: true }).filter({ visible: true })).toBeVisible()

    await page.goto('/search?q=e2e-canonical-fallback')
    await expect(page.getByTestId('book-card-original-title')).toHaveText('Преступление и наказание')
    await expect(page.getByTestId('book-card-localized-title')).toHaveCount(0)
    await page.goto('/books/OL910003W')
    await expect(page.getByText('Crimen y castigo', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Alternative titles', exact: true })).toHaveCount(0)
  })

  test('resolves an unknown reader-language title before the first detail render', async ({ page }) => {
    await page.goto('/profile')
    await page.selectOption('#catalog-language', 'fr')
    const saveResponse = page.waitForResponse((response) => response.url().includes('users.setPreferredLanguage') && response.ok())
    await page.getByRole('button', { name: 'Save preferred language' }).click()
    await saveResponse

    await page.goto('/books/OL910004W')
    await expect(page.getByText('Crime et Châtiment', { exact: true }).filter({ visible: true })).toBeVisible()
  })
})
