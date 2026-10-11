import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

// Privacy self-service on synthetic responses; the server rules are covered by test_account_privacy.py.
const user = { id: 'privacy-qa', display_name: 'Privacy QA', role: 'student' }

test('a signed-in account can download its data and erase itself with password and typed confirmation', async ({ page }) => {
  let erased: { password: string; confirm: string } | null = null
  await page.route('**/api/v1/auth/local-login', route => route.fulfill({ json: { access_token: 'qa-token', token_type: 'bearer', expires_at: '2026-10-11T21:00:00Z', user } }))
  await page.route('**/api/v1/auth/logout', route => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/account/export', route => route.request().headers().authorization === 'Bearer qa-token'
    ? route.fulfill({ json: { schema: 'medforge.account-export/v1', profile: { display_name: 'Privacy QA' }, learner_code: 'L-0123abcd' } })
    : route.fulfill({ status: 401, json: { detail: { code: 'AUTH_REQUIRED' } } }))
  await page.route('**/api/v1/account/erase', route => { erased = route.request().postDataJSON(); return route.fulfill({ json: { status: 'erased', learner_code: 'L-0123abcd', display_name: 'Erased account L-0123abcd' } }) })

  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Sign in to manage your data' })).toBeVisible()
  await page.getByLabel('Username').fill('privacy-qa')
  await page.getByLabel('Password').fill('test-only')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Your data' })).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download my data' }).click()
  const file = await download
  expect(JSON.parse(await readFile(await file.path(), 'utf8'))).toMatchObject({ schema: 'medforge.account-export/v1' })

  const eraseButton = page.getByRole('button', { name: 'Erase my account' })
  await page.getByLabel('Current password').fill('test-only')
  await expect(eraseButton).toBeDisabled()
  await page.getByLabel(/Type ERASE MY ACCOUNT/).fill('ERASE MY ACCOUNT')
  await eraseButton.click()
  await expect(page.getByText('Account erased')).toBeVisible()
  expect(erased).toEqual({ password: 'test-only', confirm: 'ERASE MY ACCOUNT' })
})
