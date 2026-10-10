import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const learner = { id: 'student-award-review-qa', display_name: 'Academy QA', role: 'student' }
const award = {
  key: 'first-evidence-investigation',
  title: 'First Evidence Investigation',
  description: 'Completed a first source-backed investigation reviewed by an educator.',
  earned_at: '2026-10-10T13:00:00Z',
}

test('announces a server-backed opted-in activity award once for the signed-in learner', async ({ page }) => {
  // This browser test isolates the presentation/once-only behavior. Award issuance,
  // opt-in enforcement and review idempotency are covered by the API contract suite.
  await page.route('**/api/v1/auth/local-login', route => route.fulfill({
    json: { access_token: 'qa-token', token_type: 'bearer', expires_at: '2026-10-10T21:00:00Z', user: learner },
  }))
  await page.route('**/api/v1/academy/progress', route => route.fulfill({
    json: {
      xp: 10,
      xp_enabled: true,
      achievements_enabled: true,
      graded_attempts: 1,
      average_score: 90,
      assigned_activities: 1,
      next_activity: null,
      rubric_dimensions: [],
      rubric_history: [],
      achievements: [award],
    },
  }))

  const signIn = async () => {
    await expect(page.getByText('Student sign in', { exact: true })).toBeVisible()
    await page.getByLabel('Username').fill('academy-qa')
    await page.getByLabel('Password').fill('test-only')
    await page.getByRole('button', { name: 'Sign in as student' }).click()
  }

  const screenshotDir = '.local-review/ACADEMY-AWARD-ANNOUNCEMENT-QA-FIXTURE'
  await mkdir(screenshotDir, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/academy/progress')
  await signIn()
  await expect(page.getByText('Achievement Unlocked', { exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'First Evidence Investigation' })).toBeVisible()
  const desktopDimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  expect(desktopDimensions.scrollWidth).toBe(desktopDimensions.width)
  await page.screenshot({ path: `${screenshotDir}/announcement-desktop.png`, fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Dismiss First Evidence Investigation announcement' }).click()
  await expect(page.getByText('Achievement Unlocked', { exact: true })).toHaveCount(0)

  // SPA route changes and a fresh document load must not replay the same grant.
  await page.getByRole('link', { name: 'Return to assignments' }).click()
  await expect(page.getByRole('heading', { name: 'Learn to read the evidence.' })).toBeVisible()
  await expect(page.getByText('Achievement Unlocked', { exact: true })).toHaveCount(0)
  await page.goto('/academy/progress')
  await signIn()
  await expect(page.getByRole('heading', { name: 'Your learning record' })).toBeVisible()
  await expect(page.getByText('Achievement Unlocked', { exact: true })).toHaveCount(0)

  for (const viewport of [{ width: 768, height: 1024, name: 'tablet' }, { width: 390, height: 844, name: 'phone' }]) {
    await page.evaluate(() => localStorage.clear()) // fresh QA fixture grant for the next viewport capture
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto(`/academy/progress?capture=${viewport.name}`)
    await signIn()
    await expect(page.getByText('Achievement Unlocked', { exact: true })).toBeVisible()
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(dimensions.scrollWidth).toBe(dimensions.width)
    await page.screenshot({ path: `${screenshotDir}/announcement-${viewport.name}.png`, fullPage: true, animations: 'disabled' })
  }
})
