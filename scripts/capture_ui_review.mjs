import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const baseUrl = process.env.UI_REVIEW_BASE_URL ?? 'http://127.0.0.1:5173'
const outputDir = process.env.UI_REVIEW_DIR ?? '.local-review/current'
const requestedViewports = process.env.UI_REVIEW_VIEWPORTS ?? '1440x900,1280x800,768x1024,390x844'
const viewports = requestedViewports.split(',').map((size) => {
  const [width, height] = size.split('x').map(Number)
  if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error(`Invalid viewport: ${size}`)
  return { width, height, name: size }
})

const routes = [
  ['home', '/'],
  ['studio', '/studio'],
  ['cases', '/studio/cases'],
  ['dose-twin', '/studio/dosetwin/cases/current'],
  ['surgi-vision', '/studio/surgivision/cases/current'],
  ['fistula-guard', '/studio/fistulaguard/cases/current'],
  ['models', '/studio/models'],
  ['experiments', '/studio/experiments'],
  ['reports', '/studio/reports'],
  ['academy', '/academy'],
  ['academy-mission', '/academy/missions/demo'],
  ['educator', '/educator'],
  ['educator-builder', '/educator/cases/demo/edit'],
]

await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
    for (const [name, route] of routes) {
      const errors = []
      const onPageError = (error) => errors.push(error.message)
      page.on('pageerror', onPageError)
      const response = await page.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle', timeout: 30_000 })
      await page.waitForTimeout(150)
      const metrics = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
      }))
      const file = path.join(outputDir, `${name}-${viewport.name}.png`)
      await page.screenshot({ path: file, animations: 'disabled' })
      results.push({
        route,
        title: await page.title(),
        finalUrl: page.url(),
        status: response?.status() ?? null,
        ...metrics,
        horizontalOverflow: metrics.documentWidth > metrics.width,
        pageErrors: errors,
        screenshot: path.resolve(file),
      })
      page.off('pageerror', onPageError)
    }
    await page.close()
  }
} finally {
  await browser.close()
}

const report = { baseUrl, outputDir: path.resolve(outputDir), results }
await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
