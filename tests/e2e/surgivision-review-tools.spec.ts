import { expect, test, type Page } from '@playwright/test'

// Fully mocked: these flows are verified before the Endoscapes release is installed locally.
const frameRecord = (id: string, cvs: number[], categories: string[]) => {
  const [, split, stem] = id.split(':')
  const [video, frame] = stem.split('_').map(Number)
  return {
    id, dataset_id: 'Endoscapes-BBox201', split, video_id: video, frame_number: frame, file_name: `${stem}.jpg`,
    width: 854, height: 480, image_sha256: 'a'.repeat(64), annotation_sha256: 'b'.repeat(64),
    annotations: categories.map((name, index) => ({ id: index + 1, category_id: index + 1, category_name: name, bbox: [40 + index * 200, 60, 160, 120], segmentation: null })),
    cvs_criteria: cvs,
  }
}
const FRAMES = [
  frameRecord('endoscapes:train:1_100', [1, 1, 1], ['gallbladder', 'tool']),
  frameRecord('endoscapes:val:2_100', [2 / 3, 2 / 3, 1 / 3], ['tool']),
]
const summary = (frame: ReturnType<typeof frameRecord>) => {
  const disputed = frame.cvs_criteria.filter(value => value > 0 && value < 1).length
  return { id: frame.id, split: frame.split, video_id: frame.video_id, frame_number: frame.frame_number, cvs_criteria: frame.cvs_criteria,
    categories: frame.annotations.map(item => item.category_name).sort(), annotation_count: frame.annotations.length,
    disputed_criteria: disputed, agreement: disputed ? 'disputed' : 'unanimous' }
}

