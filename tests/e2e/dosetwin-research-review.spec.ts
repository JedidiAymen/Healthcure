import { expect, test, type Route } from '@playwright/test'
import { readFile } from 'node:fs/promises'

// Source-independent: every API response below was produced by the real API on a synthetic
// case (tests/e2e/fixtures/make_research_review_fixtures.py). No dataset is needed.
type Fixtures = {
  case_id: string; artifact_id: string; session: unknown; me: unknown; artifacts: unknown[]
  comparison: unknown; slice: unknown; voxel: unknown
  review: { id: string; decision_label: string }; review_export: unknown; review_fhir: { resourceType: string }
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const authRequired = { detail: { code: 'AUTH_REQUIRED', message: 'Sign in with a provisioned local account' } }

test('DoseTwin research review: Clinical Reviewer sign-in, decision in 3 steps, history, voxel inspector, audit check and FHIR export', async ({ page }) => {
  const fx = JSON.parse(await readFile('tests/e2e/fixtures/research-review-fixtures.json', 'utf8')) as Fixtures
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const signedIn = (route: Route) => route.request().headers().authorization === 'Bearer fixture-token'
  let recorded = false
  const posted: Record<string, unknown>[] = []

  await page.route('**/api/v1/cases', route => json(route, [{ id: fx.case_id, module: 'dosetwin', dataset_id: 'openkbp', source_case_id: 'test-synthetic-case', reference_kind: 'benchmark', status: 'ready', label: 'Synthetic test case' }]))
  await page.route('**/viewer/slice*', route => {
    const url = new URL(route.request().url())
    const layer = url.searchParams.get('layer')
    return json(route, {
      case_id: fx.case_id, source_revision: 'synthetic-revision', source_file: 'Brainstem.csv', source_sha256: 'a'.repeat(64),
      axis: Number(url.searchParams.get('axis') ?? 2), index: Number(url.searchParams.get('index') ?? 64), shape: [128, 128],
      values: new Array(128 * 128).fill(layer === 'ct' ? 0.5 : 0),
      unit: layer === 'dose' ? 'Gy' : layer === 'roi' ? 'binary-mask' : 'benchmark-value', source_kind: 'synthetic-test',
      origin: 'synthetic-test-fixture', coordinate_frame: 'openkbp-processed-voxel-grid',
    })
  })
  await page.route('**/viewer/dvh*', route => json(route, {
    case_id: fx.case_id, source_revision: 'synthetic-revision', roi: new URL(route.request().url()).searchParams.get('roi') ?? 'Brainstem',
    dose_sha256: 'b'.repeat(64), roi_sha256: 'c'.repeat(64), voxel_count: 2, mean_dose_gy: 17, dose_display_max_gy: 80,
    spacing_mm: [2, 2, 2], ct_display_range: [0, 1], ct_display_note: 'Fixture window; not HU.',
    official_metrics: { volume_cc: 1, dmean_gy: 17, dmax_voxel_gy: 22, d95_gy_interpolated: 12, d0_1cc_gy_openkbp: 22, d99_gy_openkbp: 12, d1_gy_openkbp: 22, v20gy_percent: 50, note: 'Fixture only.' },
    curve: Array.from({ length: 51 }, (_, index) => ({ dose_gy: index * 1.6, volume_percent: index < 12 ? 100 : 0 })),
    method: 'Fixture curve.', source_kind: 'synthetic-test', origin: 'computed-from-synthetic-test-fixture',
  }))
  await page.route('**/dose-artifacts**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/comparison')) return json(route, fx.comparison)
    if (path.endsWith('/slice')) return json(route, fx.slice)
    if (path.endsWith('/voxel')) return signedIn(route) ? json(route, fx.voxel) : json(route, authRequired, 401)
    return json(route, fx.artifacts)
  })
  await page.route('**/api/v1/auth/local-login', route => json(route, fx.session))
  await page.route('**/api/v1/auth/me', route => signedIn(route) ? json(route, fx.me) : json(route, authRequired, 401))
  await page.route('**/api/v1/research-reviews**', route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (!signedIn(route)) return json(route, authRequired, 401)
    if (request.method() === 'POST') { posted.push(request.postDataJSON()); recorded = true; return json(route, fx.review, 201) }
    if (path.endsWith('/fhir')) return json(route, fx.review_fhir)
    if (path.endsWith('/export')) return json(route, fx.review_export)
    return json(route, recorded ? [fx.review] : [])
  })

  await page.goto(`/studio/dosetwin/cases/${encodeURIComponent(fx.case_id)}`)
  await page.getByRole('tab', { name: 'Comparison' }).click()
  const panel = page.getByRole('heading', { name: 'Review this archived prediction' }).locator('xpath=ancestor::*[@data-slot="card"][1]')
  await expect(panel.getByText('For further expert review, not for patient treatment.')).toBeVisible()
  await expect(panel.getByText(/ARCHIVED PREDICTION/i).first()).toBeVisible()

  // Only a Clinical Reviewer or admin sees the review form.
  await expect(panel.getByText('Dedicated review access required')).toBeVisible()
  await panel.getByRole('button', { name: 'Sign in to review' }).click()
  const signIn = page.getByRole('dialog', { name: 'Sign in to review research evidence' })
  await signIn.getByLabel('Username').fill('reviewer')
  await signIn.getByLabel('Password').fill('synthetic-fixture-password')
  await signIn.getByRole('button', { name: 'Sign in to review' }).click()
  await expect(signIn).toBeHidden()

  // The record button stays disabled until a decision and a 10-character rationale exist.
  const record = panel.getByRole('button', { name: 'Record research review' })
  await expect(record).toBeDisabled()
  await panel.getByRole('button', { name: 'Request revision' }).click()
  await panel.getByLabel(/Rationale/).fill('Brainstem mean dose differs from the reference.')
  await expect(record).toBeEnabled()
  await record.click()

  await expect(panel.getByText('Recorded: Request revision')).toBeVisible()
  expect(posted).toHaveLength(1)
  expect(posted[0]).toMatchObject({ case_id: fx.case_id, artifact_id: fx.artifact_id, decision: 'request_revision' })
  const history = panel.getByRole('region', { name: 'Review history' })
  await expect(history.getByText('Brainstem mean dose differs from the reference.')).toBeVisible()

  // Replay: the recorded review reopens its plane and slice (voxel [0, 0, 1] on the Z plane).
  await expect(panel.getByText('Z fixed at slice 64')).toBeVisible()
  await history.getByRole('button', { name: 'Reopen view' }).click()
  await expect(panel.getByText('Z fixed at slice 1')).toBeVisible()

  // Voxel inspector.
  await panel.getByRole('button', { name: 'Inspect voxel' }).click()
  await expect(panel.getByText('+3.000 Gy')).toBeVisible()
  await expect(panel.getByText('22.000 Gy')).toBeVisible()

  await page.route('**/api/v1/audit/verify', route => signedIn(route) ? json(route, { ok: true, entries: 3, first_broken_id: null, reason: null, head_hash: 'f'.repeat(64) }) : json(route, authRequired, 401))
  await panel.getByRole('button', { name: 'Verify audit log' }).click()
  await expect(panel.getByText(/Hash chain verified: 3 entries/)).toBeVisible()

  const download = page.waitForEvent('download')
  await history.getByRole('button', { name: 'FHIR R4' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe(`${fx.review.id}-fhir-r4.json`)
  const bundle = JSON.parse(await readFile(await file.path(), 'utf8')) as { resourceType: string }
  expect(bundle.resourceType).toBe('Bundle')
  expect(errors).toEqual([])
})
