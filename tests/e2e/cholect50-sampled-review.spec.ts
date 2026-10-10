import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('CholecT50 sample playback keeps authentic labels on their exact frames', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/studio/surgivision/cases/current')

  const review = page.locator('[aria-label="CholecT50 annotated cholecystectomy source review"]')
  await expect(review).toBeVisible()
  const sourceImage = review.getByAltText(/authentic cholecystectomy sample at/)
  await expect(sourceImage).toBeVisible()
  await expect(review.getByRole('img', { name: /published tool-tip boxes; source annotation, not model output/ })).toBeVisible()
  const firstSourceUrl = await sourceImage.getAttribute('src')

  await review.getByRole('button', { name: 'Play samples' }).click()
  const pause = review.getByRole('button', { name: 'Pause samples' })
  await expect(pause).toBeVisible()
  await expect.poll(() => sourceImage.getAttribute('src'), { timeout: 4_000 }).not.toBe(firstSourceUrl)
  await expect(review.getByRole('status')).toContainText('Source-time gaps are skipped; this is not continuous video.')
  await expect(review.getByText('Reference annotations, not AI output')).toBeVisible()

  await pause.click()
  const pausedSourceUrl = await sourceImage.getAttribute('src')
  await page.waitForTimeout(1_150)
  await expect(sourceImage).toHaveAttribute('src', pausedSourceUrl ?? '')
  await mkdir('.local-review/CHOLECT50-REAL-ANNOTATIONS', { recursive: true })
  await page.screenshot({ path: '.local-review/CHOLECT50-REAL-ANNOTATIONS/sample-playback-1440.png', fullPage: true })
})