async function mockSurgiVision(page: Page, browseRequests: string[] = []) {
  await page.route('**/api/v1/cases', route => route.fulfill({ json: FRAMES.map(frame => ({
    id: frame.id, module: 'surgivision', dataset_id: 'Endoscapes-BBox201', source_case_id: frame.file_name,
    reference_kind: 'research', status: 'ready', label: `Endoscapes ${frame.split} · video ${frame.video_id} · frame ${frame.frame_number}` })) }))
  await page.route(/\/api\/v1\/surgivision\/frames(\?.*)?$/, route => {
    const url = new URL(route.request().url())
    browseRequests.push(url.search)
    const matched = FRAMES.map(summary).filter(item => url.searchParams.get('agreement') ? item.agreement === url.searchParams.get('agreement') : true)
    return route.fulfill({ json: { total: matched.length, limit: 25, offset: 0, frames: matched,
      facets: { categories: ['gallbladder', 'tool'], splits: { train: 1, val: 1 } },
      limitations: ['CVS values are means of three annotators.'] } })
  })
  await page.route('**/api/v1/surgivision/frames/**', route => {
    const url = route.request().url()
    if (url.endsWith('/image')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="854" height="480"><rect width="854" height="480" fill="#101624"/></svg>' })
    const frame = FRAMES.find(item => decodeURIComponent(url).includes(item.file_name.replace('.jpg', '')))!
    return route.fulfill({ json: frame })
  })
  await page.route('**/api/v1/surgivision/media**', route => route.fulfill({ status: 503, json: { detail: 'No media fixture.' } }))
  await page.route('**/api/v1/surgivision/clips', route => route.fulfill({ json: [] }))
  await page.route('**/api/v1/surgivision/cvs-coverage', route => route.fulfill({ status: 503, json: { detail: 'No coverage fixture.' } }))
  await page.route('**/api/v1/models/cvs-adaptnet/validate', route => route.fulfill({ status: 503, json: { detail: 'Checkpoint remains gated.' } }))
  await page.route('**/api/v1/runs', route => route.fulfill({ json: [] }))
}

test('frame browser filters by annotator agreement and opens a side-by-side comparison', async ({ page }) => {
  const browseRequests: string[] = []
  await mockSurgiVision(page, browseRequests)
  await page.goto('/studio/surgivision/cases/endoscapes%3Atrain%3A1_100')
  await page.getByRole('tab', { name: 'Annotated stills' }).click()

  const browser = page.getByRole('heading', { name: 'Find frames by annotation' }).locator('xpath=ancestor::*[@data-slot="card"][1]')
  await expect(browser.getByText('2 matching frames')).toBeVisible()
  await expect(browser.getByText('C1 2/3 · C2 2/3 · C3 1/3 · tool')).toBeVisible()

  await browser.getByLabel('Annotator agreement').click()
  await page.getByRole('option', { name: 'Annotators disagreed' }).click()
  await expect(browser.getByText('1 matching frame')).toBeVisible()
  expect(browseRequests.at(-1)).toContain('agreement=disputed')
  await expect(page).toHaveURL(/frames_agreement=disputed/)

  await browser.getByRole('button', { name: 'Compare' }).click()
  await expect(page).toHaveURL(/compare=endoscapes%3Aval%3A2_100/)
  // A shared comparison link opens straight on the annotated stills.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Compare two frames' })).toBeVisible()
  const compare = page.getByRole('heading', { name: 'Compare two frames' }).locator('xpath=ancestor::*[@data-slot="card"][1]')
  await expect(compare.getByRole('img', { name: /expert annotation boxes/ })).toHaveCount(2)
  await expect(compare.getByText('Two structures visualized: 2 of 3 annotators marked it achieved (annotators disagreed)')).toBeVisible()
  await compare.getByRole('button', { name: 'Hide boxes' }).click()
  await expect(compare.getByRole('img', { name: /expert annotation boxes/ })).toHaveCount(0)
  await compare.getByRole('button', { name: 'Close comparison' }).click()
  await expect(page.getByRole('heading', { name: 'Compare two frames' })).toHaveCount(0)
})

test('student commits a CVS self-check before the annotator values are revealed', async ({ page }) => {
  await mockSurgiVision(page)
  const frame = FRAMES[1]
  let committed: unknown = null
  await page.route('**/api/v1/auth/local-login', route => route.fulfill({ json: {
    access_token: 'synthetic-student-token', token_type: 'bearer', expires_at: '2099-01-01T00:00:00Z',
    user: { id: 'student-1', display_name: 'Synthetic Student', role: 'student' } } }))
  await page.route('**/api/v1/academy/attempts', route => route.fulfill({ status: 201, json: {
    attempt_id: 'attempt-1', assignment_id: 'assignment-1', state: 'started', revision: 0, observations: [], viewer_evidence: null,
    challenge: { title: 'CVS basics', module: 'surgivision', case_id: frame.id, case_label: 'Endoscapes val frame', dataset_id: 'Endoscapes-BBox201',
      reference_kind: 'research', source_license: 'CC BY-NC-SA 4.0', review_status: 'local-unreviewed',
      blocks: [{ id: 'cvs', type: 'CVS self-check', title: 'Judge the three criteria', content: 'Say whether each criterion is achieved.' }] } } }))
  await page.route('**/api/v1/academy/attempts/attempt-1/cvs-self-check/cvs', route => {
    if (route.request().method() === 'GET') return committed ? route.fulfill({ json: committed }) : route.fulfill({ status: 404, json: { detail: { code: 'CVS_SELF_CHECK_NOT_COMMITTED' } } })
    const { judgements } = route.request().postDataJSON() as { judgements: number[] }
    committed = {
      block_id: 'cvs', frame_id: frame.id, judgements, matches: 2, committed_at: '2026-10-10T12:00:00Z',
      source: 'Endoscapes-BBox201 val frame 2_100.jpg; image SHA-256 ' + 'a'.repeat(64),
      limitations: ['Each reference value is the mean of three annotators, so a fractional value means they disagreed.'],
      criteria: [
        { criterion_id: 'two_structures', label: 'Two structures visualized', judgement: judgements[0], annotator_mean: 2 / 3, annotators_disagreed: true, matches_majority: judgements[0] === 1 },
        { criterion_id: 'hepatocystic_triangle', label: 'Hepatocystic triangle cleared', judgement: judgements[1], annotator_mean: 2 / 3, annotators_disagreed: true, matches_majority: judgements[1] === 1 },
        { criterion_id: 'cystic_plate', label: 'Cystic plate visualized', judgement: judgements[2], annotator_mean: 1 / 3, annotators_disagreed: true, matches_majority: judgements[2] === 0 },
      ],
    }
    return route.fulfill({ json: committed })
  })

  await page.goto('/academy/missions/assignment-1')
  await page.getByLabel('Username').fill('learner')
  await page.getByLabel('Password').fill('synthetic-password')
  await page.getByRole('button', { name: 'Sign in as student' }).click()

  await expect(page.getByText('Commit your CVS self-check before submitting.')).toBeVisible()
  const commit = page.getByRole('button', { name: 'Commit my judgement' })
  await expect(commit).toBeDisabled()
  await expect(page.getByText(/annotators marked it achieved/)).toHaveCount(0)
  const groups = page.locator('fieldset')
  await groups.nth(0).getByRole('button', { name: 'Achieved', exact: true }).click()
  await groups.nth(1).getByRole('button', { name: 'Not achieved' }).click()
  await groups.nth(2).getByRole('button', { name: 'Not achieved' }).click()
  await commit.click()

  await expect(page.getByText('Your judgement is committed')).toBeVisible()
  await expect(page.getByText('2 of 3 match the annotator majority')).toBeVisible()
  await expect(page.getByText('1 of 3 annotators marked it achieved (annotators disagreed). Mean 0.33.')).toBeVisible()
  await expect(page.getByText('Commit your CVS self-check before submitting.')).toHaveCount(0)
  expect((committed as { judgements: number[] }).judgements).toEqual([1, 0, 0])
})
