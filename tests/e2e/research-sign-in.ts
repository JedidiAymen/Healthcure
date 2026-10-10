import { expect, type Page } from '@playwright/test'

// Research writes need a local educator or admin account. After a save click the app
// may prompt once, then retry the save; this completes that prompt when it appears.
export async function completeResearchSignInIfPrompted(page: Page) {
  const signIn = page.getByRole('dialog', { name: 'Sign in to save research evidence' })
  if (!(await signIn.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true, () => false))) return
  const username = process.env.MEDFORGE_E2E_RESEARCH_USERNAME
  const password = process.env.MEDFORGE_E2E_RESEARCH_PASSWORD
  expect(username && password, 'Set MEDFORGE_E2E_RESEARCH_USERNAME and MEDFORGE_E2E_RESEARCH_PASSWORD to a local educator or admin account').toBeTruthy()
  await signIn.getByLabel('Username').fill(username!)
  await signIn.getByLabel('Password').fill(password!)
  await signIn.getByRole('button', { name: 'Sign in and save' }).click()
}

export async function completeClinicalReviewSignIn(page: Page) {
  const signIn = page.getByRole('dialog', { name: 'Sign in to review research evidence' })
  await expect(signIn).toBeVisible()
  const username = process.env.MEDFORGE_E2E_REVIEWER_USERNAME
  const password = process.env.MEDFORGE_E2E_REVIEWER_PASSWORD
  expect(username && password, 'Set MEDFORGE_E2E_REVIEWER_USERNAME and MEDFORGE_E2E_REVIEWER_PASSWORD to a locally provisioned Clinical Reviewer account').toBeTruthy()
  await signIn.getByLabel('Username').fill(username!)
  await signIn.getByLabel('Password').fill(password!)
  await signIn.getByRole('button', { name: 'Sign in to review' }).click()
}
