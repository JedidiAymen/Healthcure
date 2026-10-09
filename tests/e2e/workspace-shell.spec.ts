import { expect, test } from '@playwright/test'

test('home exposes the MEDFORGE app shell and role workspaces', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/MEDFORGE/)
  await expect(page.getByRole('link', { name: /MEDFORGE home/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /find a research case/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /case registry/i })).toBeAttached()
  await expect(page.getByRole('link', { name: /student academy/i })).toBeAttached()
  await expect(page.getByRole('link', { name: /educator studio/i })).toBeAttached()
})

test('small phone viewport keeps the app shell within the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /clinical research, grounded in evidence/i })).toBeVisible()
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(pageWidth).toBeLessThanOrEqual(390)
})
