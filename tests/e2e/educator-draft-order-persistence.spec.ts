import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

test('educator block order survives keyboard and pointer sorting, save, reopen, and learner preview @source', async ({ page }) => {
  test.setTimeout(90_000)
  const username = process.env.MEDFORGE_E2E_RESEARCH_USERNAME
  const password = process.env.MEDFORGE_E2E_RESEARCH_PASSWORD
  const lessonTitle = `Source-backed ordering persistence check ${Date.now()}`
  expect(username && password, 'Set credentials for an educator in the disposable source profile').toBeTruthy()

  const signIn = async () => {
    await page.goto('/educator')
    await page.getByLabel('Username').fill(username!)
    await page.getByLabel('Password').fill(password!)
    const login = page.waitForResponse(response =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/auth/local-login',
    )
    await page.getByRole('button', { name: 'Sign in as educator' }).click()
    const response = await login
    expect(response.ok()).toBeTruthy()
    expect((await response.json() as { user: { role: string } }).user.role).toBe('educator')
  }

  await signIn()
  await page.getByRole('button', { name: 'Create case lesson' }).click()
  await expect(page).toHaveURL(/\/educator\/cases\/new\/edit$/)
  await page.getByLabel('Lesson title').fill(lessonTitle)
  const sourcePicker = page.getByRole('combobox', { name: 'Research source' })
  await sourcePicker.click()
  await sourcePicker.fill('pat021')
  await page.getByRole('option', { name: /pat021/i }).first().click()

  const instructionTitle = page.getByRole('textbox', { name: 'Instruction title' })
  await instructionTitle.fill('Observe the measured signal')
  await page.getByRole('button', { name: 'Question', exact: true }).click()
  const questionTitle = page.getByRole('textbox', { name: 'Question title' })
  await questionTitle.fill('Explain the observed signal')
  await page.getByRole('button', { name: 'Reveal', exact: true }).click()
  await page.getByRole('textbox', { name: 'Reveal title' }).fill('Educator-only reference answer')

  // Reorder from the keyboard-accessible move control, then exercise pointer sorting in the opposite direction.
  const moveQuestionUp = page.getByRole('button', { name: 'Move Question up' })
  await moveQuestionUp.focus()
  await moveQuestionUp.press('Enter')
  const blocks = page.locator('.lesson-block')
  const titles = () => blocks.locator('input[aria-label$="title"]').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))
  await expect.poll(titles).toEqual(['Explain the observed signal', 'Observe the measured signal', 'Educator-only reference answer'])

  const draggedQuestion = page.getByRole('button', { name: 'Drag Question block' })
  const instructionCard = blocks.filter({ has: page.getByRole('textbox', { name: 'Instruction title' }) })
  const from = await draggedQuestion.boundingBox()
  const to = await instructionCard.boundingBox()
  expect(from && to).toBeTruthy()
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2)
  await page.mouse.down()
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect.poll(titles).toEqual(['Observe the measured signal', 'Explain the observed signal', 'Educator-only reference answer'])

  const saveResponsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/educator/drafts',
  )
  await page.getByRole('button', { name: 'Save draft' }).click()
  const savedResponse = await saveResponsePromise
  expect(savedResponse.status()).toBe(201)
  const saved = await savedResponse.json() as { id: string; revision: number; content: { blocks: Array<{ type: string; title: string }> } }
  expect(saved.content.blocks.map(block => block.title)).toEqual(['Observe the measured signal', 'Explain the observed signal', 'Educator-only reference answer'])
  await expect(page).toHaveURL(new RegExp(`${saved.id}/edit$`))

  // Reload exercises persisted server state; authenticate again because educator sessions are held in memory.
  await page.reload()
  await signIn()
  await page.getByRole('link', { name: new RegExp(lessonTitle) }).click()
  await expect.poll(titles).toEqual(['Observe the measured signal', 'Explain the observed signal', 'Educator-only reference answer'])

  const captureDir = '.local-review/UX-43-educator-order'
  await mkdir(captureDir, { recursive: true })
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'phone', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `${captureDir}/educator-draft-${viewport.name}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 900 })

  const previewResponsePromise = page.waitForResponse(response =>
    response.request().method() === 'GET' && new URL(response.url()).pathname === `/api/v1/educator/drafts/${saved.id}/preview`,
  )
  await page.getByRole('button', { name: 'Preview publication' }).click()
  const previewResponse = await previewResponsePromise
  expect(previewResponse.ok()).toBeTruthy()
  const preview = await previewResponse.json() as { blocks: Array<{ title: string }> }
  expect(preview.blocks.map(block => block.title)).toEqual(['Observe the measured signal', 'Explain the observed signal'])
  const publication = page.getByText('Student-safe preview').locator('../..')
  await expect(publication).toContainText('Observe the measured signal')
  await expect(publication).toContainText('Explain the observed signal')
  await expect(publication.getByText('Observe the measured signal').first()).toBeVisible()
  await expect(publication.getByText('Explain the observed signal').first()).toBeVisible()
  await expect(publication).not.toContainText('Educator-only reference answer')
  await expect(publication).not.toContainText('Evidence use')
})
