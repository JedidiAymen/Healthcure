import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const learner = { id: 'student-mission-keyboard-qa', display_name: 'Academy QA', role: 'student' }
const assignmentId = 'assignment-keyboard-review-fixture'
const attemptId = 'attempt-keyboard-review-fixture'

test('learner can complete the source-backed investigation flow from the keyboard', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))

  // The assignment and learner identity are isolated UI fixtures. Scientific
  // signal, checksum, waveform, features and spectrum load from the real local
  // FiSaV pat001 installation through the running API.
  await page.route('**/api/v1/auth/local-login', route => route.fulfill({
    json: { access_token: 'qa-token', token_type: 'bearer', expires_at: '2026-10-10T21:00:00Z', user: learner },
  }))
  await page.route('**/api/v1/academy/progress', route => route.fulfill({
    json: { xp: 0, xp_enabled: false, achievements_enabled: false, graded_attempts: 0, average_score: null, assigned_activities: 1, next_activity: null, rubric_dimensions: [], rubric_history: [], achievements: [] },
  }))
  const attempt = {
    attempt_id: attemptId,
    assignment_id: assignmentId,
    state: 'started',
    revision: 1,
    challenge: {
      title: 'Describe a measured vascular signal',
      module: 'fistulaguard',
      case_id: 'fisav:pat001',
      case_label: 'FiSaV pat001',
      dataset_id: 'FiSaV',
      reference_kind: 'educator_review',
      source_license: 'CC BY 4.0',
      blocks: [
        { id: 'observe-signal', type: 'Question', title: 'What is visible?', content: 'Describe one pattern you can point to in the selected source window.' },
        { id: 'signal-limits', type: 'Question', title: 'What remains uncertain?', content: 'Name a limitation that the waveform alone cannot resolve.' },
      ],
    },
    observations: [],
    viewer_evidence: null,
  }
  let submittedAttempt = structuredClone(attempt)
  await page.route('**/api/v1/academy/attempts', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    await route.fulfill({ json: attempt })
  })
  await page.route(`**/api/v1/academy/attempts/${attemptId}/draft`, async route => {
    const body = route.request().postDataJSON() as { expected_revision: number; observations: { block_id: string; response: string }[]; viewer_evidence: unknown }
    expect(body.expected_revision).toBe(1)
    submittedAttempt = { ...attempt, revision: 2, observations: body.observations, viewer_evidence: body.viewer_evidence }
    await route.fulfill({ json: submittedAttempt })
  })
  await page.route(`**/api/v1/academy/attempts/${attemptId}/submit`, async route => {
    expect(route.request().headers()['idempotency-key']).toBeTruthy()
    await route.fulfill({ json: { attempt_id: attemptId, state: 'review_required', submitted_at: '2026-10-10T14:00:00Z' } })
  })
  await page.route(`**/api/v1/academy/attempts/${attemptId}`, async route => {
    await route.fulfill({ json: { ...submittedAttempt, state: 'review_required' } })
  })

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`/academy/missions/${assignmentId}`)
  await expect(page.getByText('Student sign in', { exact: true })).toBeVisible()
  await page.getByLabel('Username').fill('academy-qa')
  await page.getByLabel('Password').fill('test-only')
  await page.getByRole('button', { name: 'Sign in as student' }).press('Enter')

  await expect(page.getByRole('heading', { name: 'Describe a measured vascular signal' })).toBeVisible()
  const steps = page.getByRole('navigation', { name: 'Investigation steps' })
  for (const label of ['Brief', 'Explore evidence', 'Observe', 'Explain', 'Submit']) {
    const link = steps.getByRole('link', { name: new RegExp(label) })
    await link.press('Enter')
    await expect(page).toHaveURL(new RegExp(`#mission-${label === 'Brief' ? 'brief' : label === 'Explore evidence' ? 'explore' : label.toLowerCase()}`))
  }

  const submit = page.getByRole('button', { name: 'Submit for educator review' })
  await expect(submit).toBeDisabled()
  const waveform = page.getByRole('img', { name: /source waveform/ })
  await expect(waveform).toBeVisible()
  await expect(page.getByText(/Checksum verified/)).toBeVisible()
  await expect(page.getByText(/50,000 source samples/).first()).toBeVisible()

  const channels = page.getByRole('group', { name: 'Signal channel' })
  await channels.getByRole('button', { name: 'PZT1', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(channels.getByRole('button', { name: 'PZT2', exact: true })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(waveform).toHaveAttribute('aria-label', /raw PZT2 source waveform/)
  await expect(page.locator('#mission-observe').getByText('Evidence selected', { exact: true })).toBeVisible()

  await page.getByLabel('Your observation').nth(0).fill('The selected five-second source window contains a varying raw PZT2 trace.')
  await page.getByLabel('Your observation').nth(1).fill('The source values have no stated physical unit, so this window cannot establish clinical adequacy.')
  await expect(submit).toBeEnabled()
  await page.getByRole('link', { name: /Submit/ }).press('Enter')
  await page.getByRole('button', { name: 'Submit for educator review' }).press('Enter')

  await expect(page.getByText('Submission received', { exact: true })).toBeVisible()
  await expect(page.getByText(/PZT2 · 0\.0–5\.0 s/)).toBeVisible()
  expect(submittedAttempt.observations).toHaveLength(2)
  expect(submittedAttempt.viewer_evidence).toMatchObject({ kind: 'fistulaguard', record_id: 'pat001', channel: 'raw PZT2' })

  const screenshotDir = '.local-review/ACADEMY-MISSION-KEYBOARD-QA-FIXTURE'
  await mkdir(screenshotDir, { recursive: true })
  for (const viewport of [{ width: 1440, height: 1000, name: 'desktop' }, { width: 768, height: 1024, name: 'tablet' }, { width: 390, height: 844, name: 'phone' }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(dimensions.scrollWidth).toBe(dimensions.width)
    await page.screenshot({ path: `${screenshotDir}/mission-${viewport.name}.png`, fullPage: true, animations: 'disabled' })
  }
  expect(errors).toEqual([])
})
