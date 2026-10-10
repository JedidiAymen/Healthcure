import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
import { completeClinicalReviewSignIn, completeResearchSignInIfPrompted } from './research-sign-in'

type DoseArtifact = {
  id: string
  case_id: string
  source_file_sha256: string
  source_file_name: string
}

type ComparisonReport = {
  id: string
  case_id: string
  document: {
    schema: string
    case: { source_case_id: string }
    source: { files_sha256: Record<string, string> }
    comparison: { roi_comparisons: Array<{ roi: string }> }
  }
}

type ResearchReview = {
  id: string
  case_id: string
  artifact_id: string
  decision: string
  rationale: string
  audit_row_hash: string
  boundary: string
  provenance: { provenance_kind: string; prediction_sha256: string }
  evidence: { roi: string; voxel: { delta_gy: number } | null }
}

type LocalSession = { access_token: string; user: { role: string } }

test('authentic pt_241 comparison report reopens with ROI evidence and source hashes @source', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))

  const username = process.env.MEDFORGE_E2E_RESEARCH_USERNAME
  const password = process.env.MEDFORGE_E2E_RESEARCH_PASSWORD
  expect(username && password, 'Set local educator credentials for the isolated research-review profile').toBeTruthy()
  await page.goto('/educator')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password').fill(password!)
  const loginResponsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/auth/local-login',
  )
  await page.getByRole('button', { name: 'Sign in as educator' }).click()
  const loginResponse = await loginResponsePromise
  expect(loginResponse.ok()).toBeTruthy()
  const session = await loginResponse.json() as LocalSession
  expect(session.user.role).toBe('educator')

  // Install the authentic source artifact before mounting DoseTwin. The panel's
  // query cache is intentionally fresh for 15 seconds, so importing through the
  // API after mount would leave the test looking at its earlier empty result.
  const prediction = await readFile('data/openkbp-opt/pt_241/prediction-set_1.csv')
  const predictionSha256 = createHash('sha256').update(prediction).digest('hex')
  expect(predictionSha256).toBe('d9fc8da169b2a7e12c1dd417f60b8364888ab28e233db19e87ee3ea93c40a583')
  const importResponse = await page.request.put('/api/v1/cases/openkbp%3Apt_241/dose-artifacts?file_name=prediction-set_1.csv', {
    data: prediction,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'text/csv',
      'X-Dose-Origin': 'archived_model_prediction',
      'X-Dose-Model-Revision': 'OpenKBP-Opt archived set_1',
      'X-Dose-Source-Case': 'openkbp:pt_241',
      'X-Dose-Source-Revision': '16fbe0dbc64c94ed4b7e8378a090b47c6596bbd7',
      'X-Dose-Rights-Basis': 'Local research inspection authorized by the project owner; not a legal review.',
      'X-Dose-Rights-Confirmed': 'true',
      'X-Dose-Unit': 'Gy',
      'X-Dose-Index-Convention': 'x-major-y-middle-z-fastest',
      'X-Dose-Array-Shape': '128,128,128',
      'X-Dose-Spacing-MM': '3.906,3.906,2.5',
      'X-Dose-File-SHA256': predictionSha256,
    },
  })
  expect(importResponse.ok(), 'the authentic pt_241 prediction must import into the isolated local test database').toBeTruthy()
  const artifactsResponse = await page.request.get('/api/v1/cases/openkbp%3Apt_241/dose-artifacts', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  expect(artifactsResponse.ok(), 'the local pt_241 API profile must be running').toBeTruthy()
  const artifacts = await artifactsResponse.json() as DoseArtifact[]
  const artifact = artifacts.find(item => item.source_file_name === 'prediction-set_1.csv')
  expect(artifact, 'the authentic archived prediction must be imported for its matching case').toBeTruthy()
  expect(artifact!.source_file_sha256).toBe('d9fc8da169b2a7e12c1dd417f60b8364888ab28e233db19e87ee3ea93c40a583')

  await page.getByRole('combobox', { name: 'Switch workspace' }).click()
  await page.getByRole('option', { name: 'Professional Studio' }).click()
  await page.getByRole('link', { name: /DoseTwin/ }).click()
  const casePicker = page.getByLabel('DoseTwin source case')
  await expect(casePicker).toBeVisible()
  await casePicker.click()
  await page.getByRole('option', { name: /pt_241/ }).click()

  await expect(page.getByRole('heading', { name: 'OpenKBP pt_241' })).toBeVisible()
  await page.getByRole('tab', { name: 'Comparison' }).click()
  const comparison = page.getByLabel('DoseTwin prediction comparison')
  await expect(comparison.getByText('Same-slice dose and Δ-dose')).toBeVisible()
  await comparison.getByText('Prediction provenance and comparison limits', { exact: true }).click()
  await expect(comparison.getByText(artifact!.source_file_sha256, { exact: true })).toBeVisible()
  const captureDir = '.local-review/UX-34'
  await mkdir(captureDir, { recursive: true })
  for (const viewport of [
    { width: 1440, height: 900, name: 'desktop' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 390, height: 844, name: 'phone' },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.getByRole('tab', { name: 'Comparison' }).click()
    await expect(comparison.getByText('Same-slice dose and Δ-dose')).toBeVisible()
    const dock = page.getByRole('region', { name: 'DoseTwin measurements and evidence' })
    await dock.evaluate(element => element.scrollIntoView({ block: 'start' }))
    await page.waitForTimeout(100)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect.poll(() => page.getByRole('tablist', { name: 'DoseTwin inspection panels' }).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: `${captureDir}/dosetwin-${viewport.name}.png` })
    await comparison.screenshot({ path: `${captureDir}/dosetwin-${viewport.name}-comparison.png` })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('tab', { name: 'Comparison' }).click()
  await comparison.getByRole('button', { name: 'Save comparison report' }).evaluate(element => element.scrollIntoView({ block: 'center' }))

  const saveResponsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/reports/dosetwin-comparison' && response.status() !== 401,
  )
  await comparison.getByRole('button', { name: 'Save comparison report' }).click()
  await completeResearchSignInIfPrompted(page)
  const saveResponse = await saveResponsePromise
  expect(saveResponse.ok()).toBeTruthy()
  const report = await saveResponse.json() as ComparisonReport
  expect(report.document.schema).toBe('medforge.dosetwin-dose-comparison/v1')
  expect(report.document.case.source_case_id).toBe('pt_241')
  expect(report.document.source.files_sha256['prediction:prediction-set_1.csv']).toBe(artifact!.source_file_sha256)
  expect(report.document.source.files_sha256['reference:dose.csv']).toMatch(/^[a-f0-9]{64}$/)
  expect(report.document.comparison.roi_comparisons).toHaveLength(7)

  // Exercise the flagship's human research-review path with the same authentic,
  // same-case archived output; this is never model inference or treatment approval.
  await page.getByRole('tab', { name: 'Comparison' }).click()
  const review = page.getByRole('heading', { name: 'Review this archived prediction' }).locator('xpath=ancestor::*[@data-slot="card"][1]')
  await expect(review).toBeVisible()
  await expect(review.getByText('For further expert review, not for patient treatment.')).toBeVisible()
  await review.getByRole('button', { name: 'Sign in to review' }).click()
  const reviewerLoginPromise = page.waitForResponse(response =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/auth/local-login',
  )
  await completeClinicalReviewSignIn(page)
  const reviewerLogin = await reviewerLoginPromise
  expect(reviewerLogin.ok()).toBeTruthy()
  expect((await reviewerLogin.json() as LocalSession).user.role).toBe('clinical_reviewer')
  await expect(review.getByRole('button', { name: 'Inspect voxel' })).toBeVisible()
  const reviewViewportDir = '.local-review/DOSETWIN-RESEARCH-REVIEW'
  await mkdir(reviewViewportDir, { recursive: true })
  for (const viewport of [
    { width: 1440, height: 900, name: 'desktop' },
    { width: 1280, height: 800, name: 'laptop' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 390, height: 844, name: 'phone' },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await review.evaluate(element => element.scrollIntoView({ block: 'start' }))
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `${reviewViewportDir}/dosetwin-review-${viewport.name}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await review.getByRole('button', { name: 'Inspect voxel' }).click()
  await expect(review.getByText('Signed difference')).toBeVisible()
  await expect(review.getByText(/Reference SHA-256/)).toBeVisible()

  const decisionButton = review.getByRole('button', { name: 'Accept for further expert assessment' })
  await decisionButton.click()
  const rationale = review.getByRole('textbox', { name: /Rationale/ })
  const recordButton = review.getByRole('button', { name: 'Record research review' })
  await expect(recordButton).toBeDisabled()
  await rationale.fill('Evidence supports further expert assessment.')
  await expect(recordButton).toBeEnabled()
  const reviewResponsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/research-reviews' && response.status() !== 401,
  )
  await recordButton.click()
  const reviewResponse = await reviewResponsePromise
  expect(reviewResponse.status()).toBe(201)
  const savedReview = await reviewResponse.json() as ResearchReview
  expect(savedReview.case_id).toBe('openkbp:pt_241')
  expect(savedReview.artifact_id).toBe(artifact!.id)
  expect(savedReview.decision).toBe('accept_for_further_expert_assessment')
  expect(savedReview.evidence.roi).toBe('Brainstem')
  expect(savedReview.evidence.voxel?.delta_gy).toEqual(expect.any(Number))
  expect(savedReview.provenance.provenance_kind).toBe('ARCHIVED_PREDICTION')
  expect(savedReview.provenance.prediction_sha256).toBe(artifact!.source_file_sha256)
  expect(savedReview.audit_row_hash).toMatch(/^[a-f0-9]{64}$/)
  expect(savedReview.boundary).toBe('For further expert review, not for patient treatment.')
  await expect(review.getByRole('status').filter({ hasText: 'Recorded: Accept for further expert assessment' })).toBeVisible()
  await expect(review.getByText('Evidence supports further expert assessment.')).toBeVisible()

  // Reopen the saved comparison through the shell without reloading the signed-in reviewer session.
  await page.getByRole('link', { name: 'Evidence reports', exact: true }).click()
  await expect(page.getByText('DoseTwin · same-grid comparison')).toBeVisible()
  await expect(page.getByText(artifact!.source_file_sha256, { exact: true })).toBeVisible()
  await expect(page.getByText(report.document.source.files_sha256['reference:dose.csv'], { exact: true })).toBeVisible()
  await expect(page.getByText('PTV70', { exact: true })).toBeVisible()

  expect(errors).toEqual([])
})
