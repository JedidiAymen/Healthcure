import { expect, test } from '@playwright/test'

// Compliance row 20: validating a learner review takes at most 3 interactions in the common case.
// Synthetic learner, assignment and rubric; the grade route's server rules are covered by the API suite.
const educator = { id: 'educator-steps-qa', display_name: 'Steps QA', role: 'educator' }
const criteria = [
  { id: 'c1', title: 'Identifies the structure', description: 'Names the reviewed structure.', max_points: 40 },
  { id: 'c2', title: 'Cites the evidence', description: 'Points to the source value.', max_points: 35 },
  { id: 'c3', title: 'States the limit', description: 'Names one limit of the evidence.', max_points: 25 },
]
const attempt = {
  attempt_id: 'attempt-steps-1', student_id: 'learner-1', student_name: 'Synthetic Learner', state: 'review_required',
  submitted_at: '2026-10-10T12:00:00Z', score: null, observations: [{ block_id: 'b1', response: 'Synthetic response for the step-count test.' }],
  rubric_criteria: criteria, criterion_scores: [], viewer_evidence: null, assigned_case: null, cvs_self_checks: [],
}

test('educator validates a review in 3 steps with the full-marks prefill', async ({ page }) => {
  let posted: { criterion_scores: { criterion_id: string; earned_points: number }[]; feedback: string; reason: string } | null = null
  await page.route('**/api/v1/auth/local-login', route => route.fulfill({ json: { access_token: 'qa-token', token_type: 'bearer', expires_at: '2026-10-10T21:00:00Z', user: educator } }))
  await page.route('**/api/v1/educator/assignments', route => route.fulfill({ json: [{ id: 'assignment-1', lesson_version_id: 'v1', lesson_title: 'Synthetic lesson', cohort_id: 'cohort-1', due_at: null, student_count: 1 }] }))
  await page.route('**/api/v1/educator/assignments/assignment-1/attempts', route => route.fulfill({ json: [posted ? { ...attempt, state: 'graded', score: 100 } : attempt] }))
  await page.route('**/api/v1/educator/attempts/attempt-steps-1/grade', route => { posted = route.request().postDataJSON(); return route.fulfill({ json: { ...attempt, state: 'graded', score: 100 } }) })

  await page.goto('/educator/submissions')
  await page.getByLabel('Username').fill('steps-qa')
  await page.getByLabel('Password').fill('test-only')
  await page.getByRole('button', { name: 'Sign in as educator' }).click()
  const release = page.getByRole('button', { name: 'Release review' })
  await expect(release).toBeDisabled()

  let steps = 0
  await page.getByRole('button', { name: 'Mark all criteria met' }).click(); steps++
  await page.getByLabel('Feedback for learner').fill('Clear identification, cited value and a stated limit.'); steps++
  await expect(release).toBeEnabled()
  await release.click(); steps++

  await expect.poll(() => posted).not.toBeNull()
  expect(steps).toBeLessThanOrEqual(3)
  expect(posted!.criterion_scores.map(score => score.earned_points)).toEqual([40, 35, 25])
  expect(posted!.reason).toBe('Scored against the published rubric; every criterion met.')
  expect(posted!.feedback).toBe('Clear identification, cited value and a stated limit.')
})
