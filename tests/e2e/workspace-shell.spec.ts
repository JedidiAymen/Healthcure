import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

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

test('educator lesson editor loads as a real route and switches its phone panes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/v1/auth/local-login', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      access_token: 'e2e-educator-session',
      user: { id: 'e2e-educator', display_name: 'Review educator', role: 'educator' },
    }),
  }))
  await page.route('**/api/v1/educator/**', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ detail: 'No educator fixture is installed.' }),
  }))
  await page.route('**/api/v1/cases', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      ...Array.from({ length: 21 }, (_, index) => ({ id: `openkbp:fixture-${index}`, module: 'dosetwin', dataset_id: 'OpenKBP', source_case_id: `fixture-${index}`, reference_kind: 'benchmark', status: 'ready', label: `OpenKBP fixture ${index}` })),
      { id: 'endoscapes:test:162_6575', module: 'surgivision', dataset_id: 'Endoscapes-BBox201', source_case_id: 'video-162:frame-6575', reference_kind: 'research', status: 'ready', label: 'Endoscapes test · video 162 · frame 6575' },
      { id: 'fisav:pat011', module: 'fistulaguard', dataset_id: 'FiSaV', source_case_id: 'pat011', reference_kind: 'research', status: 'ready', label: 'FiSaV · pat011' },
      { id: 'blocked:case', module: 'dosetwin', dataset_id: 'OpenKBP', source_case_id: 'blocked', reference_kind: 'benchmark', status: 'blocked', label: 'Blocked source case' },
    ]),
  }))

  await page.goto('/educator/cases/new/edit')
  await page.getByLabel('Username').fill('educator')
  await page.getByLabel('Password').fill('test-only-password')
  await page.getByRole('button', { name: 'Sign in as educator' }).click()
  await expect(page.getByRole('heading', { name: 'Compose an evidence lesson' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Research source and lesson blocks' })).toBeAttached()
  await expect(page.getByRole('complementary', { name: 'Learner-safe lesson preview' })).toBeAttached()
  const caseSearch = page.getByLabel(/Research source; search by case/)
  await caseSearch.fill('video 162 frame 6575')
  const caseOption = page.getByRole('option', { name: /Endoscapes test.*frame 6575/ })
  await expect(caseOption).toBeVisible()
  const casePopup = page.locator('[data-slot="combobox-content"]')
  await mkdir('.local-review/FIX-01', { recursive: true })
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    if (viewport.width === 390) {
      await caseSearch.press('Escape')
      await page.getByRole('button', { name: 'Source & blocks' }).click()
      const mobileCaseSearch = page.getByLabel(/Research source; search by case/)
      await mobileCaseSearch.click()
      await mobileCaseSearch.fill('video 162 frame 6575')
      await mobileCaseSearch.press('ArrowDown')
      await expect(caseOption).toBeVisible()
    }
    await casePopup.waitFor({ state: 'visible' })
    const geometry = await casePopup.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return { left: rect.left, right: rect.right, bottom: rect.bottom, maxHeight: Number.parseFloat(style.maxHeight), background: style.backgroundColor, width: innerWidth }
    })
    expect(geometry.background).toBe('rgb(255, 255, 255)')
    expect(geometry.left).toBeGreaterThanOrEqual(0)
    expect(geometry.right).toBeLessThanOrEqual(geometry.width)
    expect(geometry.maxHeight).toBeLessThanOrEqual(Math.min(320, viewport.height * 0.4))
    await expect(page.getByRole('option')).toHaveCount(1)
    await page.screenshot({ path: `.local-review/FIX-01/educator-picker-${viewport.width}x${viewport.height}.png` })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByRole('option', { name: /Blocked source case/ })).toHaveCount(0)
  await page.getByRole('option', { name: /Endoscapes test.*frame 6575/ }).click()
  await expect(page.locator('.lesson-case-summary')).toContainText('video-162:frame-6575')
  await expect(page.locator('.lesson-case-summary')).toContainText('Publication permissions are not established until source review.')
  await page.getByRole('button', { name: 'Reveal', exact: true }).click()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Learner preview' }).click()
  await expect(page.locator('.lesson-live-preview')).toBeVisible()
  await expect(page.locator('.educator-lesson-canvas')).toBeHidden()
  await expect(page.locator('.lesson-live-preview')).toContainText('1 educator reveal block is hidden from learners.')
  await expect(page.locator('.lesson-live-preview')).not.toContainText('Evidence use')
  expect(errors).toEqual([])
})

