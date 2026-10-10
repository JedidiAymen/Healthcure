import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
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

test('authentic pt_241 comparison report reopens with ROI evidence and source hashes @source', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))

  const prediction = await readFile('data/openkbp-opt/pt_241/prediction-set_1.csv')
  const predictionSha256 = createHash('sha256').update(prediction).digest('hex')
  expect(predictionSha256).toBe('d9fc8da169b2a7e12c1dd417f60b8364888ab28e233db19e87ee3ea93c40a583')
  const importResponse = await page.request.put('/api/v1/cases/openkbp%3Apt_241/dose-artifacts?file_name=prediction-set_1.csv', {
    data: prediction,
    headers: {
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
  const artifactsResponse = await page.request.get('/api/v1/cases/openkbp%3Apt_241/dose-artifacts')
  expect(artifactsResponse.ok(), 'the local pt_241 API profile must be running').toBeTruthy()
  const artifacts = await artifactsResponse.json() as DoseArtifact[]
  const artifact = artifacts.find(item => item.source_file_name === 'prediction-set_1.csv')
  expect(artifact, 'the authentic archived prediction must be imported for its matching case').toBeTruthy()
  expect(artifact!.source_file_sha256).toBe('d9fc8da169b2a7e12c1dd417f60b8364888ab28e233db19e87ee3ea93c40a583')

  await page.goto('/studio/dosetwin/cases/openkbp%3Apt_241')
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
    const dock = page.getByRole('region', { name: 'DoseTwin measurements and evidence' })
    await dock.evaluate(element => element.scrollIntoView({ block: 'start' }))
    await page.waitForTimeout(100)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect.poll(() => page.getByRole('tablist', { name: 'DoseTwin inspection panels' }).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: `${captureDir}/dosetwin-${viewport.name}.png` })
    await comparison.screenshot({ path: `${captureDir}/dosetwin-${viewport.name}-comparison.png` })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
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

  // A separate route load proves the persisted report survives the comparison panel's state.
  await page.goto('/studio/reports')
  await expect(page.getByText('DoseTwin · same-grid comparison')).toBeVisible()
  await expect(page.getByText(artifact!.source_file_sha256, { exact: true })).toBeVisible()
  await expect(page.getByText(report.document.source.files_sha256['reference:dose.csv'], { exact: true })).toBeVisible()
  await expect(page.getByText('PTV70', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
