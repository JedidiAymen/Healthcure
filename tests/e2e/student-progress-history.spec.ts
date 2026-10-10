import { expect, test } from '@playwright/test'

const reviewedAt = '2026-10-10 13:09:38'
const history = [
  {
    id: 'attempt-one:evidence',
    attempt_id: 'attempt-one',
    dimension_id: 'evidence',
    dimension_title: 'Evidence use',
    lesson_title: 'Read a measured vascular-access signal',
    reviewed_at: reviewedAt,
    earned_points: 52,
    available_points: 60,
    percent: 86.7,
  },
  {
    id: 'attempt-two:evidence',
    attempt_id: 'attempt-two',
    dimension_id: 'evidence',
    dimension_title: 'Evidence use',
    lesson_title: 'Read a measured vascular-access signal',
    reviewed_at: reviewedAt,
    earned_points: 55,
    available_points: 60,
    percent: 91.7,
  },
  {
    id: 'attempt-one:limits',
    attempt_id: 'attempt-one',
    dimension_id: 'limits',
    dimension_title: 'Limits and uncertainty',
    lesson_title: 'Read a measured vascular-access signal',
    reviewed_at: reviewedAt,
    earned_points: 36,
    available_points: 40,
    percent: 90,
  },
  {
    id: 'attempt-two:limits',
    attempt_id: 'attempt-two',
    dimension_id: 'limits',
    dimension_title: 'Limits and uncertainty',
    lesson_title: 'Read a measured vascular-access signal',
    reviewed_at: reviewedAt,
    earned_points: 38,
    available_points: 40,
    percent: 95,
  },
]

test('rubric history keeps same-second reviews separate and arrow-key inspectable', async ({ page }) => {
  await page.route('**/api/v1/auth/local-login', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      access_token: 'review-session',
      token_type: 'bearer',
      expires_at: '2026-10-10T21:00:00Z',
      user: { id: 'review-student', display_name: 'Review student', role: 'student' },
    }),
  }))
  await page.route('**/api/v1/academy/progress', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      xp: 20,
      xp_enabled: true,
      achievements_enabled: true,
      graded_attempts: 2,
      average_score: 90.5,
      assigned_activities: 2,
      next_activity: null,
      rubric_dimensions: [
        { id: 'evidence', title: 'Evidence use', description: 'Use source evidence.', attempts: 2, earned_points: 107, available_points: 120, average_percent: 89.2 },
        { id: 'limits', title: 'Limits and uncertainty', description: 'State source limits.', attempts: 2, earned_points: 74, available_points: 80, average_percent: 92.5 },
      ],
      rubric_history: history,
      achievements: [{ key: 'first-evidence-investigation', title: 'First Evidence Investigation', description: 'Completed a source-backed investigation reviewed by an educator.', earned_at: '2026-10-10T13:09:38Z' }],
    }),
  }))

  await page.goto('/academy/progress')
  await page.getByLabel('Username').fill('review-student')
  await page.getByLabel('Password').fill('temporary-review-password')
  await page.getByRole('button', { name: 'Sign in as student' }).click()
  await expect(page.getByRole('heading', { name: 'First Evidence Investigation' })).toBeVisible()

  const chart = page.getByRole('application', { name: /Educator-reviewed rubric history.*Evidence use/ })
  await expect(chart).toBeVisible()
  const ticks = chart.locator('..').locator('.recharts-cartesian-axis-tick-value')
  await expect(ticks).toHaveText([/ #1$/, / #2$/, '0%', '25%', '50%', '75%', '100%'])

  await chart.focus()
  const tooltip = page.locator('.recharts-tooltip-wrapper [role="status"]')
  await expect(tooltip).toContainText('review 1')
  await expect(tooltip).toContainText('86.7%')
  await chart.press('ArrowRight')
  await expect(tooltip).toContainText('review 2')
  await expect(tooltip).toContainText('91.7%')

  const criterion = page.getByRole('combobox', { name: 'Coursework criterion' })
  await criterion.focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('application', { name: /Educator-reviewed rubric history.*Limits and uncertainty/ })).toBeVisible()
})