test('model lab filters source-linked methods and explains an execution gate', async ({ page }) => {
  await page.route('**/api/v1/models', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      {
        id: 'cvs-adaptnet', module: 'surgivision', name: 'CVS-AdaptNet',
        operation_ids: ['cvs.inference'], upstream_url: 'https://example.test/cvs',
        source_revision: 'revision-cvs', source_license: 'Checkpoint terms require review',
        readiness: 'blocked', details: 'Independent checkpoint identity is required before inference.',
      },
      {
        id: 'openkbp-baseline', module: 'dosetwin', name: 'OpenKBP prediction baseline',
        operation_ids: ['dose.prediction'], upstream_url: 'https://example.test/openkbp',
        source_revision: 'revision-openkbp', source_license: 'Dataset terms require review',
        readiness: 'unverified', details: 'Prediction weights and runtime are not verified.',
      },
    ]),
  }))

  await page.goto('/studio/models')
  await expect(page.getByText('2 source-linked methods')).toBeVisible()
  await page.getByRole('button', { name: 'DoseTwin methods' }).click()
  await expect(page.getByRole('button', { name: /OpenKBP prediction baseline/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /CVS-AdaptNet/ })).toHaveCount(0)
  await expect(page.getByText('Prediction weights and runtime are not verified.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Inspect source workspace' })).toHaveAttribute('href', '/studio/dosetwin/cases/current')
})

