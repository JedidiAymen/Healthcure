import { configDefaults, defineConfig } from 'vitest/config'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

const apiProxy = {
  '/api': {
    target: `http://127.0.0.1:${process.env.MEDFORGE_API_PORT ?? '8000'}`,
    changeOrigin: false,
  },
}

// Lists every built asset so the service worker can precache screens not yet opened (degraded mode).
const serviceWorkerAssets = (): Plugin => ({
  name: 'medforge-sw-assets',
  apply: 'build',
  generateBundle(_options, bundle) {
    const assets = Object.keys(bundle).filter(name => name.startsWith('assets/')).sort().map(name => `/${name}`)
    this.emitFile({ type: 'asset', fileName: 'sw-assets.json', source: JSON.stringify(assets) })
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorkerAssets()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: { host: '127.0.0.1', proxy: apiProxy },
  preview: { host: '127.0.0.1', proxy: apiProxy },
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
})
