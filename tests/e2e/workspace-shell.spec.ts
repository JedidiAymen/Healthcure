import { expect, test } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'

test('home exposes the MEDFORGE app shell and role workspaces', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/MEDFORGE/)
  await expect(page.getByRole('link', { name: /MEDFORGE home/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /find a research case/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /case registry/i })).toBeAttached()
  await expect(page.getByRole('link', { name: /student academy/i })).toBeAttached()
  await expect(page.getByRole('link', { name: /educator studio/i })).toBeAttached()
})

test('header workspace switcher reaches each role while learning sign-in gates stay active', async ({ page }) => {
  for (const endpoint of ['cases', 'runs', 'reports']) {
    await page.route(`**/api/v1/${endpoint}**`, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  }
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/studio')
    const switcher = page.getByRole('combobox', { name: 'Switch workspace' })
    await expect(switcher).toBeVisible()
    await expect(switcher).toContainText('Professional')

    await switcher.click()
    await page.getByRole('option', { name: 'Student Academy' }).click()
    await expect(page).toHaveURL(/\/academy$/)
    await expect(page.getByText('Student sign in', { exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Switch workspace' })).toContainText('Student')

    await page.getByRole('combobox', { name: 'Switch workspace' }).click()
    await page.getByRole('option', { name: 'Educator Studio' }).click()
    await expect(page).toHaveURL(/\/educator$/)
    await expect(page.getByText('Educator sign in', { exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Switch workspace' })).toContainText('Educator')

    await page.getByRole('combobox', { name: 'Switch workspace' }).click()
    await page.getByRole('option', { name: 'Professional Studio' }).click()
    await expect(page).toHaveURL(/\/studio$/)
    await expect(page.getByRole('heading', { name: /built around the work clinicians actually do/i })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
  }
})

test('home resumes the latest completed source-backed case summary', async ({ page }) => {
  const runId = 'run-home-resume'
  await page.route('**/api/v1/cases', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'openkbp:pt_201', module: 'dosetwin', dataset_id: 'OpenKBP', source_case_id: 'pt_201', reference_kind: 'benchmark', status: 'ready', label: 'OpenKBP · pt_201' }]),
  }))
  await page.route('**/api/v1/runs', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: runId, case_id: 'openkbp:pt_201', operation_id: 'openkbp.case_summary', status: 'completed',
      source_kind: 'benchmark', failure_code: null, provenance: { source_revision: 'fixture-source-revision' },
      results: {
        case: 'pt_201', grid_shape: [128, 128, 128], voxel_dimensions_mm: [5.422, 5.422, 3], files_sha256: {},
        available_rois: { Brainstem: { status: 'available', voxels: 10, dmean_gy: 30.25, d0_1cc_gy_openkbp: 32, d95_gy_interpolated: 25, v20gy_percent: 100 } },
        dose_nonzero_voxels: 10, ct_nonzero_voxels: 10, possible_dose_voxels: 10, dose_reference_kind: 'benchmark reference', coordinate_frame: 'index-space only',
      },
    }]),
  }))

  await page.goto('/')
  const continueLink = page.getByRole('link', { name: /Continue analysis/ })
  await expect(continueLink).toHaveAttribute('href', `/studio/experiments?runId=${runId}`)
  await mkdir('.local-review/UX-25-home-resume', { recursive: true })
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'phone', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.screenshot({ path: `.local-review/UX-25-home-resume/home-${viewport.name}-${viewport.width}x${viewport.height}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await continueLink.click()
  await expect(page).toHaveURL(new RegExp(`/studio/experiments\\?runId=${runId}$`))
  await expect(page.getByRole('heading', { name: 'OpenKBP case summary' })).toBeVisible()
  await expect(page.getByText(`run ${runId}`)).toBeVisible()
  await expect(page.getByRole('row', { name: /Brainstem.*10.*30.25/ })).toBeVisible()
  const configureTab = page.getByRole('tab', { name: /Configure analysis/ })
  const historyTab = page.getByRole('tab', { name: /Run history/ })
  await expect(historyTab).toHaveAttribute('aria-selected', 'true')
  await configureTab.click()
  await expect(page.getByRole('button', { name: 'Run case summary' })).toBeVisible()
  await historyTab.click()
  await expect(page.getByRole('heading', { name: 'OpenKBP case summary' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Saved analysis runs' })).toContainText(runId)
})

test('small phone viewport keeps the app shell within the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /clinical teams, working from evidence/i })).toBeVisible()
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(pageWidth).toBeLessThanOrEqual(390)
})

test('case registry explains an empty local source set without inventing cases', async ({ page }) => {
  await page.route('**/api/v1/cases**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([]),
  }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/studio/cases')

  await expect(page.getByRole('heading', { name: 'No cases registered' })).toBeVisible()
  await expect(page.getByText(/Nothing has been seeded as a sample patient/)).toBeVisible()
  await expect(page.getByRole('link', { name: /SurgiVision/ })).toHaveAttribute('href', '/studio/surgivision/cases/current')
  await expect(page.getByRole('link', { name: /DoseTwin/ })).toHaveAttribute('href', '/studio/dosetwin/cases/current')
  await expect(page.getByRole('link', { name: /FistulaGuard/ })).toHaveAttribute('href', '/studio/fistulaguard/cases/current')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('case registry keeps a source-selected inspection preview across screen sizes', async ({ page }) => {
  await page.route('**/api/v1/cases**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { id: 'openkbp:pt_201', module: 'dosetwin', dataset_id: 'OpenKBP', source_case_id: 'pt_201', reference_kind: 'benchmark', status: 'ready', label: 'OpenKBP pt_201' },
      { id: 'endoscapes:test:162_6575', module: 'surgivision', dataset_id: 'Endoscapes-BBox201', source_case_id: 'video-162:frame-6575', reference_kind: 'research', status: 'ready', label: 'Endoscapes test · video 162 · frame 6575' },
      { id: 'fisav:pat011', module: 'fistulaguard', dataset_id: 'FiSaV', source_case_id: 'pat011', reference_kind: 'research', status: 'ready', label: 'FiSaV · pat011 · source signal' },
    ]),
  }))
  await page.route('**/api/v1/runs**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'run-fixture', case_id: 'openkbp:pt_201', operation_id: 'openkbp.case_summary', source_kind: 'benchmark', status: 'completed', results: {}, provenance: {} }]),
  }))
  await page.route('**/api/v1/surgivision/frames/**/image', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"Fixture has no source image."}' }))
  await page.route('**/api/v1/fistulaguard/records/**/waveform**', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"Fixture has no source waveform."}' }))

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/studio/cases?selected=endoscapes%3Atest%3A162_6575')
    const preview = page.getByRole('complementary', { name: 'Selected research source' })
    await expect(preview).toBeVisible()
    await expect(preview.getByText('Endoscapes test · video 162 · frame 6575', { exact: true })).toBeVisible()
    await expect(page.getByText('Frame', { exact: true }).first()).toBeVisible()
    const doseRow = page.getByRole('row').filter({ hasText: 'OpenKBP pt_201' })
    const mobileAction = doseRow.locator('small', {}).getByText(/Last analysis: Dose summary · completed/)
    const desktopAction = doseRow.getByRole('cell').last().getByText('Dose summary · completed', { exact: true })
    await expect(viewport.width < 640 ? mobileAction : desktopAction).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
  }

  await page.getByRole('link', { name: /Inspect FiSaV · pat011/ }).click()
  await expect(page).toHaveURL(/selected=fisav%3Apat011/)
  await expect(page.getByRole('complementary', { name: 'Selected research source' }).getByText('FiSaV · pat011 · source signal', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open analysis' }).click()
  await expect(page).toHaveURL(/\/studio\/fistulaguard\/cases\/fisav%3Apat011$/)
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
  await expect(page.getByRole('complementary', { name: 'Learner preview and rubric inspector' })).toBeAttached()
  await page.getByRole('button', { name: 'Remove Instruction' }).click()
  await expect(page.getByRole('heading', { name: 'No lesson steps yet' })).toBeVisible()
  await page.getByRole('button', { name: 'Add the first step' }).click()
  await expect(page.getByRole('textbox', { name: 'Instruction title' })).toHaveValue('Instruction block')
  const caseSearch = page.getByLabel(/Research source; search by case/)
  await caseSearch.fill('video 162 frame 6575')
  const caseOption = page.getByRole('option', { name: /Endoscapes test.*frame 6575/ })
  await expect(caseOption).toBeVisible()
  const casePopup = page.locator('[data-slot="combobox-content"]:visible').last()
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
  // Constrain the viewport and keep DPR at 2 to approximate a 200% zoom layout.
  // Chromium's visualViewport may differ from its CSS/layout viewport in CDP
  // emulation; popup max-height uses vh/dvh, so assert against innerHeight.
  await page.keyboard.press('Escape')
  const zoomCdp = await page.context().newCDPSession(page)
  await zoomCdp.send('Emulation.setDeviceMetricsOverride', { width: 720, height: 450, deviceScaleFactor: 2, mobile: false })
  await expect.poll(() => page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }))).toEqual({ width: 720, dpr: 2 })
  const zoomedCaseSearch = page.getByLabel(/Research source; search by case/)
  await zoomedCaseSearch.fill('video 162 frame 6575')
  const zoomedPopup = page.locator('[data-slot="combobox-content"]')
  await expect(page.getByRole('option', { name: /Endoscapes test.*frame 6575/ })).toBeVisible()
  const zoomedGeometry = await zoomedPopup.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height, maxHeight: Number.parseFloat(style.maxHeight), background: style.backgroundColor, width: innerWidth, viewportHeight: innerHeight, visualViewportHeight: visualViewport?.height }
  })
  expect(zoomedGeometry.background).toBe('rgb(255, 255, 255)')
  expect(zoomedGeometry.left).toBeGreaterThanOrEqual(0)
  expect(zoomedGeometry.right).toBeLessThanOrEqual(zoomedGeometry.width)
  // DPR emulation does not reproduce Chrome page zoom's viewport units. Check
  // the actual popup geometry and its hard cap instead of inferring 40vh from
  // innerHeight, which can disagree with Chromium's emulated visual viewport.
  expect(zoomedGeometry.maxHeight).toBeLessThanOrEqual(320)
  expect(zoomedGeometry.height).toBeLessThanOrEqual(320)
  expect(zoomedGeometry.top).toBeGreaterThanOrEqual(0)
  expect(zoomedGeometry.bottom).toBeLessThanOrEqual(zoomedGeometry.viewportHeight + 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(720)
  await page.screenshot({ path: '.local-review/FIX-01/educator-picker-200-percent-720x450.png' })
  await zoomCdp.detach()
  await page.setViewportSize({ width: 1440, height: 900 })
  // Reopen after restoring the layout viewport so the portal recalculates its
  // anchor instead of retaining the emulated 200%-zoom position.
  await zoomedCaseSearch.click()
  await zoomedCaseSearch.fill('video 162 frame 6575')
  await expect(page.getByRole('option', { name: /Endoscapes test.*frame 6575/ })).toBeVisible()
  await expect(page.getByRole('option', { name: /Blocked source case/ })).toHaveCount(0)
  await page.getByRole('option', { name: /Endoscapes test.*frame 6575/ }).click()
  await expect(page.locator('.lesson-case-summary')).toContainText('video-162:frame-6575')
  await expect(page.locator('.lesson-case-summary')).toContainText('Publication permissions are not established until source review.')
  await page.screenshot({ path: '.local-review/FIX-01/educator-builder-fixture-1440x900.png', fullPage: true })
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.screenshot({ path: '.local-review/FIX-01/educator-builder-fixture-768x1024.png', fullPage: true })
  await page.getByText('Lesson inspector', { exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Learner view')
  await page.getByRole('button', { name: /Rubric/ }).click()
  await expect(page.getByRole('dialog')).toContainText('Private educator guidance')
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Reveal', exact: true }).click()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Preview & rubric' }).click()
  await expect(page.getByRole('complementary', { name: 'Learner preview and rubric inspector' })).toBeVisible()
  await expect(page.locator('.educator-lesson-canvas')).toBeHidden()
  await page.getByRole('button', { name: 'Learner preview' }).click()
  await expect(page.getByRole('complementary', { name: 'Learner preview and rubric inspector' })).toContainText('1 educator reveal block is hidden from learners.')
  await expect(page.getByRole('complementary', { name: 'Learner preview and rubric inspector' })).not.toContainText('Evidence use')
  await page.getByRole('button', { name: /Rubric/ }).click()
  await expect(page.getByRole('complementary', { name: 'Learner preview and rubric inspector' })).toContainText('Private educator guidance')
  await page.screenshot({ path: '.local-review/FIX-01/educator-builder-fixture-390x844.png', fullPage: true })
  expect(errors).toEqual([])
})

test('educator teaching desk shows real work and opens the selected assignment review', async ({ page }) => {
  const assignmentId = 'assignment-review-001'
  const lessonTitle = 'Inspect a measured source window'
  let includeSecondAssignment = false
  await page.route('**/api/v1/auth/local-login', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      access_token: 'e2e-educator-session',
      user: { id: 'e2e-educator', display_name: 'Review educator', role: 'educator' },
    }),
  }))
  await page.route('**/api/v1/educator/drafts', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: 'draft-001', title: 'Compare two signal windows', case_id: 'fisav:pat011',
      module: 'fistulaguard', revision: 3, updated_at: '2026-10-10 08:00:00',
    }]),
  }))
  await page.route('**/api/v1/educator/assignments', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: assignmentId, lesson_version_id: 'version-001', lesson_title: lessonTitle,
      cohort_id: 'cohort-001', due_at: null, student_count: 2,
    }, ...(includeSecondAssignment ? [{
      id: 'assignment-review-002', lesson_version_id: 'version-002', lesson_title: 'Locate an annotated surgical landmark',
      cohort_id: 'cohort-002', due_at: '2026-10-20T12:00:00Z', student_count: 4,
    }] : [])]),
  }))
  await page.route('**/api/v1/educator/cohorts', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { id: 'cohort-001', name: 'Physiological signals seminar', student_count: 2 },
      { id: 'cohort-002', name: 'Surgical imaging group', student_count: 4 },
    ]),
  }))
  await page.route('**/api/v1/educator/versions', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/api/v1/educator/students', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**/api/v1/educator/assignments/${assignmentId}/attempts`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      attempt_id: 'attempt-001', student_id: 'student-001', student_name: 'Learner One',
      state: 'review_required', submitted_at: '2026-10-10T08:30:00Z', score: null,
      observations: [], rubric_criteria: [], criterion_scores: [], viewer_evidence: null,
    }, {
      attempt_id: 'attempt-002', student_id: 'student-002', student_name: 'Learner Two',
      state: 'graded', submitted_at: '2026-10-09T08:30:00Z', score: 82,
      observations: [], rubric_criteria: [], criterion_scores: [], viewer_evidence: null,
    }]),
  }))

  await page.goto('/educator')
  await page.getByLabel('Username').fill('educator')
  await page.getByLabel('Password').fill('test-only-password')
  await page.getByRole('button', { name: 'Sign in as educator' }).click()
  await expect(page.getByRole('heading', { name: 'Teaching desk' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Submissions awaiting review' })).toBeVisible()
  await expect(page.getByText('Learner One')).toBeVisible()
  await expect(page.getByText(lessonTitle)).toBeVisible()
  await expect(page.getByText('Physiological signals seminar')).toBeVisible()
  await expect(page.getByText('Compare two signal windows')).toBeVisible()

  await page.getByRole('link', { name: 'Review Learner One submission for Inspect a measured source window' }).click()
  await expect(page).toHaveURL(new RegExp(`/educator/submissions\\?assignmentId=${assignmentId}`))
  await expect(page.getByRole('combobox', { name: 'Assignment' })).toContainText(lessonTitle)
  await expect(page.getByRole('row', { name: /Learner One.*Awaiting review/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /Learner Two.*Reviewed/ })).toBeVisible()
  await mkdir('.local-review/UX-24-educator-triage', { recursive: true })
  for (const [name, width, height] of [['desktop', 1440, 900], ['laptop', 1280, 800], ['tablet', 768, 1024], ['phone', 390, 844]] as const) {
    await page.setViewportSize({ width, height })
    await page.screenshot({ path: `.local-review/UX-24-educator-triage/submissions-${name}.png`, fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('textbox', { name: 'Search learner attempts' }).fill('Learner Two')
  await expect(page.getByRole('row', { name: /Learner Two/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /Learner One/ })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Search learner attempts' }).fill('')
  await page.getByRole('combobox', { name: 'Filter learner attempts by status' }).click()
  await page.getByRole('option', { name: 'Reviewed' }).click()
  await expect(page.getByRole('row', { name: /Learner Two.*Reviewed/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /Learner One/ })).toHaveCount(0)

  includeSecondAssignment = true
  await page.getByRole('link', { name: 'Assignments', exact: true }).click()
  await expect(page.getByRole('row', { name: /Inspect a measured source window/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /Locate an annotated surgical landmark/ })).toBeVisible()
  for (const [name, width, height] of [['desktop', 1440, 900], ['laptop', 1280, 800], ['tablet', 768, 1024], ['phone', 390, 844]] as const) {
    await page.setViewportSize({ width, height })
    await page.screenshot({ path: `.local-review/UX-24-educator-triage/assignments-${name}.png`, fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('textbox', { name: 'Search assignments' }).fill('Physiological signals')
  await expect(page.getByRole('row', { name: /Inspect a measured source window/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /Locate an annotated surgical landmark/ })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Search assignments' }).fill('')
  await page.getByRole('combobox', { name: 'Filter assignments by due date' }).click()
  await page.getByRole('option', { name: 'Due date set' }).click()
  await expect(page.getByRole('row', { name: /Locate an annotated surgical landmark/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /Inspect a measured source window/ })).toHaveCount(0)
})

test('embedded FiSaV evidence controls wrap inside the educator review column', async ({ page }) => {
  const assignmentId = 'assignment-fisav-preview'
  const digest = 'a'.repeat(64)
  await page.route('**/api/v1/auth/local-login', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'e2e-educator-session', user: { id: 'e2e-educator', display_name: 'Review educator', role: 'educator' } }),
  }))
  await page.route('**/api/v1/educator/assignments', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: assignmentId, lesson_version_id: 'version-001', lesson_title: 'Review FiSaV trace', cohort_id: 'cohort-001', due_at: null, student_count: 1 }]),
  }))
  await page.route(`**/api/v1/educator/assignments/${assignmentId}/attempts`, (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{
      attempt_id: 'attempt-fisav-preview', student_id: 'student-001', student_name: 'Learner One',
      state: 'review_required', submitted_at: '2026-10-10T08:30:00Z', score: null,
      observations: [], rubric_criteria: [{ id: 'evidence', title: 'Source evidence', description: 'Use the assigned measured trace.', max_points: 100 }],
      criterion_scores: [], assigned_case: { module: 'fistulaguard', case_id: 'fisav:pat001', case_label: 'FiSaV · pat001' },
      viewer_evidence: { kind: 'fistulaguard', case_id: 'fisav:pat001', record_id: 'pat001', channel: 'raw PZT2', start_sec: 2.5, duration_sec: 5 },
    }]),
  }))
  await page.route('**/api/v1/fistulaguard/records/pat001', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 'pat001', dataset_id: 'FiSaV', source_case_id: 'pat001', case_id: 'fisav:pat001', file_name: 'pat001.csv', source_sha256: digest, source_url: 'https://osf.io/hypfr/', sample_rate_hz: 10000, duration_sec: 30, channel_units: { 'raw PZT2': 'source-value' }, channels: ['raw PZT2'], sample_count: 300000, origin: 'measured-research-recording', limitations: [] }),
  }))
  await page.route('**/api/v1/fistulaguard/records/pat001/waveform**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ case_id: 'fisav:pat001', channel: 'raw PZT2', channel_unit: 'source-value', source_sha256: digest, source_sample_rate_hz: 10000, start_sec: 2.5, duration_sec: 4.9969, original_sample_count: 50000, samples: [{ time_sec: 2.5, value: 0.1 }, { time_sec: 7.4969, value: 0.2 }], method: 'Source-aligned measured samples.' }),
  }))
  await page.route('**/api/v1/fistulaguard/records/pat001/spectrum**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Not needed for control geometry.' }) }))
  await page.route('**/api/v1/fistulaguard/records/pat001/features**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Not needed for control geometry.' }) }))

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/educator/submissions?assignmentId=assignment-fisav-preview')
  await page.getByLabel('Username').fill('educator')
  await page.getByLabel('Password').fill('test-only-password')
  await page.getByRole('button', { name: 'Sign in as educator' }).click()
  await expect(page.getByRole('heading', { name: 'AVF multichannel signal review' })).toBeVisible()
  const desktop = await page.locator('.fistula-control-strip [data-slot="card-content"]').evaluate((element) => {
    const channel = element.querySelector('[aria-label="Signal channel"]')
    return { width: element.clientWidth, scrollWidth: element.scrollWidth, channelWidth: channel?.clientWidth ?? 0, channelScrollWidth: channel?.scrollWidth ?? 0 }
  })
  expect(desktop.width).toBeLessThan(700)
  expect(desktop.scrollWidth).toBeLessThanOrEqual(desktop.width + 1)
  expect(desktop.channelScrollWidth).toBeLessThanOrEqual(desktop.channelWidth + 1)
  await expect(page.getByText('PZT1', { exact: true })).toBeVisible()
  await expect(page.getByText('PZT2', { exact: true })).toBeVisible()
  await expect(page.getByText('PZT3', { exact: true })).toBeVisible()
  await expect(page.getByText('PZT4', { exact: true })).toBeVisible()
  await expect(page.getByText('Published rubric · 100 points')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  const phone = await page.locator('.fistula-control-strip [data-slot="card-content"]').evaluate((element) => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }))
  expect(phone.scrollWidth).toBeLessThanOrEqual(phone.width + 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('SurgiVision frame picker stays readable beside the professional sidebar at tablet width', async ({ page }) => {
  const playerFixture = await readFile('tests/e2e/fixtures/surgical-player-smoke.mp4')
  await page.setViewportSize({ width: 768, height: 1024 })
  const fixtureCase = (frame: number) => ({
    id: `endoscapes:test:162_${frame}`, module: 'surgivision', dataset_id: 'Endoscapes-BBox201',
    source_case_id: `video-162:frame-${frame}`, reference_kind: 'research', status: 'ready',
    label: `Endoscapes test · video 162 · frame ${frame}`,
  })
  await page.route('**/api/v1/cases', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([fixtureCase(6575), fixtureCase(7325)]),
  }))
  await page.route('**/api/v1/surgivision/frames/**', (route) => {
    if (route.request().url().endsWith('/image')) {
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="854" height="480"><rect width="854" height="480" fill="#101624"/></svg>' })
    }
    const frameNumber = route.request().url().includes('7325') ? 7325 : 6575
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: `endoscapes:test:162_${frameNumber}`, dataset_id: 'Endoscapes-BBox201', split: 'test', video_id: 162,
        frame_number: frameNumber, file_name: `162_${frameNumber}.jpg`, width: 854, height: 480,
        image_sha256: '0'.repeat(64), annotation_sha256: '1'.repeat(64),
        annotations: [{ id: 1, category_id: 1, category_name: 'tool', bbox: [20, 30, 80, 60], segmentation: null }],
        cvs_criteria: [0, 0, 0],
      }),
    })
  })
  await page.route('**/api/v1/surgivision/media/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'No video media fixture is installed.' }) }))
  await page.route('**/api/v1/surgivision/clips', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      clip_id: 'appendix300:fixture-clip', dataset_id: 'Appendix300',
      procedure_label: 'Laparoscopic appendectomy', media_kind: 'native_video',
      duration_sec: 38.1384, asset_uri: 'verified-local-fixture.mp4',
      source_url: 'https://example.org/source', license_label: 'fixture-only source license',
      citation: 'E2E fixture metadata; no research media is replaced.', sha256: 'a'.repeat(64),
      limitations: ['Separate procedure source; no Endoscapes overlays.'],
    }]),
  }))
  await page.route('**/api/v1/surgivision/clips/**/video', (route) => {
    const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? '')
    const start = range ? Number(range[1]) : 0
    const requestedEnd = range?.[2] ? Number(range[2]) : playerFixture.length - 1
    const end = Math.min(requestedEnd, playerFixture.length - 1)
    const headers = { 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1) }
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${playerFixture.length}`
    return route.fulfill({ status: range ? 206 : 200, headers, contentType: 'video/mp4', body: playerFixture.subarray(start, end + 1) })
  })
  await page.route('**/api/v1/surgivision/cvs-coverage', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Coverage fixture is not installed.' }) }))
  await page.route('**/api/v1/models/cvs-adaptnet/validate', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Checkpoint remains gated.' }) }))
  await page.route('**/api/v1/runs', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

  await page.goto('/studio/surgivision/cases/endoscapes%3Atest%3A162_6575')
  await expect(page.getByRole('heading', { name: 'SurgiVision surgical media review' })).toBeVisible()
  await expect(page.getByText(/no tool masks, triplets, phase labels or model output/i)).toBeVisible()
  const nativePlayer = page.locator('video[aria-label="Appendix300 Laparoscopic appendectomy source video"]')
  await expect(nativePlayer).toHaveAttribute('src', /appendix300%3Afixture-clip/)
  await expect.poll(() => nativePlayer.evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(1)
  await page.getByRole('button', { name: 'Play' }).click()
  await expect.poll(() => nativePlayer.evaluate((video: HTMLVideoElement) => video.paused)).toBe(false)
  await page.getByRole('tab', { name: 'Annotated stills' }).click()
  await expect(page.getByText('Frame review', { exact: false })).toBeVisible()
  const input = page.getByRole('combobox', { name: 'Jump to surgical frame by split, video, or frame number' })
  await input.fill('test 162')
  const popup = page.locator('[data-slot="combobox-content"]')
  await expect(popup).toBeVisible()
  await expect(page.getByRole('option')).toHaveCount(2)
  const geometry = await popup.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return { left: rect.left, right: rect.right, width: rect.width, background: style.backgroundColor, maxHeight: Number.parseFloat(style.maxHeight), scrollWidth: document.documentElement.scrollWidth }
  })
  expect(geometry.background).toBe('rgb(255, 255, 255)')
  expect(geometry.width).toBeGreaterThanOrEqual(240)
  expect(geometry.left).toBeGreaterThanOrEqual(0)
  expect(geometry.right).toBeLessThanOrEqual(768)
  expect(geometry.maxHeight).toBeLessThanOrEqual(320)
  expect(geometry.scrollWidth).toBeLessThanOrEqual(768)
  await mkdir('.local-review/FIX-01', { recursive: true })
  await page.screenshot({ path: '.local-review/FIX-01/surgi-picker-tablet-fixture-768x1024.png' })
  await input.fill('7325')
  await expect(page.getByRole('option', { name: /frame 7325/ })).toBeVisible()
  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(page).toHaveURL(/endoscapes%3Atest%3A162_7325/)
  await expect(page.getByLabel('Breadcrumb')).toContainText('video-162:frame-7325')
})

test('model lab filters source-linked methods and explains an execution gate', async ({ page }) => {
  const validationRequests: Array<{ model_id: string; case_id: string; operation_id: string }> = []
  await page.route('**/api/v1/cases', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { id: 'endoscapes:test:1', module: 'surgivision', dataset_id: 'Endoscapes-BBox201', source_case_id: 'video-1:frame-1', reference_kind: 'research-frame', status: 'ready', label: 'Endoscapes test · video 1 · frame 1' },
      { id: 'openkbp:test', module: 'dosetwin', dataset_id: 'OpenKBP', source_case_id: 'pt_201', reference_kind: 'benchmark', status: 'ready', label: 'OpenKBP test · pt_201' },
    ]),
  }))
  await page.route('**/api/v1/models/*/validate', async (route) => {
    const modelId = new URL(route.request().url()).pathname.split('/').at(-2) ?? ''
    const body = route.request().postDataJSON() as { case_id: string; operation_id: string }
    validationRequests.push({ model_id: modelId, case_id: body.case_id, operation_id: body.operation_id })
    const blockers = modelId === 'cvs-adaptnet'
      ? ['Verified checkpoint SHA-256 is missing.', 'Checkpoint-specific research terms need review.']
      : ['No installed and tested model adapter/checkpoint for this operation in reference harness']
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ model_id: modelId, executable: false, blockers }) })
  })
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

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/studio/models')
    await expect(page.getByRole('table')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/studio/models')
  await expect(page.getByText('2 source-linked methods')).toBeVisible()
  await page.getByRole('button', { name: 'Ready methods' }).click()
  await expect(page.getByText('No registered methods match this search and filter.')).toBeVisible()
  await page.getByRole('button', { name: 'Gated methods' }).click()
  await expect(page.getByRole('button', { name: /CVS-AdaptNet/ })).toBeVisible()
  await page.getByRole('button', { name: 'Check source-specific gate' }).click()
  await expect(page.getByRole('alert').getByText('Verified checkpoint SHA-256 is missing.')).toBeVisible()
  await expect(page.getByRole('combobox', { name: /Installed source case/ })).toContainText('Endoscapes test')
  await expect.poll(() => validationRequests.some((request) => request.model_id === 'cvs-adaptnet' && request.case_id === 'endoscapes:test:1' && request.operation_id === 'cvs.inference')).toBe(true)
  await page.getByRole('textbox', { name: 'Search model methods' }).fill('cvs.inference')
  await expect(page.getByRole('button', { name: /CVS-AdaptNet/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /OpenKBP prediction baseline/ })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Search model methods' }).fill('no registered method')
  await expect(page.getByText('No registered methods match this search and filter.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear all filters' }).click()
  await expect(page.getByRole('button', { name: /CVS-AdaptNet/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /OpenKBP prediction baseline/ })).toBeVisible()
  await page.getByRole('button', { name: 'All readiness states' }).click()
  await page.getByRole('button', { name: 'DoseTwin methods' }).click()
  await expect(page.getByRole('button', { name: /OpenKBP prediction baseline/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /CVS-AdaptNet/ })).toHaveCount(0)
  await expect(page.getByText('Prediction weights and runtime are not verified.')).toBeVisible()
  await page.getByRole('button', { name: 'Check source-specific gate' }).click()
  await expect(page.getByRole('alert').getByText('No installed and tested model adapter/checkpoint for this operation in reference harness')).toBeVisible()
  await expect.poll(() => validationRequests.some((request) => request.model_id === 'openkbp-baseline' && request.case_id === 'openkbp:test' && request.operation_id === 'dose.prediction')).toBe(true)
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
  await page.route('**/dose-artifacts', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

  await page.goto('/studio/dosetwin/cases/current')
  await expect(page.getByRole('heading', { name: 'Linked dose review' })).toBeVisible()
  await expect(page.getByText('Dose prediction inference')).toBeVisible()
  await expect(page.getByRole('row', { name: /Dose prediction inference.*Blocked/ })).toBeVisible()
  const dock = page.getByRole('region', { name: 'DoseTwin measurements and evidence' })
  await expect(dock.getByRole('tab', { name: 'Measurements' })).toBeVisible()
  await expect(dock.getByRole('tab', { name: 'Comparison' })).toBeVisible()
  await expect(dock.getByRole('tab', { name: 'Source evidence' })).toBeVisible()
  const voxelSample = page.getByRole('region', { name: 'Selected voxel source sample' })
  await expect(voxelSample).toContainText('0.5000')
  await expect(voxelSample).toContainText('40.0000')
  await expect(voxelSample).toContainText('Brainstem: inside mask')
  await dock.getByRole('tab', { name: 'Comparison' }).click()
  await expect(page.getByText('No compatible second array is installed.')).toBeVisible()
  await expect(page.getByText('Preparation access required')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in as educator or admin' })).toBeVisible()
  await expect(page.getByLabel('Choose an authentic dose prediction CSV')).toHaveCount(0)
  await expect(page.getByText('The feature never creates a placeholder result.')).toBeVisible()
  await dock.getByRole('tab', { name: 'Measurements' }).click()
  await dock.getByRole('tab', { name: 'Source evidence' }).click()
  await expect(page.getByText('0–80.0 Gy')).toBeVisible()
  await dock.getByRole('tab', { name: 'Measurements' }).click()
  const sourceViewport = page.getByRole('group', { name: /Z-index plane imaging viewport/ })
  const primaryPane = page.locator('section[aria-labelledby="dose-view-title"]')
  const paneWidth = await primaryPane.evaluate(element => element.getBoundingClientRect().width)
  const imageWidth = await page.getByRole('img', { name: /OpenKBP processed-array z-index plane/ }).evaluate(element => element.getBoundingClientRect().width)
  expect(imageWidth).toBeGreaterThan(paneWidth * 0.5)
  await sourceViewport.getByRole('button', { name: 'View fullscreen' }).click()
  await expect.poll(() => sourceViewport.evaluate(element => document.fullscreenElement === element)).toBe(true)
  await sourceViewport.getByRole('button', { name: 'Exit fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true)
  await page.getByRole('checkbox', { name: 'PTV63' }).check()
  await page.getByRole('checkbox', { name: 'PTV70' }).check()
  await expect(page.getByText('3 selected · structure colors stay fixed across slices.')).toBeVisible()
  await expect(page.getByRole('row', { name: /Brainstem/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /PTV63/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /PTV70/ })).toBeVisible()
  await dock.getByRole('tab', { name: 'Source evidence' }).click()
  await expect(page.getByText('OpenKBP reference arrays', { exact: true })).toBeVisible()
  await expect(page.getByText('computed-from-synthetic-test-', { exact: false })).toBeVisible()
  await dock.getByRole('tab', { name: 'Measurements' }).click()

  await sourceViewport.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByLabel('Z index', { exact: true }).first()).toHaveValue('65')
  const viewportBounds = await sourceViewport.boundingBox()
  if (!viewportBounds) throw new Error('DoseTwin source viewport is not positioned')
  await page.mouse.move(viewportBounds.x + viewportBounds.width / 2, viewportBounds.y + viewportBounds.height / 2)
  await page.mouse.wheel(0, 100)
  await expect(page.getByLabel('Z index', { exact: true }).first()).toHaveValue('66')
  await sourceViewport.focus()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(page.getByLabel('Z index', { exact: true }).first()).toHaveValue('64')
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.getByText('125%', { exact: true })).toBeVisible()
  const panToggle = page.getByRole('button', { name: 'Pan', exact: true })
  await panToggle.click()
  await expect(panToggle).toHaveAttribute('aria-pressed', 'true')
  const viewport = page.getByRole('img', { name: /OpenKBP processed-array z-index plane/ })
  const bounds = await viewport.boundingBox()
  if (!bounds) throw new Error('DoseTwin source viewport is not positioned')
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 + 40, bounds.y + bounds.height / 2 + 25)
  await page.mouse.up()
  await panToggle.click()
  await expect(panToggle).toHaveAttribute('aria-pressed', 'false')
  const movedBounds = await viewport.boundingBox()
  if (!movedBounds) throw new Error('DoseTwin source viewport disappeared after pan')
  await page.mouse.click(movedBounds.x + movedBounds.width * 0.76, movedBounds.y + movedBounds.height * 0.26)
  await expect(page.locator('#dose-coordinate-0')).toHaveValue('33')
  await expect(page.locator('#dose-coordinate-1')).toHaveValue('97')
  let planeImage = page.getByRole('img', { name: /OpenKBP processed-array z-index plane/ })
  for (const [planeName, expected] of [
    ['X index', ['33', '65', '65']],
    ['Y index', ['65', '65', '65']],
  ] as const) {
    await page.getByRole('button', { name: planeName }).click()
    planeImage = page.getByRole('img', { name: new RegExp(`OpenKBP processed-array ${planeName[0].toLowerCase()}-index plane`) })
    await expect(planeImage).toHaveAttribute('aria-label', new RegExp(`${planeName[0].toLowerCase()}-index plane`))
    await planeImage.scrollIntoViewIfNeeded()
    const box = await planeImage.boundingBox()
    if (!box) throw new Error(`${planeName} source plane is not positioned`)
    const point = { x: box.x + box.width * 0.51, y: box.y + box.height * 0.51 }
    await page.mouse.click(point.x, point.y)
    for (let axis = 0; axis < 3; axis++) await expect(page.getByLabel(['X index', 'Y index', 'Z index'][axis], { exact: true }).last()).toHaveValue(expected[axis])
  }
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.getByRole('button', { name: 'Z index' }).click()
  planeImage = page.getByRole('img', { name: /OpenKBP processed-array z-index plane/ })
  const tabletBox = await planeImage.boundingBox()
  if (!tabletBox) throw new Error('DoseTwin tablet source plane is not positioned')
  await page.mouse.click(tabletBox.x + tabletBox.width * 0.51, tabletBox.y + tabletBox.height * 0.51)
  await expect(page.getByLabel('X index', { exact: true }).last()).toHaveValue('65')
  await expect(page.getByLabel('Y index', { exact: true }).last()).toHaveValue('65')
  const orthogonalViews = page.getByRole('region', { name: 'Linked orthogonal views' })
  await expect(orthogonalViews).toBeVisible()
  await expect(orthogonalViews.getByRole('group', { name: /imaging viewport/ })).toHaveCount(2)
  const secondaryY = orthogonalViews.getByRole('img', { name: /OpenKBP processed-array y-index plane/ })
  await expect(secondaryY).toBeVisible()
  await secondaryY.scrollIntoViewIfNeeded()
  const secondaryYBounds = await secondaryY.boundingBox()
  if (!secondaryYBounds) throw new Error('DoseTwin Y-index dock view is not positioned')
  // Target the center of source cell column 33 / row 97. A 26% boundary-adjacent
  // point can round to the preceding CSS pixel before the browser dispatches it.
  await page.mouse.click(secondaryYBounds.x + secondaryYBounds.width * (33.5 / 128), secondaryYBounds.y + secondaryYBounds.height * (97.5 / 128))
  await expect(page.locator('#dose-coordinate-0')).toHaveValue('97')
  await expect(page.locator('#dose-coordinate-1')).toHaveValue('65')
  await expect(page.locator('#dose-coordinate-2')).toHaveValue('33')
  await expect(page.locator('#dose-axis-2')).toHaveValue('33')
  await expect(orthogonalViews.getByRole('img', { name: /x-index plane at x index 97/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('group', { name: /Z-index plane imaging viewport/ })).toBeVisible()
  await expect(orthogonalViews.getByRole('group', { name: /imaging viewport/ })).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await mkdir('.local-review/DOSETWIN-LINKED-MPR-FIXTURE', { recursive: true })
  await page.screenshot({ path: '.local-review/DOSETWIN-LINKED-MPR-FIXTURE/phone.png', fullPage: true })
  expect(errors).toEqual([])
})

test('DoseTwin reconstructs the selected sparse source mask and falls back at phone width', async ({ page }) => {
  const errors: string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  const caseId='openkbp:surface-fixture'
  await page.route('**/api/v1/cases',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:caseId,module:'dosetwin',dataset_id:'OpenKBP',source_case_id:'surface-fixture',reference_kind:'benchmark',status:'ready',label:'OpenKBP geometry fixture'}])}))
  await page.route('**/viewer/slice*',route=>{
    const url=new URL(route.request().url()),layer=url.searchParams.get('layer'),roi=url.searchParams.get('roi')??'Brainstem'
    const values=new Array(128*128).fill(layer==='ct'?.5:0)
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({case_id:caseId,source_revision:'fixture-revision',source_file:`${roi}.csv`,source_sha256:'a'.repeat(64),axis:Number(url.searchParams.get('axis')??2),index:Number(url.searchParams.get('index')??64),shape:[128,128],values,unit:layer==='dose'?'Gy':layer==='roi'?'binary-mask':'benchmark-value',source_kind:'synthetic-test',origin:'synthetic-test-fixture',coordinate_frame:'openkbp-processed-voxel-grid'})})
  })
  await page.route('**/viewer/dvh*',route=>{
    const roi=new URL(route.request().url()).searchParams.get('roi')??'Brainstem'
    const curve=Array.from({length:51},(_,index)=>({dose_gy:index,volume_percent:index<25?100:0}))
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({case_id:caseId,source_revision:'fixture-revision',roi,dose_sha256:'b'.repeat(64),roi_sha256:'c'.repeat(64),voxel_count:2,mean_dose_gy:1,dose_display_max_gy:50,spacing_mm:[5.422,5.422,3],ct_display_range:[0,1],ct_display_note:'Fixture window; not HU.',official_metrics:{volume_cc:1,dmean_gy:1,dmax_voxel_gy:2,d95_gy_interpolated:1,d0_1cc_gy_openkbp:2,d99_gy_openkbp:1,d1_gy_openkbp:2,v20gy_percent:0,note:'Fixture.'},curve,method:'Fixture curve.',source_kind:'synthetic-test',origin:'computed-from-synthetic-test-fixture'})})
  })
  await page.route('**/viewer/roi-volume*',route=>{
    const url=new URL(route.request().url()),roi=url.searchParams.get('roi')??'Brainstem'
    const points=roi==='Brainstem'?[[5,9,11],[6,9,11]]:[[20,30,40],[21,30,40]]
    const voxel_indices_c_order=points.map(([x,y,z])=>x*128*128+y*128+z)
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({case_id:caseId,source_revision:'fixture-revision',source_file:`${roi}.csv`,source_sha256:'d'.repeat(64),shape:[128,128,128],spacing_mm:[5.422,5.422,3],voxel_count:2,voxel_indices_c_order,source_kind:'synthetic-test',origin:'computed-from-synthetic-test-fixture',coordinate_frame:'openkbp-processed-voxel-grid',index_convention:'x-major-y-middle-z-fastest'})})
  })
  await page.setViewportSize({width:1440,height:1000})
  await page.goto('/studio/dosetwin/cases/current')
  await page.getByText('Open 3D view',{exact:true}).click()
  const bounds=page.getByTestId('dosetwin-3d-bounds')
  await expect(bounds).toContainText('24.40, 35.24')
  await expect(page.getByText('2 source mask voxels')).toBeVisible()
  await page.getByLabel('Structure to reconstruct').selectOption('PTV70')
  await expect(page.getByText('Reconstruct PTV70 from its verified mask, linked to the active 2D structure selection.')).toBeVisible()
  await expect(page.getByTestId('dosetwin-3d-viewport')).toHaveAttribute('aria-label','PTV70 reconstructed 3D surface viewport')
  await expect(bounds).toContainText('105.73, 116.57')
  await page.getByRole('button',{name:'Visible'}).click()
  await expect(page.getByRole('button',{name:'Hidden'})).toHaveAttribute('aria-pressed','false')
  await page.setViewportSize({width:390,height:844})
  await expect(page.getByText(/3D rendering is paused on this narrow screen/)).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(errors).toEqual([])
})

test('DoseTwin case picker opens a separately enabled case and its case-bound comparison workspace', async ({ page }) => {
  const readyCaseId = 'openkbp:pt_201'
  const secondCaseId = 'openkbp:pt_241'
  const records = [
    { id: readyCaseId, module: 'dosetwin', dataset_id: 'OpenKBP', source_case_id: 'pt_201', reference_kind: 'benchmark', status: 'ready', label: 'OpenKBP · pt_201' },
    { id: secondCaseId, module: 'dosetwin', dataset_id: 'OpenKBP', source_case_id: 'pt_241', reference_kind: 'benchmark', status: 'ready', label: 'OpenKBP · pt_241' },
  ]
  const artifactRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/dose-artifacts')) artifactRequests.push(request.url())
  })
  await page.route('**/api/v1/cases', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(records),
  }))
  await page.route('**/viewer/slice*', (route) => {
    const url = new URL(route.request().url())
    const caseId = url.pathname.includes('pt_241') ? secondCaseId : readyCaseId
    const layer = url.searchParams.get('layer')
    const roi = url.searchParams.get('roi') ?? 'Brainstem'
    const values = new Array(128 * 128).fill(layer === 'ct' ? 0.5 : 0)
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      case_id: caseId, source_revision: `${caseId}-revision`, source_file: `${roi}.csv`, source_sha256: 'a'.repeat(64),
      axis: Number(url.searchParams.get('axis') ?? 2), index: Number(url.searchParams.get('index') ?? 64), shape: [128, 128], values,
      unit: layer === 'dose' ? 'Gy' : layer === 'roi' ? 'binary-mask' : 'benchmark-value', source_kind: 'synthetic-test',
      origin: 'synthetic-test-fixture', coordinate_frame: 'openkbp-processed-voxel-grid',
    }) })
  })
  await page.route('**/viewer/dvh*', (route) => {
    const url = new URL(route.request().url())
    const caseId = url.pathname.includes('pt_241') ? secondCaseId : readyCaseId
    const roi = url.searchParams.get('roi') ?? 'Brainstem'
    const curve = Array.from({ length: 51 }, (_, index) => ({ dose_gy: index * 1.6, volume_percent: index < 25 ? 100 : 0 }))
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      case_id: caseId, source_revision: `${caseId}-revision`, roi, dose_sha256: 'b'.repeat(64), roi_sha256: 'c'.repeat(64),
      voxel_count: 2, mean_dose_gy: 55, dose_display_max_gy: 80, spacing_mm: [3.906, 3.906, 2.5], ct_display_range: [0, 1],
      ct_display_note: 'Fixture window; not HU.',
      official_metrics: { volume_cc: 1, dmean_gy: 55, dmax_voxel_gy: 70, d95_gy_interpolated: 40, d0_1cc_gy_openkbp: 70, d99_gy_openkbp: 40, d1_gy_openkbp: 70, v20gy_percent: 100, note: 'Fixture only.' },
      curve, method: 'Fixture curve.', source_kind: 'synthetic-test', origin: 'computed-from-synthetic-test-fixture',
    }) })
  })
  await page.route('**/dose-artifacts**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

  await page.goto('/studio/dosetwin/cases/current')
  await expect(page.getByRole('heading', { name: 'Linked dose review' })).toBeVisible()
  const primaryRoi = page.getByRole('combobox', { name: 'Primary structure' })
  await primaryRoi.click()
  await page.getByRole('option', { name: 'PTV70', exact: true }).click()
  await page.getByLabel('DoseTwin source case').click()
  await page.getByRole('option', { name: /pt_241.*comparison available/i }).click()

  await expect(page).toHaveURL(/\/studio\/dosetwin\/cases\/openkbp%3Apt_241$/)
  await expect(page.getByRole('heading', { name: 'Linked dose review' })).toBeVisible()
  await expect(page.getByText('Read-only source viewer', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Source configured', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: /OpenKBP processed-array z-index plane/ })).toBeVisible()
  await page.getByRole('tab', { name: 'Comparison' }).click()
  await expect(page.getByText('Compare a real dose prediction', { exact: true })).toBeVisible()
  await expect(page.getByText('No compatible second array is installed.', { exact: true })).toBeVisible()
  await expect(page.getByText('Preparation access required')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in as educator or admin' })).toBeVisible()
  await expect(page.getByLabel('Choose an authentic dose prediction CSV')).toHaveCount(0)
  expect(artifactRequests.some((url) => url.includes('/openkbp%3Apt_241/dose-artifacts'))).toBe(true)
  await expect(primaryRoi).toContainText('Brainstem')

  await page.getByLabel('DoseTwin source case').click()
  await page.getByRole('option', { name: /pt_201/ }).click()
  await expect(page).toHaveURL(/\/studio\/dosetwin\/cases\/openkbp%3Apt_201$/)
  await expect(page.getByRole('combobox', { name: 'Primary structure' })).toContainText('PTV70')
  expect(artifactRequests.some((url) => url.includes('/openkbp%3Apt_201/dose-artifacts'))).toBe(true)
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
