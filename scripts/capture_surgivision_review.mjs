import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const baseUrl = process.env.UI_REVIEW_BASE_URL ?? 'http://127.0.0.1:15174'
const outputDir = process.env.UI_REVIEW_DIR ?? '.local-review/surgivision'
const route = '/studio/surgivision/cases/endoscapes%3Atest%3A162_5875'
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
]

await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const response = await page.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle', timeout: 30_000 })
    await page.getByText('Endoscapes test · video 162 · frame 5875').waitFor()
    await page.getByText('1 fps sampled frames').waitFor()
    await page.waitForFunction(() => {
      const image = document.querySelector('img[alt^="Endoscapes source image"]')
      return image?.complete && image.naturalWidth > 0
    }, null, { timeout: 20_000 })
    await page.getByText('1,933 of 1,933 frames include all three source labels.').waitFor()
    await page.getByText('2 / 123').waitFor()
    await page.getByText('Source image dimensions need verification').waitFor()
    await page.getByRole('button', { name: 'Next sampled frame' }).click()
    await page.getByText('Endoscapes test · video 162 · frame 5900').waitFor()
    await page.getByRole('button', { name: 'Previous sampled frame' }).click()
    await page.getByText('Endoscapes test · video 162 · frame 5875').waitFor()
    await page.getByRole('button', { name: 'Load licensed video excerpt' }).click()
    await page.locator('video').waitFor()
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2, null, { timeout: 20_000 })
    await page.screenshot({
      path: path.join(outputDir, `surgivision-${viewport.name}.png`),
      fullPage: true,
      animations: 'disabled',
    })
    const metrics = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      sampledFrame: document.querySelector('h1')?.textContent ?? '',
      videoDurationSeconds: document.querySelector('video')?.duration ?? null,
    }))
    results.push({
      viewport,
      status: response?.status() ?? null,
      finalUrl: page.url(),
      horizontalOverflow: metrics.documentWidth > metrics.width,
      pageErrors: errors,
      screenshot: path.resolve(outputDir, `surgivision-${viewport.name}.png`),
      ...metrics,
    })
    await page.close()
  }
} finally {
  await browser.close()
}

const report = { baseUrl, route, results }
await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
