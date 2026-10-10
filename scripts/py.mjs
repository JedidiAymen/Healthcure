#!/usr/bin/env node
// Run a project Python script with the project venv on any OS: node scripts/py.mjs <script> [args]
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePython } from './lib/python-env.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [script, ...args] = process.argv.slice(2)
if (!script) {
  console.error('Usage: node scripts/py.mjs <script.py> [args...]')
  process.exit(2)
}
const python = resolvePython({ root: ROOT })
const result = spawnSync(python, [script, ...args], { stdio: 'inherit' })
if (result.error) {
  console.error(`Python executable '${python}' was not found: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
