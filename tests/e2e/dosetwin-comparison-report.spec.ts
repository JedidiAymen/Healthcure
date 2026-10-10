import { expect, test } from '@playwright/test'
import { completeResearchSignInIfPrompted } from './research-sign-in'

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

test('authentic pt_241 comparison report reopens with ROI evidence and source hashes', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))

  const artifactsResponse = await page.request.get('/api/v1/cases/openkbp%3Apt_241/dose-artifacts')
  expect(artifactsResponse.ok(), 'the local pt_241 API profile must be running').toBeTruthy()
  const artifacts = await artifactsResponse.json() as DoseArtifact[]
  const artifact = artifacts.find(item => item.source_file_name === 'prediction-set_1.csv')
  expect(artifact, 'the authentic archived prediction must be imported for its matching case').toBeTruthy()
  expect(artifact!.source_file_sha256).toBe('d9fc8da169b2a7e12c1dd417f60b8364888ab28e233db19e87ee3ea93c40a583')

  await page.goto('/studio/dosetwin/cases/openkbp%3Apt_241')
  await expect(page.getByRole('heading', { name: 'OpenKBP pt_241' })).toBeVisible()
  await page.getByText('Compare a real dose prediction', { exact: true }).click()
  const comparison = page.getByLabel('DoseTwin prediction comparison')
  await expect(comparison.getByText('Same-slice dose and Δ-dose')).toBeVisible()
  await comparison.getByText('Prediction provenance and comparison limits', { exact: true }).click()
  await expect(comparison.getByText(artifact!.source_file_sha256, { exact: true })).toBeVisible()

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

  // A separate route load proves the persisted report survives the comparison panel's state.
  await page.goto('/studio/reports')
  await expect(page.getByText('DoseTwin · same-grid comparison')).toBeVisible()
  await expect(page.getByText(artifact!.source_file_sha256, { exact: true })).toBeVisible()
  await expect(page.getByText(report.document.source.files_sha256['reference:dose.csv'], { exact: true })).toBeVisible()
  await expect(page.getByText('PTV70', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
