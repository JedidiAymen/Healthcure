import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

type PhaseInterval = { first_frame: number; last_frame: number; phase: string }
type SurgicalClip = {
  clip_id: string
  dataset_id: string
  duration_sec: number
  frames_per_second?: number
  phase_track: PhaseInterval[]
  asset_uri: string
  sha256: string
  license_label: string
  source_url: string
}

test('Cholec80 source phase stays aligned to the decoded full-rate video frame @source', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const response = await page.request.get('/api/v1/surgivision/clips')
  expect(response.ok()).toBeTruthy()
  const records = await response.json() as SurgicalClip[]
  const clip = records.find(item => item.clip_id === 'cholect80-video01')
  expect(clip).toBeTruthy()
  expect(clip?.dataset_id).toBe('Cholec80')
  expect(clip?.frames_per_second).toBe(25)
  expect(clip?.duration_sec).toBeGreaterThan(1)
  expect(clip?.license_label).toBe('CC BY-NC-SA 4.0')
  expect(clip?.phase_track.length).toBeGreaterThan(2)

  const range = await page.request.get(clip!.asset_uri, { headers: { Range: 'bytes=0-4095' } })
  expect(range.status()).toBe(206)
  expect(range.headers()['content-range']).toMatch(/^bytes 0-4095\/\d+$/)
  const rangeBody = await range.body()
  expect(rangeBody.subarray(4, 8).toString()).toBe('ftyp')

  await page.goto('/studio/surgivision/cases/current')
  const video = page.locator('video[aria-label="Cholec80 Laparoscopic cholecystectomy source video"]')
  await expect(video).toHaveAttribute('src', /cholect80-video01/)
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(1)
  const overlay = page.getByRole('group', { name: 'Publisher phase annotation for the current video frame' })
  const firstPhase = clip!.phase_track[0]
  await expect(overlay).toContainText(firstPhase.phase.replace(/([a-z])([A-Z])/g, '$1 $2'))

  const secondPhase = clip!.phase_track[1]
  const targetTime = (secondPhase.first_frame + 0.25) / clip!.frames_per_second!
  await video.evaluate((element, seconds) => new Promise<void>((resolve, reject) => {
    const media = element as HTMLVideoElement
    const timeout = window.setTimeout(() => reject(new Error('Native video did not finish seeking to the selected source phase')), 15_000)
    media.addEventListener('seeked', () => { window.clearTimeout(timeout); resolve() }, { once: true })
    media.currentTime = seconds
  }), targetTime)
  await expect(overlay).toContainText(secondPhase.phase.replace(/([a-z])([A-Z])/g, '$1 $2'))
  await expect(overlay).toContainText(`frame ${secondPhase.first_frame.toLocaleString()}`)
  await expect(overlay).toContainText('not model output')
  const phaseTimeline = page.getByRole('group', { name: 'Seek to publisher-labeled phase interval' })
  await expect(phaseTimeline.getByRole('button')).toHaveCount(clip!.phase_track.length)
  const thirdPhase = clip!.phase_track[2]
  const thirdPhaseLabel = thirdPhase.phase.replace(/([a-z])([A-Z])/g, '$1 $2')
  await phaseTimeline.getByRole('button', { name: `Seek to ${thirdPhaseLabel}, frames ${thirdPhase.first_frame} to ${thirdPhase.last_frame}` }).click()
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(thirdPhase.first_frame / clip!.frames_per_second!)
  await expect(overlay).toContainText(thirdPhaseLabel)

  await expect(page.getByRole('combobox', { name: 'Select continuous surgical video' })).toContainText('Cholec80 · Laparoscopic cholecystectomy')
  await mkdir('.local-review/CHOLECT80-VIDEO', { recursive: true })
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
    const videoBox = await video.boundingBox()
    const overlayBox = await overlay.boundingBox()
    expect(videoBox && overlayBox).toBeTruthy()
    expect(overlayBox!.x).toBeGreaterThanOrEqual(videoBox!.x)
    expect(overlayBox!.y).toBeGreaterThanOrEqual(videoBox!.y)
    expect(overlayBox!.x + overlayBox!.width).toBeLessThanOrEqual(videoBox!.x + videoBox!.width)
    expect(overlayBox!.y + overlayBox!.height).toBeLessThanOrEqual(videoBox!.y + videoBox!.height)
    await page.screenshot({ path: `.local-review/CHOLECT80-VIDEO/cholec80-${viewport.width}x${viewport.height}.png`, fullPage: true })
  }
  expect(pageErrors).toEqual([])
})
