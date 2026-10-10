import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

type LoginResult = { access_token: string; user: { id: string; role: string } }

async function signIn(page: Page, username: string, password: string, role: 'educator' | 'student') {
  await page.goto(role === 'educator' ? '/educator' : '/academy')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(password)
  const login = page.waitForResponse(response =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/auth/local-login',
  )
  await page.getByRole('button', { name: `Sign in as ${role}` }).click()
  const response = await login
  expect(response.ok()).toBeTruthy()
  const result = await response.json() as LoginResult
  expect(result.user.role).toBe(role)
  return result
}

test('deliver a source-backed lesson through learner submission, educator review, and private feedback @source', async ({ page }) => {
  test.setTimeout(150_000)
  const educatorUsername = process.env.MEDFORGE_E2E_RESEARCH_USERNAME
  const educatorPassword = process.env.MEDFORGE_E2E_RESEARCH_PASSWORD
  const studentUsername = process.env.MEDFORGE_E2E_STUDENT_USERNAME
  const studentPassword = process.env.MEDFORGE_E2E_STUDENT_PASSWORD
  expect(educatorUsername && educatorPassword && studentUsername && studentPassword,
    'Set educator and student credentials from a disposable seeded local profile').toBeTruthy()

  const title = `FiSaV reviewed investigation ${Date.now()}`
  const student = await page.context().newPage()
  const captureDir = '.local-review/UX-44-learning-loop'
  await mkdir(captureDir, { recursive: true })
  await signIn(page, educatorUsername!, educatorPassword!, 'educator')

  // Author the case lesson in Educator Studio using the actual installed, attributed FiSaV record.
  await page.getByRole('button', { name: 'Create case lesson' }).click()
  await page.getByLabel('Lesson title').fill(title)
  const sourcePicker = page.getByRole('combobox', { name: 'Research source' })
  await sourcePicker.click()
  await sourcePicker.fill('pat001')
  await page.getByRole('option', { name: /pat001/i }).first().click()
  await page.getByRole('textbox', { name: 'Instruction title' }).fill('Inspect the measured source record')
  await page.getByRole('button', { name: 'Question', exact: true }).click()
  await page.getByRole('textbox', { name: 'Question title' }).fill('What does the trace show?')
  await page.getByRole('textbox', { name: 'Question content' }).fill('Describe one observation from the selected source window.')
  await page.getByRole('button', { name: 'Question', exact: true }).click()
  await page.getByRole('textbox', { name: 'Question title' }).nth(1).fill('What remains uncertain?')
  await page.getByRole('textbox', { name: 'Question content' }).nth(1).fill('Explain one limit of this research measurement.')
  await page.getByRole('button', { name: 'Reveal', exact: true }).click()
  await page.getByRole('textbox', { name: 'Reveal title' }).fill('Educator reference')
  await page.getByRole('textbox', { name: 'Reveal content' }).fill('A source waveform alone is not a diagnosis.')

  const savePromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/educator/drafts')
  await page.getByRole('button', { name: 'Save draft' }).click()
  const draftResponse = await savePromise
  expect(draftResponse.status()).toBe(201)
  const draft = await draftResponse.json() as { id: string }
  await expect(page).toHaveURL(new RegExp(`${draft.id}/edit$`))

  const previewPromise = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === `/api/v1/educator/drafts/${draft.id}/preview`)
  await page.getByRole('button', { name: 'Preview publication' }).click()
  const previewResponse = await previewPromise
  expect(previewResponse.ok()).toBeTruthy()
  const preview = await previewResponse.json() as { case_id: string; source_license: string; publication_review: string; blocks: Array<{ title: string }> }
  expect(preview.case_id).toBe('fisav:pat001')
  expect(preview.source_license).toBe('CC BY 4.0')
  expect(preview.blocks.map(block => block.title)).toEqual(['Inspect the measured source record', 'What does the trace show?', 'What remains uncertain?'])
  expect(preview.publication_review).not.toBe('blocked')
  await page.getByRole('checkbox', { name: /I reviewed the source terms/ }).check()
  await page.getByLabel('Source review note').fill('CC BY 4.0 attribution reviewed for this local education lesson.')
  const publishPromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/v1/educator/drafts/${draft.id}/publish`)
  await page.getByRole('button', { name: 'Publish immutable version' }).click()
  const publishResponse = await publishPromise
  expect(publishResponse.ok()).toBeTruthy()
  const version = await publishResponse.json() as { version_id: string }

  // Deliver the published version through the actual assignment UI into the seeded demo cohort.
  await page.getByRole('link', { name: 'Assignments', exact: true }).click()
  const versionSelect = page.getByRole('combobox', { name: 'Published lesson version' })
  await versionSelect.click()
  await page.getByRole('option', { name: new RegExp(title) }).click()
  const cohortSelect = page.getByRole('combobox', { name: 'Cohort' }).last()
  await cohortSelect.click()
  await page.getByRole('option', { name: /Demo cohort/ }).click()
  const assignmentPromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/educator/assignments')
  await page.getByRole('button', { name: 'Create assignment' }).click()
  const assignmentResponse = await assignmentPromise
  expect(assignmentResponse.status()).toBe(201)
  const assignment = await assignmentResponse.json() as { id: string; lesson_version_id: string }
  expect(assignment.lesson_version_id).toBe(version.version_id)

  // Student opens only the assigned learner version, selects evidence in the authentic FiSaV viewer, and submits answers.
  await signIn(student, studentUsername!, studentPassword!, 'student')
  await student.getByRole('link', { name: new RegExp(title) }).click()
  await expect(student.getByRole('heading', { name: title })).toBeVisible()
  await expect(student.getByText('A source waveform alone is not a diagnosis.')).toHaveCount(0)
  await expect(student.locator('#mission-explore').getByText('Explore evidence', { exact: true })).toBeVisible()
  for (const viewport of [
    { name: 'mission-desktop', width: 1440, height: 900 },
    { name: 'mission-tablet', width: 768, height: 1024 },
    { name: 'mission-phone', width: 390, height: 844 },
  ]) {
    await student.setViewportSize({ width: viewport.width, height: viewport.height })
    await expect.poll(() => student.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await student.screenshot({ path: `${captureDir}/${viewport.name}.png`, fullPage: true })
  }
  await student.setViewportSize({ width: 1440, height: 900 })
  await student.getByRole('button', { name: 'PZT2', exact: true }).click()
  await expect(student.locator('#mission-observe').getByText('Evidence selected', { exact: true })).toBeVisible()
  await student.getByLabel('Your observation').nth(0).fill('The measured record changes across the selected window.')
  await student.getByLabel('Your observation').nth(1).fill('The source values do not establish a clinical diagnosis.')
  const attemptSubmitPromise = student.waitForResponse(response => response.request().method() === 'POST' && /\/api\/v1\/academy\/attempts\/[^/]+\/submit$/.test(new URL(response.url()).pathname))
  await student.getByRole('button', { name: 'Submit for educator review' }).click()
  const submitted = await attemptSubmitPromise
  expect(submitted.ok()).toBeTruthy()
  const receipt = await submitted.json() as { attempt_id: string; state: string }
  expect(receipt.state).toBe('review_required')
  await expect(student.getByText('Submission received')).toBeVisible()

  // Educator grades manually against the published two-criterion rubric and records feedback.
  await page.getByRole('link', { name: 'Submissions', exact: true }).click()
  await page.getByRole('combobox', { name: 'Assignment', exact: true }).click()
  await page.getByRole('option', { name: title }).click()
  await expect(page.getByText('Learner attempts', { exact: true })).toBeVisible()
  await expect(page.getByText('The measured record changes across the selected window.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'FistulaGuard source signal review' })).toContainText('Measured CSV recording · pat001')
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: `${captureDir}/educator-review-desktop.png`, fullPage: true })
  for (const viewport of [{ name: 'tablet', width: 768, height: 1024 }, { name: 'phone', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `${captureDir}/educator-review-${viewport.name}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  const points = page.getByLabel('Points earned')
  await points.nth(0).fill('52')
  await points.nth(1).fill('36')
  await page.getByLabel('Feedback for learner').fill('Good source-grounded observation and an appropriate statement of uncertainty.')
  await page.getByLabel('Review note (recorded with this grade)').fill('Reviewed both observations against the published rubric and selected FiSaV evidence.')
  const gradePromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/v1/educator/attempts/${receipt.attempt_id}/grade`)
  await page.getByRole('button', { name: 'Release review' }).click()
  const gradeResponse = await gradePromise
  expect(gradeResponse.ok()).toBeTruthy()
  expect((await gradeResponse.json() as { score: number }).score).toBe(88)

  // Return through the student sign-in gate and confirm feedback and reference release only after grading.
  await signIn(student, studentUsername!, studentPassword!, 'student')
  await student.getByRole('link', { name: new RegExp(title) }).click()
  await expect(student.getByText('Educator debrief', { exact: true })).toBeVisible()
  await expect(student.getByText('Good source-grounded observation and an appropriate statement of uncertainty.')).toBeVisible()
  await expect(student.getByText('A source waveform alone is not a diagnosis.')).toBeVisible()
  await expect(student.getByText('52/60')).toBeVisible()
  await expect(student.getByText('36/40')).toBeVisible()
  for (const viewport of [
    { name: 'debrief-desktop', width: 1440, height: 900 },
    { name: 'debrief-tablet', width: 768, height: 1024 },
    { name: 'debrief-phone', width: 390, height: 844 },
  ]) {
    await student.setViewportSize({ width: viewport.width, height: viewport.height })
    await expect.poll(() => student.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await student.screenshot({ path: `${captureDir}/${viewport.name}.png`, fullPage: true })
  }
})