test('DoseTwin keeps one Gy scale, linked ROI overlays and voxel mapping under zoom and pan', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const caseId = 'openkbp:fixture'
  await page.route('**/api/v1/cases', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: caseId, module: 'dosetwin', dataset_id: 'OpenKBP', source_case_id: 'pt_201', reference_kind: 'benchmark', status: 'ready', label: 'OpenKBP test · pt_201' }]),
  }))
  await page.route('**/viewer/slice*', (route) => {
    const url = new URL(route.request().url())
    const layer = url.searchParams.get('layer')
    const roi = url.searchParams.get('roi') ?? 'Brainstem'
    const values = new Array(128 * 128).fill(layer === 'ct' ? 0.5 : 0)
    if (layer === 'dose') { values[64 * 128 + 64] = 40; values[64 * 128 + 65] = 70 }
    if (layer === 'roi') { values[64 * 128 + 64] = 1; values[64 * 128 + 65] = 1 }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      case_id: caseId, source_revision: 'fixture-revision', source_file: `${roi}.csv`, source_sha256: 'a'.repeat(64),
      axis: Number(url.searchParams.get('axis') ?? 2), index: Number(url.searchParams.get('index') ?? 64), shape: [128, 128], values,
      unit: layer === 'dose' ? 'Gy' : layer === 'roi' ? 'binary-mask' : 'benchmark-value', source_kind: 'synthetic-test',
      origin: 'synthetic-test-fixture', coordinate_frame: 'openkbp-processed-voxel-grid',
    }) })
  })
  await page.route('**/viewer/dvh*', (route) => {
    const roi = new URL(route.request().url()).searchParams.get('roi') ?? 'Brainstem'
    const curve = Array.from({ length: 51 }, (_, index) => ({ dose_gy: index * 1.6, volume_percent: index < 25 ? 100 : 0 }))
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      case_id: caseId, source_revision: 'fixture-revision', roi, dose_sha256: 'b'.repeat(64), roi_sha256: 'c'.repeat(64),
      voxel_count: 2, mean_dose_gy: 55, dose_display_max_gy: 80, spacing_mm: [5.422, 5.422, 3], ct_display_range: [0, 1],
      ct_display_note: 'Global test-fixture window; not HU.',
      official_metrics: { volume_cc: 1, dmean_gy: 55, dmax_voxel_gy: 70, d95_gy_interpolated: 40, d0_1cc_gy_openkbp: 70, d99_gy_openkbp: 40, d1_gy_openkbp: 70, v20gy_percent: 100, note: 'Fixture only.' },
      curve, method: 'Test-fixture curve.', source_kind: 'synthetic-test', origin: 'computed-from-synthetic-test-fixture',
    }) })
  })

  await page.goto('/studio/dosetwin/cases/current')
  await expect(page.getByRole('heading', { name: 'Linked dose review' })).toBeVisible()
  await expect(page.getByText('Dose prediction inference')).toBeVisible()
  await expect(page.getByRole('row', { name: /Dose prediction inference.*Blocked/ })).toBeVisible()
  await expect(page.getByText('0–80.0 Gy')).toBeVisible()
  const sourceViewport = page.getByRole('group', { name: /Z-index plane imaging viewport/ })
  const primaryPane = page.locator('section[aria-labelledby="dose-view-title"]')
  const paneWidth = await primaryPane.evaluate(element => element.getBoundingClientRect().width)
  const imageWidth = await page.getByRole('img', { name: /OpenKBP processed-array z-index plane/ }).evaluate(element => element.getBoundingClientRect().width)
  expect(imageWidth).toBeGreaterThan(paneWidth * 0.5)
  await page.getByRole('button', { name: 'View fullscreen' }).click()
  await expect.poll(() => sourceViewport.evaluate(element => document.fullscreenElement === element)).toBe(true)
  await page.getByRole('button', { name: 'Exit fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true)
  await page.getByRole('checkbox', { name: 'PTV63' }).check()
  await page.getByRole('checkbox', { name: 'PTV70' }).check()
  await expect(page.getByText('3 selected · structure colors stay fixed across slices.')).toBeVisible()
  await expect(page.getByRole('row', { name: /Brainstem/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /PTV63/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /PTV70/ })).toBeVisible()

  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.getByText('125%', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pan', exact: true }).click()
  const viewport = page.getByRole('img', { name: /OpenKBP processed-array z-index plane/ })
  const bounds = await viewport.boundingBox()
  if (!bounds) throw new Error('DoseTwin source viewport is not positioned')
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 + 40, bounds.y + bounds.height / 2 + 25)
  await page.mouse.up()
  await page.getByRole('button', { name: 'Pan', exact: true }).click()
  const movedBounds = await viewport.boundingBox()
  if (!movedBounds) throw new Error('DoseTwin source viewport disappeared after pan')
  await page.mouse.click(movedBounds.x + movedBounds.width * 0.76, movedBounds.y + movedBounds.height * 0.26)
  await expect(page.getByLabel('X index', { exact: true })).toHaveValue('33')
  await expect(page.getByLabel('Y index', { exact: true })).toHaveValue('97')
  const planeImage = page.getByRole('img', { name: /OpenKBP processed-array/ })
  for (const [planeName, expected] of [
    ['X index', ['33', '65', '65']],
    ['Y index', ['65', '65', '65']],
  ] as const) {
    await page.getByRole('button', { name: planeName }).click()
    const box = await planeImage.boundingBox()
    if (!box) throw new Error(`${planeName} source plane is not positioned`)
    await page.mouse.click(box.x + box.width * 0.51, box.y + box.height * 0.51)
    for (let axis = 0; axis < 3; axis++) await expect(page.getByLabel(['X index', 'Y index', 'Z index'][axis], { exact: true }).last()).toHaveValue(expected[axis])
  }
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.getByRole('button', { name: 'Z index' }).click()
  const tabletBox = await planeImage.boundingBox()
  if (!tabletBox) throw new Error('DoseTwin tablet source plane is not positioned')
  await page.mouse.click(tabletBox.x + tabletBox.width * 0.51, tabletBox.y + tabletBox.height * 0.51)
  await expect(page.getByLabel('X index', { exact: true }).last()).toHaveValue('65')
  await expect(page.getByLabel('Y index', { exact: true }).last()).toHaveValue('65')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768)
  expect(errors).toEqual([])
})

test('global search keeps keyboard focus and returns it to the trigger on escape', async ({ page }) => {
  await page.goto('/studio/models')
  const trigger = page.getByRole('button', { name: 'Find a research case or workspace' })
  await trigger.click()
  const input = page.locator('[data-slot="command-input"]')
  await expect(input).toBeFocused()
  await input.fill('model lab')
  await expect(page.getByRole('option', { name: /Model lab/i })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-slot="dialog-content"]')).toBeHidden()
  await expect(trigger).toBeFocused()
})
