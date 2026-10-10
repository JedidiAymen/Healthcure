import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { completeResearchSignInIfPrompted } from './research-sign-in'

type SignalRecord = {
  id: string
  case_id: string
  source_case_id: string
  source_sha256: string
  sample_rate_hz: number
  duration_sec: number
  sample_count: number
}

type WindowFeatures = {
  source_sha256: string
  channel: string
  start_sec: number
  duration_sec: number
  sample_count: number
  source_sample_rate_hz: number
}

type SavedComparison = {
  id: string
  case_id: string
  channel: string
  source_sha256: string
  duration_sec: number
  selected_window: WindowFeatures
  reference_window: WindowFeatures
}

const closeTo = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)

test('authentic FiSaV switches records, bounds windows, and reopens saved comparison identity', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))

  // These API reads deliberately use the locally installed, checksum-verified
  // source records. No network fixtures or synthetic waveform responses are used.
  const firstResponse = await page.request.get('/api/v1/fistulaguard/records/pat001')
  const secondResponse = await page.request.get('/api/v1/fistulaguard/records/pat011')
  expect(firstResponse.ok(), 'authentic FiSaV pat001 must be installed locally').toBeTruthy()
  expect(secondResponse.ok(), 'authentic FiSaV pat011 must be installed locally').toBeTruthy()
  const first = await firstResponse.json() as SignalRecord
  const second = await secondResponse.json() as SignalRecord
  expect(first.source_sha256).toMatch(/^[a-f0-9]{64}$/)
  expect(second.source_sha256).toMatch(/^[a-f0-9]{64}$/)
  expect(second.source_sha256).not.toBe(first.source_sha256)
  expect(first.duration_sec).toBeGreaterThanOrEqual(20)

  await page.goto('/studio/fistulaguard/cases/fisav%3Apat001')
  const signalChart = page.getByRole('img', { name: /source waveform/ })
  await expect(signalChart).toBeVisible()
  await expect(page.getByText(first.source_sha256, { exact: true })).toBeVisible()

  const sourcePicker = page.getByRole('combobox', { name: 'Search installed FiSaV recordings' })
  await sourcePicker.fill('pat011')
  await page.getByRole('option', { name: 'pat011', exact: true }).click()
  await expect(page).toHaveURL(/fisav%3Apat011/i)
  await expect(page.getByRole('heading', { name: 'FiSaV · pat011 · source signal' })).toBeVisible()
  await expect(page.getByText(second.source_sha256, { exact: true })).toBeVisible()
  await expect(page.getByText(first.source_sha256, { exact: true })).toHaveCount(0)

  await sourcePicker.fill('pat001')
  await page.getByRole('option', { name: 'pat001', exact: true }).click()
  await expect(page).toHaveURL(/fisav%3Apat001/i)
  await expect(page.getByRole('heading', { name: 'FiSaV · pat001 · source signal' })).toBeVisible()
  await expect(signalChart).toBeVisible()
  await expect(page.getByText(first.source_sha256, { exact: true })).toBeVisible()

  const durationButtons = page.getByRole('group', { name: 'Window duration' })
  const startInput = page.getByRole('spinbutton', { name: 'Window start in seconds' })
  for (const seconds of [5, 10, 20]) {
    await durationButtons.getByRole('button', { name: `${seconds}s` }).click()
    const nearEndStart = Math.max(0, first.duration_sec - seconds)
    await startInput.fill(nearEndStart.toFixed(4))
    await startInput.press('Tab')
    await expect.poll(async () => {
      const label = await signalChart.getAttribute('aria-label')
      const range = label?.match(/from ([\d.]+) to ([\d.]+) seconds/)
      if (!range) return null
      return { start: Number(range[1]), end: Number(range[2]) }
    }).toEqual({
      start: Number(nearEndStart.toFixed(4)),
      end: Number((nearEndStart + seconds).toFixed(4)),
    })
  }

  // Save a genuine PZT2 comparison with distinct windows, then reopen it via
  // the shareable route used by Evidence Reports.
  await durationButtons.getByRole('button', { name: '5s' }).click()
  await startInput.fill('2.5')
  await startInput.press('Tab')
  const windowSlider = page.getByRole('slider', { name: 'Window start in seconds' })
  const sliderMaximum = Number(await windowSlider.getAttribute('max'))
  expect(sliderMaximum).toBeCloseTo(first.duration_sec - 5, 3)
  await windowSlider.focus()
  await page.keyboard.press('Home')
  await expect.poll(async () => Number(await windowSlider.getAttribute('aria-valuenow'))).toBe(0)
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => Number(await windowSlider.getAttribute('aria-valuenow'))).toBeCloseTo(1 / first.sample_rate_hz, 7)
  await expect(signalChart).toHaveAttribute('aria-label', /from 0\.000100 to 5\.000100 seconds/)
  await page.keyboard.press('End')
  await expect.poll(async () => Number(await windowSlider.getAttribute('aria-valuenow'))).toBe(sliderMaximum)
  await expect(signalChart).toHaveAttribute('aria-label', new RegExp(`from ${sliderMaximum.toFixed(6)} to ${(sliderMaximum + 5).toFixed(6)} seconds`))
  const reviewDir = '.local-review/FISTULAGUARD-SLIDER-KEYBOARD-QA'
  await mkdir(reviewDir, { recursive: true })
  for (const viewport of [{ width: 1440, height: 900, name: 'desktop' }, { width: 768, height: 1024, name: 'tablet' }, { width: 390, height: 844, name: 'phone' }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await windowSlider.scrollIntoViewIfNeeded()
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(dimensions.scrollWidth).toBe(dimensions.width)
    await page.screenshot({ path: `${reviewDir}/fisav-slider-${viewport.name}.png`, fullPage: true, animations: 'disabled' })
  }
  await page.setViewportSize({ width: 1280, height: 720 })
  await startInput.fill('2.5')
  await startInput.press('Tab')
  await page.getByRole('button', { name: 'PZT2', exact: true }).click()
  await expect(signalChart).toHaveAttribute('aria-label', /raw PZT2/)
  await page.getByRole('button', { name: 'Compare another window' }).click()
  const referenceStart = page.getByRole('spinbutton', { name: 'Reference window start in seconds' })
  await referenceStart.fill('12.5')
  await referenceStart.press('Tab')
  await expect(page.getByRole('columnheader', { name: /Selected · 2\.500000 s/ })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /Reference · 12\.500000 s/ })).toBeVisible()

  const saveResponsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/comparisons' && response.status() !== 401,
  )
  await page.getByRole('button', { name: 'Save comparison' }).click()
  await completeResearchSignInIfPrompted(page)
  const saveResponse = await saveResponsePromise
  expect(saveResponse.ok()).toBeTruthy()
  const saved = await saveResponse.json() as SavedComparison
  expect(saved.case_id).toBe(first.case_id)
  expect(saved.source_sha256).toBe(first.source_sha256)
  expect(saved.channel).toBe('raw PZT2')
  expect(saved.duration_sec).toBe(5)
  expect(saved.selected_window.source_sha256).toBe(first.source_sha256)
  expect(saved.reference_window.source_sha256).toBe(first.source_sha256)
  expect(saved.selected_window.channel).toBe(saved.reference_window.channel)
  expect(saved.selected_window.sample_count).toBe(saved.reference_window.sample_count)
  closeTo(saved.selected_window.start_sec, 2.5, 0.0001)
  closeTo(saved.reference_window.start_sec, 12.5, 0.0001)
  // FiSaV timestamps contain a small documented sampling interval variation;
  // duration is measured from returned source samples and can be one sample
  // shorter than the requested five-second bound.
  closeTo(saved.selected_window.duration_sec, 5, 1 / first.sample_rate_hz + 0.000001)
  closeTo(saved.reference_window.duration_sec, 5, 1 / first.sample_rate_hz + 0.000001)
  expect(saved.selected_window.duration_sec).toBeLessThanOrEqual(5)
  expect(saved.reference_window.duration_sec).toBeLessThanOrEqual(5)
  expect(saved.reference_window.duration_sec).toBe(saved.selected_window.duration_sec)

  await page.goto(`/studio/fistulaguard/cases/fisav%3Apat001?comparison=${encodeURIComponent(saved.id)}`)
  await expect(page.getByRole('status').filter({ hasText: 'Reopened saved FiSaV windows' })).toBeVisible()
  await expect(page.getByText(first.source_sha256, { exact: true })).toBeVisible()
  await expect(signalChart).toHaveAttribute('aria-label', /raw PZT2 source waveform from 2\.500000 to 7\.500000 seconds/)
  await expect(page.getByRole('columnheader', { name: /Selected · 2\.500000 s/ })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /Reference · 12\.500000 s/ })).toBeVisible()
  await expect(page.getByText(/50,000 samples/)).toBeVisible()

  const persistedResponse = await page.request.get(`/api/v1/comparisons/${saved.id}`)
  expect(persistedResponse.ok()).toBeTruthy()
  const persisted = await persistedResponse.json() as SavedComparison
  expect(persisted).toEqual(saved)
  expect(errors).toEqual([])
})
