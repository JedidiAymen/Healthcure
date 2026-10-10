import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

test('opt-in Cornerstone3D renders the installed OpenKBP volume across viewports', async ({ page }) => {
  test.skip(process.env.CORNERSTONE_SPIKE_E2E !== '1', 'Run only against the isolated Cornerstone trial server.')
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/studio/dosetwin/cornerstone-trial')
  await expect(page.getByRole('heading', { name: /Cornerstone3D on OpenKBP pt_201/ })).toBeVisible()
  await expect(page.getByText(/Cornerstone3D rendered the verified 128³ CT volume/)).toBeVisible({ timeout: 60_000 })
  for (const plane of ['xy', 'xz', 'yz']) {
    const canvas = page.locator(`[data-testid="cornerstone-${plane}"] canvas`)
    await expect(canvas).toBeVisible()
    const dimensions = await canvas.evaluate(element => ({ width: (element as HTMLCanvasElement).width, height: (element as HTMLCanvasElement).height }))
    expect(dimensions.width).toBeGreaterThan(100)
    expect(dimensions.height).toBeGreaterThan(100)
  }
  await mkdir('.local-review/CORNERSTONE', { recursive: true })
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(250)
    await page.screenshot({ path: `.local-review/CORNERSTONE/cornerstone-${viewport.width}x${viewport.height}.png`, fullPage: true })
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width).toBeLessThanOrEqual(viewport.width)
  }
  for (const plane of ['xy', 'xz', 'yz']) {
    const viewport = page.getByTestId(`cornerstone-${plane}`)
    const bounds = await viewport.boundingBox()
    if (!bounds) throw new Error(`Cornerstone ${plane.toUpperCase()} plane is not positioned`)
    await page.mouse.click(bounds.x + bounds.width * 0.68, bounds.y + bounds.height * 0.39)
    const xyz = await Promise.all(['x', 'y', 'z'].map(async axis => Number(await page.getByTestId(`cornerstone-index-${axis}`).textContent())))
    const axis = ['xy', 'xz', 'yz'].indexOf(plane) === 0 ? 2 : ['xy', 'xz', 'yz'].indexOf(plane) === 1 ? 1 : 0
    const axisIndex = xyz[axis]
    const offset = plane === 'xy' ? xyz[0] * 128 + xyz[1] : plane === 'xz' ? xyz[0] * 128 + xyz[2] : xyz[1] * 128 + xyz[2]
    for (const [layer, selector] of [['ct', 'cornerstone-ct-value'], ['dose', 'cornerstone-dose-value'], ['roi', 'cornerstone-roi-value']] as const) {
      const response = await page.request.get(`http://127.0.0.1:15179/api/v1/cases/openkbp%3Apt_201/viewer/slice?axis=${axis}&index=${axisIndex}&layer=${layer}&roi=Brainstem`)
      expect(response.ok()).toBe(true)
      const slice = await response.json() as { values: number[] }
      const rendered = await page.getByTestId(selector).textContent()
      if (layer === 'roi') expect(rendered).toBe(slice.values[offset] > 0 ? 'inside' : 'outside')
      else expect(Number(rendered)).toBeCloseTo(slice.values[offset], 1)
    }
  }
  const base = `${process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173'}/api/v1/cases/openkbp%3Apt_201/viewer`
  const [doseResponse, roiResponse, dvhResponse] = await Promise.all([
    page.request.get(`${base}/cornerstone-volume?layer=dose&roi=Brainstem`),
    page.request.get(`${base}/cornerstone-volume?layer=roi&roi=Brainstem`),
    page.request.get(`${base.replace('/viewer', '')}/viewer/dvh?roi=Brainstem`),
  ])
  expect(doseResponse.ok() && roiResponse.ok() && dvhResponse.ok()).toBe(true)
  const doseBytes = await doseResponse.body()
  const roiBytes = await roiResponse.body()
  const dose = new Float32Array(doseBytes.buffer, doseBytes.byteOffset, doseBytes.byteLength / Float32Array.BYTES_PER_ELEMENT)
  const roi = new Float32Array(roiBytes.buffer, roiBytes.byteOffset, roiBytes.byteLength / Float32Array.BYTES_PER_ELEMENT)
  const dvh = await dvhResponse.json() as { mean_dose_gy: number; curve: Array<{ dose_gy: number; volume_percent: number }> }
  let count = 0
  let sum = 0
  for (let index = 0; index < dose.length; index += 1) if (roi[index] > 0) { count += 1; sum += dose[index] }
  expect(count).toBeGreaterThan(0)
  expect(sum / count).toBeCloseTo(dvh.mean_dose_gy, 4)
  for (const point of dvh.curve) {
    let covered = 0
    for (let index = 0; index < dose.length; index += 1) if (roi[index] > 0 && dose[index] >= point.dose_gy) covered += 1
    expect(covered / count * 100).toBeCloseTo(point.volume_percent, 4)
  }
  expect(errors).toEqual([])
})
