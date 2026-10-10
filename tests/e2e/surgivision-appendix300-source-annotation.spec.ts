import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

type SurgicalClip = {
  clip_id: string
  duration_sec: number
  source_annotation: {
    event_label: string
    timestamp_seconds: number
    final_laparoscopic_grade: string
    grade_scale: string
    metadata_file: string
    metadata_bitstream_id: string
    metadata_md5: string
  } | null
}

test('Appendix300 source event and grade appear at their video timestamp @source', async ({ page }) => {
  const response = await page.request.get('/api/v1/surgivision/clips')
  expect(response.ok()).toBeTruthy()
  const clips = await response.json() as SurgicalClip[]
  const clip = clips.find(item => item.clip_id === 'appendix300-center1-014')
  expect(clip?.duration_sec).toBeCloseTo(38.1384, 3)
  expect(clip?.source_annotation).toMatchObject({
    event_label: 'Appendix fully visible before invasive preparation',
    timestamp_seconds: 23.161489,
    final_laparoscopic_grade: '2',
    grade_scale: 'Gomes',
    metadata_file: 'overall_merged.csv',
    metadata_bitstream_id: '93cb72d3-b1d5-40f0-bb46-08b6d486f3fd',
    metadata_md5: '6daddbbd2b5dbb28d1b025963bf93ed6',
  })

  await page.goto('/studio/surgivision/cases/current')
  await page.getByRole('button', { name: 'Jump to source event' }).click()
  const inVideoAnnotation = page.locator('[role="status"]').filter({ hasText: 'Publisher source annotation' })
  await expect(inVideoAnnotation).toContainText('Appendix fully visible before invasive preparation')
  await expect(inVideoAnnotation).toContainText('Final laparoscopic grade: 2 · Gomes scale')
  const video = page.locator('video[aria-label="Appendix300 laparoscopic appendectomy source video"]')
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(23)
  await expect.poll(async () => {
    const videoBox = await video.boundingBox()
    const overlayBox = await inVideoAnnotation.boundingBox()
    return Boolean(videoBox && overlayBox && videoBox.y >= 0 && overlayBox.y >= videoBox.y && overlayBox.y + overlayBox.height <= videoBox.y + videoBox.height)
  }).toBe(true)
  await mkdir('.local-review/UX-32', { recursive: true })

  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.getByRole('button', { name: 'Jump to source event' }).click()
    await expect(inVideoAnnotation).toBeVisible()
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
    await page.screenshot({ path: `.local-review/UX-32/surgivision-source-event-${viewport.width}x${viewport.height}.png` })
  }
})
