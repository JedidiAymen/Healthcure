import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

async function installReviewFixtures(page: import('@playwright/test').Page) {
  const annotations = [{ id: 1, category_id: 6, category_name: 'tool', bbox: [100, 80, 180, 120], segmentation: null }]
  const cholecFrames = Array.from({ length: 10 }, (_, index) => 16 + index).map((frame_number, index) => ({
    frame_id: `VID68:${frame_number}`, video_id: 'VID68', frame_number, width: 640, height: 360,
    image_sha256: 'a'.repeat(64), annotation_sha256: 'b'.repeat(64), image_url: `/api/v1/surgivision/cholect50/VID68/frames/${frame_number}/image`,
    sample_time_sec: frame_number, sampling_fps: 1, phase_label: 'preparation',
    annotations: [{ triplet_id: 1, triplet_label: 'grasper grasp gallbladder', instrument_label: 'grasper', verb_label: 'grasp', target_label: 'gallbladder', bbox_xywh_px: [120 + index * 12, 100, 120, 90], confidence: 1, source_kind: 'expert reference annotation' }],
  }))
  const fixtureSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#233342"/><circle cx="300" cy="170" r="90" fill="#cf876a"/></svg>'
  await page.route('**/api/v1/cases', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'endoscapes:test:162_6575', module: 'surgivision', dataset_id: 'Endoscapes-BBox201', source_case_id: 'video-162:frame-6575', reference_kind: 'research-frame', status: 'ready', label: 'Endoscapes fixture · video 162 · frame 6575' }]) }))
  await page.route('**/api/v1/runs', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/api/v1/models/cvs-adaptnet/validate', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Fixture: checkpoint not installed.' }) }))
  await page.route('**/api/v1/surgivision/cvs-coverage', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Fixture: coverage endpoint unavailable.' }) }))
  await page.route('**/api/v1/surgivision/frames/**', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: fixtureSvg }))
  await page.route('**/api/v1/surgivision/frames/*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'endoscapes:test:162_6575', dataset_id: 'Endoscapes-BBox201', split: 'test', video_id: 162, frame_number: 6575, file_name: '162_6575.svg', width: 640, height: 360, image_sha256: 'c'.repeat(64), annotation_sha256: 'd'.repeat(64), cvs_criteria: [], annotations }) }))
  await page.route('**/api/v1/surgivision/media/**', route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/sampled-frames')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ media_id: 'endoscapes-bbox201:test:video-162', dataset_id: 'Endoscapes2023', source_video_id: 162, split: 'test', media_kind: 'sampled_sequence', asset_uri: null, native_fps: null, sampling_fps: 1, duration_sec: null, annotated_frame_count: 1, sampled_frame_count: 1, first_frame_id: 'endoscapes:test:162_5850', last_frame_id: 'endoscapes:test:162_5850', source_url: 'https://example.org/fixture', license_label: 'fixture only', allowed_use: 'UI fixture only', source_revision: 'fixture', metadata_validation_status: 'validated', capabilities: ['browse_sampled_sequence', 'browse_annotated_frames'], limitations: ['Test fixture only; no continuous footage.'] }) })
  })
  await page.route('**/api/v1/surgivision/clips', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ clip_id: 'appendix300:fixture-clip', dataset_id: 'Appendix300', procedure_label: 'Laparoscopic appendectomy', media_kind: 'native_video', duration_sec: 38.1, asset_uri: 'fixture-only', source_url: 'https://example.org/fixture', license_label: 'fixture only', citation: 'Test fixture metadata.', sha256: 'e'.repeat(64), limitations: ['Fixture only; no source media.'] }]) }))
  await page.route('**/api/v1/surgivision/clips/*/video', route => route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.alloc(0) }))
  await page.route('**/api/v1/surgivision/cholect50', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ video_id: 'VID68', dataset_id: 'CholecT50 Challenge Validation', procedure_label: 'Laparoscopic cholecystectomy', sampling_fps: 1, sampled_frame_count: 10, annotated_frame_count: 10, first_frame_number: 16, last_frame_number: 25, source_url: 'https://example.org/fixture', license_label: 'fixture only', citation: 'Test fixture metadata.', sha256: 'f'.repeat(64), limitations: ['Test fixture only; sparse samples.'] }]) }))
  await page.route('**/api/v1/surgivision/cholect50/*/frames', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cholecFrames) }))
  await page.route('**/api/v1/surgivision/cholect50/*/frames/*/image', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: fixtureSvg }))
}

test('SurgiVision routes reviewers from native video to source-matched labels', async ({ page }) => {
  const sourceBacked = process.env.MEDFORGE_E2E_SOURCE_API === '1'
  if (!sourceBacked) await installReviewFixtures(page)
  const videoDataset = sourceBacked ? 'Cholec80' : 'Appendix300'
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/studio/surgivision/cases/current')

  await expect(page.getByRole('heading', { name: 'SurgiVision surgical media review' })).toBeVisible()
  await expect(page.getByText(`${videoDataset} · source video`, { exact: true })).toBeVisible()
  const modes = page.getByRole('tablist', { name: 'Surgical media modes' })
  await expect(modes.getByRole('tab', { name: 'Continuous video · source labels' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: `${videoDataset} video with source labels` })).toBeVisible()
  if (sourceBacked) await expect(page.getByRole('group', { name: 'Publisher phase annotation for the current video frame' })).toBeVisible()
  else await expect(page.getByText(/no tool masks, triplets, phase labels or model output/)).toBeVisible()
  await expect(page.getByRole('img', { name: /published tool-tip boxes/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'View labeled samples' }).click()
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
  if (sourceBacked) await mkdir('.local-review/SURGIVISION-MEDIA-MODES', { recursive: true })
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    const suffix = `${viewport.width}x${viewport.height}`
    await page.setViewportSize(viewport)
    await modes.getByRole('tab', { name: 'Continuous video · source labels' }).click()
    await expect(page.getByRole('region', { name: `${videoDataset} video with source labels` })).toBeVisible()
    await expect(page.getByRole('img', { name: /published tool-tip boxes/ })).toHaveCount(0)
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
    if (sourceBacked) await page.screenshot({ path: `.local-review/SURGIVISION-MEDIA-MODES/native-video-${suffix}.png`, fullPage: true })
    await modes.getByRole('tab', { name: 'Sampled replay · source labels' }).click()
    await expect(review.getByRole('img', { name: /published tool-tip boxes; source annotation, not model output/ })).toBeVisible()
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
    if (sourceBacked) await page.screenshot({ path: `.local-review/SURGIVISION-MEDIA-MODES/sampled-results-${suffix}.png`, fullPage: true })
  }
  await modes.getByRole('tab', { name: 'Annotated stills' }).click()
  await expect(page.getByText('Frame review', { exact: false })).toBeVisible()
  await expect(review).toBeHidden()
  await page.setViewportSize({ width: 1440, height: 900 })
  if (sourceBacked) await page.screenshot({ path: '.local-review/SURGIVISION-MEDIA-MODES/annotated-stills-1440x900.png', fullPage: true })
})
