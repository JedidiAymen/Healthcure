import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const assignmentId = 'assignment-offline-queue-test-only'
const attemptId = 'attempt-offline-queue-test-only'
const student = { id: 'student-offline-queue-test-only', display_name: 'Offline Test Student', role: 'student' }
const testToken = 'offline-queue-test-token'

const initialAttempt = {
  attempt_id: attemptId,
  assignment_id: assignmentId,
  state: 'started',
  revision: 1,
  challenge: {
    title: 'Offline queue browser test',
    module: 'fistulaguard',
    case_id: 'synthetic-test:offline-queue-only',
    case_label: 'TEST FIXTURE ONLY · no patient or research data',
    dataset_id: 'synthetic-test',
    reference_kind: 'synthetic-test',
    source_license: 'Automated test fixture only',
    blocks: [{ id: 'offline-observation', type: 'Question', title: 'Offline test question', content: 'This fixture tests queued delivery only; it has no medical interpretation.' }],
  },
  observations: [],
  viewer_evidence: {
    kind: 'fistulaguard',
    case_id: 'synthetic-test:offline-queue-only',
    record_id: 'offline-queue-only',
    channel: 'raw PZT2',
    start_sec: 0,
    duration_sec: 5,
  },
}

async function queuedSubmits(page: Page) {
  return page.evaluate(() => new Promise<Array<{ attemptId: string; revision: number; idempotencyKey: string }>>((resolve, reject) => {
    const request = indexedDB.open('medforge-offline', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const read = db.transaction('kv', 'readonly').objectStore('kv').get('submit-queue')
      read.onsuccess = () => { resolve(read.result ?? []); db.close() }
      read.onerror = () => { reject(read.error); db.close() }
    }
  }))
}

