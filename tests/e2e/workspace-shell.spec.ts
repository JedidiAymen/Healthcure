import { expect, test } from '@playwright/test'

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

  await page.goto('/educator/cases/new/edit')
  await page.getByLabel('Username').fill('educator')
  await page.getByLabel('Password').fill('test-only-password')
  await page.getByRole('button', { name: 'Sign in as educator' }).click()
  await expect(page.getByRole('heading', { name: 'Compose an evidence lesson' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Research source and lesson blocks' })).toBeAttached()
  await expect(page.getByRole('complementary', { name: 'Learner-safe lesson preview' })).toBeAttached()
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
