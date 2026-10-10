import { configDefaults, defineConfig } from 'vitest/config'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiProxy = {
  '/api': {
    target: `http://127.0.0.1:${process.env.MEDFORGE_API_PORT ?? '8000'}`,
    changeOrigin: false,
  },
}
const spikeAliases = process.env.VITE_CORNERSTONE_SPIKE === '1'
  ? [{ find: 'events', replacement: path.resolve(import.meta.dirname, 'node_modules/events/events.js') }]
  : []

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: [{ find: '@', replacement: path.resolve(import.meta.dirname, './src') }, ...spikeAliases] },
  server: { host: '127.0.0.1', proxy: apiProxy },
  preview: { host: '127.0.0.1', proxy: apiProxy },
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
})
