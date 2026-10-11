import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const learner = { id: 'fix10-expired-path-ui-fixture', display_name: 'Academy UI review', role: 'student' }
const screenshotDir = '.local-review/ACADEMY-FIX-10'
const dueAt = new Date(Date.now() - 60_000).toISOString()
const pathFixture = [{
  path_id: 'radiation-physics',
  title: 'Radiation Physics',
  module: 'dosetwin',
  description: 'Inspect benchmark dose and structure evidence using source units and index-space views.',
  objectives: ['Relate a benchmark dose grid to its supplied CT and structure masks.', 'Distinguish benchmark reference data from an approved treatment plan.'],
  prerequisites: 'No prerequisites are currently configured for assigned lessons.',
  limitation_notice: 'This UI fixture does not contain clinical or benchmark evidence.',
  assigned_count: 1,
  in_progress_count: 0,
  submitted_count: 0,
  reviewed_count: 0,
  lessons: [{
    assignment_id: 'fix10-expired-assignment-fixture',
    case_id: 'ui-fixture-only',
    title: 'Expired assignment UI fixture',
    version: 1,
    case_label: 'UI review fixture · no research case',
    source_license: 'UI-only fixture; no research source',
    due_at: dueAt,
    state: 'not_started',
  }],
  source_attribution: ['UI review fixture · no research source'],
}]

test('expired assignment stays readable across Academy viewport sizes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/v1/auth/local-login', route => route.fulfill({
    json: { access_token: 'fixture-token', token_type: 'bearer', expires_at: new Date(Date.now() + 3_600_000).toISOString(), user: learner },
  }))
  await page.route('**/api/v1/academy/paths', route => route.fulfill({ json: pathFixture }))

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/academy/paths/radiation-physics')
  await page.getByLabel('Username').fill('ui-fixture')
  await page.getByLabel('Password').fill('ui-fixture-only')
  await page.getByRole('button', { name: 'Sign in as student' }).click()

  const title = page.getByRole('heading', { name: 'Expired assignment UI fixture' })
  await expect(title).toBeVisible()
  await expect(page.getByText('Closed', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Assignment closed' })).toBeDisabled()
  await expect(page.getByText('The due date passed. Ask your educator if this lesson should be reopened.')).toBeVisible()

  await mkdir(screenshotDir, { recursive: true })
  for (const viewport of [
    { width: 1440, height: 1000, name: 'desktop', columns: 2, minimumTitleWidth: 100 },
    { width: 768, height: 1024, name: 'tablet', columns: 1, minimumTitleWidth: 250 },
    { width: 390, height: 844, name: 'mobile', columns: 1, minimumTitleWidth: 170 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.evaluate(() => document.fonts.ready)
    const layout = await title.evaluate(element => {
      const content = element.closest('[data-slot="card-content"]')
      const titleColumn = element.parentElement
      return {
        columns: content ? getComputedStyle(content).gridTemplateColumns.trim().split(/\s+/).length : 0,
        titleWidth: titleColumn?.getBoundingClientRect().width ?? 0,
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }
    })
    expect(layout.columns).toBe(viewport.columns)
    expect(layout.titleWidth).toBeGreaterThan(viewport.minimumTitleWidth)
    expect(layout.document).toBe(layout.viewport)
    expect(layout.body).toBe(layout.viewport)
    await page.screenshot({ path: `${screenshotDir}/academy-path-${viewport.name}.png`, fullPage: true, animations: 'disabled' })
  }
  expect(errors).toEqual([])
})
