import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('CholecT50 sample playback keeps authentic labels on their exact frames', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/studio/surgivision/cases/current')

  await expect(page.getByRole('heading', { name: 'SurgiVision surgical media review' })).toBeVisible()
  await expect(page.getByText(/Appendix300 native appendectomy video without aligned labels/)).toBeVisible()
  const modes = page.getByRole('tablist', { name: 'Surgical media modes' })
  await expect(modes.getByRole('tab', { name: 'Native video · no aligned labels' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Unannotated native Appendix300 surgical video' })).toBeVisible()
  await expect(page.getByText('Playback only · no aligned results')).toBeVisible()
  await expect(page.getByRole('img', { name: /published tool-tip boxes/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'View CholecT50 labeled samples' }).click()
  await expect(modes.getByRole('tab', { name: 'Sampled replay · source labels' })).toHaveAttribute('aria-selected', 'true')
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
  await mkdir('.local-review/SURGIVISION-MEDIA-MODES', { recursive: true })
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    const suffix = `${viewport.width}x${viewport.height}`
    await page.setViewportSize(viewport)
    await modes.getByRole('tab', { name: 'Native video · no aligned labels' }).click()
    await expect(page.getByRole('region', { name: 'Unannotated native Appendix300 surgical video' })).toBeVisible()
    await expect(page.getByRole('img', { name: /published tool-tip boxes/ })).toHaveCount(0)
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
    await page.screenshot({ path: `.local-review/SURGIVISION-MEDIA-MODES/native-video-${suffix}.png`, fullPage: true })
    await modes.getByRole('tab', { name: 'Sampled replay · source labels' }).click()
    await expect(review.getByRole('img', { name: /published tool-tip boxes; source annotation, not model output/ })).toBeVisible()
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
    await page.screenshot({ path: `.local-review/SURGIVISION-MEDIA-MODES/sampled-results-${suffix}.png`, fullPage: true })
  }
  await modes.getByRole('tab', { name: 'Annotated stills' }).click()
  await expect(page.getByText('Frame review', { exact: false })).toBeVisible()
  await expect(review).toBeHidden()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: '.local-review/SURGIVISION-MEDIA-MODES/annotated-stills-1440x900.png', fullPage: true })
})
