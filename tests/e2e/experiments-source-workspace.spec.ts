import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

type RunRecord = {
  id: string
  case_id: string
  operation_id: string
  status: string
  source_kind: string
  results: {
    case: string
    files_sha256: Record<string, string>
    available_rois: Record<string, { voxels: number; dmean_gy: number | null }>
  }
  provenance: { algorithm: string; input_sha256: Record<string, string> }
}

test('configure a source-backed OpenKBP run, inspect history and save its evidence report @source', async ({ page }) => {
  test.setTimeout(120_000)
  const username = process.env.MEDFORGE_E2E_RESEARCH_USERNAME
  const password = process.env.MEDFORGE_E2E_RESEARCH_PASSWORD
  expect(username && password, 'Set credentials for an educator in the disposable source profile').toBeTruthy()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))

  await page.goto('/educator')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password').fill(password!)
  const loginResponsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/auth/local-login',
  )
  await page.getByRole('button', { name: 'Sign in as educator' }).click()
  const loginResponse = await loginResponsePromise
  expect(loginResponse.ok()).toBeTruthy()
  const session = await loginResponse.json() as { user: { role: string } }
  expect(session.user.role).toBe('educator')

  await page.getByRole('combobox', { name: 'Switch workspace' }).click()
  await page.getByRole('option', { name: 'Professional Studio' }).click()
  await page.getByRole('main').getByRole('link', { name: 'Experiments', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Analysis workspace' })).toBeVisible()
  const configure = page.getByRole('tab', { name: /Configure analysis/ })
  const history = page.getByRole('tab', { name: /Run history/ })
  await expect(configure).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(/openkbp\.case_summary/)).toBeVisible()
  await expect(page.getByRole('tabpanel', { name: 'Configure analysis' }).getByRole('alert')).toContainText(/does not run a prediction model/i)

  const captureDir = '.local-review/UX-42-experiments'
  await mkdir(captureDir, { recursive: true })
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'laptop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'phone', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `${captureDir}/experiments-configure-${viewport.name}.png`, fullPage: true })
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  const sourceCase = page.getByRole('combobox', { name: 'Source case' })
  await sourceCase.click()
  await page.getByRole('option', { name: /pt_201/ }).click()
  const runResponsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/runs',
  )
  await page.getByRole('button', { name: 'Run case summary' }).click()
  const runResponse = await runResponsePromise
  expect(runResponse.ok()).toBeTruthy()
  const run = await runResponse.json() as RunRecord
  expect(run.case_id).toBe('openkbp:pt_201')
  expect(run.operation_id).toBe('openkbp.case_summary')
  expect(run.status).toBe('completed')
  expect(run.source_kind).toBe('benchmark')
  expect(run.results.case).toBe('pt_201')
  expect(Object.keys(run.results.files_sha256).length).toBeGreaterThan(0)
  expect(run.provenance.algorithm).toBe('MEDFORGE reference sparse case summary v0.8')
  await expect(history).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'OpenKBP case summary' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Brainstem/ })).toBeVisible()
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'laptop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'phone', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect.poll(() => page.getByRole('tablist', { name: 'Analysis workspace views' }).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    if (viewport.name === 'phone') {
      await expect(page.getByText('Swipe the table horizontally to inspect every dose metric.')).toBeVisible()
    }
    await page.screenshot({ path: `${captureDir}/experiments-history-${viewport.name}.png`, fullPage: true })
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await history.click()
  await expect(page.getByRole('region', { name: 'Saved analysis runs' })).toContainText(run.id)
  await configure.click()
  await expect(page.getByRole('button', { name: 'Run case summary' })).toBeVisible()
  await history.click()
  await expect(page.getByText(`run ${run.id}`)).toBeVisible()

  const reportResponsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/reports',
  )
  await page.getByRole('button', { name: 'Save evidence report' }).click()
  const reportResponse = await reportResponsePromise
  expect(reportResponse.ok()).toBeTruthy()
  const report = await reportResponse.json() as { id: string; run_id: string; document: { schema?: string; source?: { files_sha256?: Record<string, string> } } }
  expect(report.run_id).toBe(run.id)
  expect(report.document.schema).toBe('medforge.evidence-report/v1')
  expect(report.document.source?.files_sha256).toEqual(run.results.files_sha256)
  await expect(page.getByRole('link', { name: new RegExp(`Report ${report.id.slice(0, 16)} saved`) })).toBeVisible()
  expect(errors).toEqual([])
})