test('queued student submission survives an offline reload and replays once after sign-in @offline', async ({ page, context }) => {
  test.setTimeout(90_000)
  let attempt: Record<string, unknown> = structuredClone(initialAttempt)
  let unauthenticatedReplayChecks = 0
  const authenticatedSubmitKeys: string[] = []
  const privateDebriefReads: string[] = []

  await page.route('**/api/v1/auth/local-login', async route => {
    await route.fulfill({ json: { access_token: testToken, token_type: 'bearer', expires_at: '2026-10-11T00:00:00Z', user: student } })
  })
  await page.route('**/api/v1/academy/progress', async route => {
    await route.fulfill({ json: { xp: 0, xp_enabled: false, achievements_enabled: false, graded_attempts: 0, average_score: null, assigned_activities: 1, next_activity: null, rubric_dimensions: [], rubric_history: [], achievements: [] } })
  })
  await page.route('**/api/v1/academy/attempts**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const authorization = request.headers().authorization
    if (path.endsWith('/debrief')) {
      privateDebriefReads.push(path)
      await route.fulfill({ status: 403, json: { detail: 'Test fixture has no debrief' } })
      return
    }
    if (path === '/api/v1/academy/attempts' && request.method() === 'POST') {
      await route.fulfill({ json: attempt })
      return
    }
    if (path === `/api/v1/academy/attempts/${attemptId}` && request.method() === 'GET') {
      if (authorization !== `Bearer ${testToken}`) {
        unauthenticatedReplayChecks++
        await route.fulfill({ status: 401, json: { detail: 'Sign in again to replay this test fixture submission.' } })
        return
      }
      await route.fulfill({ json: attempt })
      return
    }
    if (path === `/api/v1/academy/attempts/${attemptId}/draft` && request.method() === 'PUT') {
      expect(authorization).toBe(`Bearer ${testToken}`)
      const body = request.postDataJSON() as { expected_revision: number; observations: { block_id: string; response: string }[]; viewer_evidence: unknown }
      expect(body.expected_revision).toBe(1)
      attempt = { ...attempt, revision: 2, observations: body.observations, viewer_evidence: body.viewer_evidence }
      await route.fulfill({ json: attempt })
      return
    }
    if (path === `/api/v1/academy/attempts/${attemptId}/submit` && request.method() === 'POST') {
      expect(authorization).toBe(`Bearer ${testToken}`)
      const key = request.headers()['idempotency-key']
      expect(key).toBeTruthy()
      authenticatedSubmitKeys.push(key!)
      attempt = { ...attempt, state: 'review_required' }
      await route.fulfill({ json: { attempt_id: attemptId, state: 'review_required', submitted_at: '2026-10-10T12:00:00Z' } })
      return
    }
    await route.fulfill({ status: 404, json: { detail: `Unhandled Academy test route: ${request.method()} ${path}` } })
  })
  // This route deliberately has no source record: the assignment above is an
  // explicitly synthetic fixture and the test verifies transport/replay only.
  await page.route('**/api/v1/fistulaguard/**', route => route.fulfill({ status: 404, json: { detail: 'No research data is part of this test fixture.' } }))

  await page.goto(`/academy/missions/${assignmentId}`)
  await expect(page.getByText('Student sign in', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(async () => {
    await navigator.serviceWorker.ready
    return navigator.serviceWorker.controller !== null
  })).toBe(true)
  // The first navigation can load its assets before service-worker control.
  // Reload once online so the app shell and the mission code are cached.
  await page.reload()
  await expect(page.getByText('Student sign in', { exact: true })).toBeVisible()
  await page.getByLabel('Username').fill('offline-test-student')
  await page.getByLabel('Password').fill('test-only')
  await page.getByRole('button', { name: 'Sign in as student' }).click()
  await expect(page.getByRole('heading', { name: 'Offline queue browser test' })).toBeVisible()
  await expect.poll(() => page.evaluate(async () => {
    const cache = await caches.open('medforge-shell-v1')
    const assets = performance.getEntriesByType('resource').map(entry => new URL(entry.name))
      .filter(url => url.origin === location.origin && url.pathname.startsWith('/assets/'))
    const cachedPaths = new Set((await cache.keys()).map(request => new URL(request.url).pathname))
    return assets.length > 0 && assets.every(url => cachedPaths.has(url.pathname))
  })).toBe(true)
  await page.getByLabel('Your observation').fill('A test-only answer retained in the local offline queue.')
  await expect(page.getByRole('button', { name: 'Submit for educator review' })).toBeEnabled()

  await context.setOffline(true)
  await page.getByRole('button', { name: 'Submit for educator review' }).click()
  await expect(page.getByText('You are offline. Your submission is queued on this device and will be sent automatically.')).toBeVisible()
  await expect.poll(async () => (await queuedSubmits(page)).length).toBe(1)
  const [queued] = await queuedSubmits(page)
  expect(queued).toMatchObject({ attemptId, revision: 1 })
  expect(queued.idempotencyKey).toBeTruthy()
  expect(authenticatedSubmitKeys).toEqual([])

  // The production service worker must reopen the built app shell; the API and
  // the student's in-memory session deliberately remain unavailable offline.
  await page.reload()
  await expect(page.getByText('Student sign in', { exact: true })).toBeVisible()
  await expect(page.getByText(/1 submission waiting to send/)).toBeVisible()
  expect(await queuedSubmits(page)).toMatchObject([{ attemptId, idempotencyKey: queued.idempotencyKey }])

  await context.setOffline(false)
  await expect.poll(() => unauthenticatedReplayChecks).toBeGreaterThan(0)
  // Wait for the online replay attempt to finish before signing in; the queue
  // count is refreshed only after that attempt has settled.
  await expect(page.getByText(/Back online\. 1 submission waiting to send/)).toBeVisible()
  expect(await queuedSubmits(page)).toMatchObject([{ attemptId, idempotencyKey: queued.idempotencyKey }])

  await page.getByLabel('Username').fill('offline-test-student')
  await page.getByLabel('Password').fill('test-only')
  await page.getByRole('button', { name: 'Sign in as student' }).click()
  await expect.poll(() => authenticatedSubmitKeys).toEqual([queued.idempotencyKey])
  await expect(page.getByText('Submitted', { exact: true })).toBeVisible()
  await expect(page.getByText('Educator debrief', { exact: true })).toHaveCount(0)
  await expect.poll(async () => (await queuedSubmits(page)).length).toBe(0)
  expect(authenticatedSubmitKeys).toEqual([queued.idempotencyKey])
  expect(privateDebriefReads).toEqual([])

  const captureDir = path.resolve(process.cwd(), '.local-review/UX46-offline-recovery')
  await mkdir(captureDir, { recursive: true })
  for (const [name, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['tablet', { width: 768, height: 1024 }],
    ['phone', { width: 390, height: 844 }],
  ] as const) {
    await page.setViewportSize(viewport)
    await page.screenshot({ path: path.join(captureDir, `${name}.png`), fullPage: true })
  }
})
