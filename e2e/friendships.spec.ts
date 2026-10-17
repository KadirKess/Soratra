import { test, expect } from '@playwright/test'
import { createReader } from './helpers/auth'

test.describe('Friendships', () => {
  test('readers can connect, accept a request, and remove the connection', async ({ browser }) => {
    test.setTimeout(60_000)
    const firstContext = await browser.newContext()
    const secondContext = await browser.newContext()
    const firstPage = await firstContext.newPage()
    const secondPage = await secondContext.newPage()

    try {
      const firstReader = await createReader(firstPage)
      const secondReader = await createReader(secondPage)

      await firstPage.goto('/friends')
      await firstPage.fill('#friend-username', secondReader.username)
      await firstPage.getByRole('button', { name: 'Find reader', exact: true }).click()
      await expect(firstPage.getByText(`@${secondReader.username}`, { exact: true })).toBeVisible()
      await firstPage.getByRole('button', { name: 'Connect', exact: true }).click()
      await expect(firstPage.getByText('Friend request sent.', { exact: true })).toBeVisible()

      await secondPage.goto('/friends')
      await expect(secondPage.getByText(`@${firstReader.username}`, { exact: true })).toBeVisible()
      await secondPage.getByRole('button', { name: 'Accept', exact: true }).click()
      await expect(secondPage.getByText('You are now friends.', { exact: true })).toBeVisible()

      await firstPage.goto('/friends')
      await expect(firstPage.getByRole('link', { name: `@${secondReader.username}`, exact: true })).toBeVisible()

      await firstPage.getByRole('button', { name: 'Remove', exact: true }).click()
      const dialog = firstPage.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: 'Remove', exact: true }).click()
      await expect(firstPage.getByText('Connection removed. Shared reading access has ended.', { exact: true })).toBeVisible()

      await secondPage.goto(`/profile/${firstReader.username}`)
      await expect(secondPage.getByRole('heading', { name: 'Private profile', exact: true })).toBeVisible()
    } finally {
      await firstContext.close()
      await secondContext.close()
    }
  })
})
