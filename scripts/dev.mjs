#!/usr/bin/env node
// Start the loopback FastAPI service and the Vite web app together on any OS.
// Ctrl+C, a closed terminal, or either service exiting stops both process trees.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { localPorts, resolvePython } from './lib/python-env.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function fail(message) {
  console.error(`MEDFORGE could not start: ${message}`)
  process.exit(1)
}

let ports
try { ports = localPorts() } catch (error) { fail(error.message) }

const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
if (!existsSync(vite)) fail(`web dependencies are missing; run npm ci in ${ROOT}`)
const python = resolvePython({ root: ROOT })
const check = spawnSync(python, ['-c', 'import fastapi, uvicorn'], { stdio: 'ignore' })
if (check.error) fail(`Python executable '${python}' was not found`)
if (check.status !== 0) fail(`FastAPI and Uvicorn are missing for '${python}'; install apps/api/requirements-test.txt in that environment`)

const env = { ...process.env }
if (env.MEDFORGE_DB_PATH === undefined) env.MEDFORGE_DB_PATH = path.join(ROOT, 'data', 'local.sqlite3')
const sourceDefaults = [
  ['MEDFORGE_OPENKBP_CASE_DIR', path.join(ROOT, 'data', 'openkbp', 'pt_201'), 'dose.csv'],
  ['MEDFORGE_ENDOSCAPES_ROOT', path.join(ROOT, 'data', 'endoscapes'), null],
  ['MEDFORGE_FISAV_ROOT', path.join(ROOT, 'data', 'fisav'), null],
  ['MEDFORGE_CHOLECT50_VALIDATION_ROOT', path.join(ROOT, 'data', 'cholect50', 'challenge-validation'), null],
]
for (const [name, dir, marker] of sourceDefaults) {
  if (env[name] === undefined && existsSync(marker ? path.join(dir, marker) : dir)) env[name] = dir
}
// A verified pt_241 case is fully enabled with its prediction, otherwise viewer only.
if (env.MEDFORGE_OPENKBP_CASES_JSON === undefined && env.MEDFORGE_OPENKBP_FULL_CASES_JSON === undefined) {
  const secondCase = path.join(ROOT, 'data', 'openkbp-opt', 'pt_241')
  if (existsSync(path.join(secondCase, 'dose.csv'))) {
    const variable = existsSync(path.join(secondCase, 'prediction-set_1.csv')) ? 'MEDFORGE_OPENKBP_FULL_CASES_JSON' : 'MEDFORGE_OPENKBP_CASES_JSON'
    env[variable] = JSON.stringify({ 'openkbp:pt_241': secondCase })
  }
}
env.MEDFORGE_BIND = '127.0.0.1'
const expectedApi = `http://127.0.0.1:${ports.api}`
if (env.VITE_API_URL && env.VITE_API_URL !== expectedApi) fail(`VITE_API_URL must stay on the local API at ${expectedApi}`)
env.VITE_API_URL = ''
env.MEDFORGE_API_PORT = String(ports.api)
env.MEDFORGE_WEB_PORT = String(ports.web)

const isWindows = process.platform === 'win32'
const children = []
function start(command, args, cwd) {
  // POSIX children lead their own process group so the whole tree can be signalled.
  const child = spawn(command, args, { cwd, env, stdio: 'inherit', detached: !isWindows })
  children.push(child)
  child.on('exit', (code, signal) => stop(code ?? (signal ? 1 : 0)))
  return child
}

function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return
  if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else { try { process.kill(-child.pid, 'SIGTERM') } catch { /* already gone */ } }
}

let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) killTree(child)
  process.exit(code)
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(0))
process.on('exit', () => { for (const child of children) killTree(child) })

const api = start(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(ports.api)], path.join(ROOT, 'apps', 'api'))
const web = start(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(ports.web), '--strictPort'], ROOT)
// A force-killed launcher runs no exit handlers, so a detached watchdog stops the services instead.
spawn(process.execPath, [path.join(ROOT, 'scripts', 'lib', 'orphan-guard.mjs'), String(process.pid), String(api.pid), String(web.pid)],
  { detached: true, stdio: 'ignore', windowsHide: true }).unref()

console.log(`MEDFORGE local workspace
  Web: http://127.0.0.1:${ports.web}
  API: http://127.0.0.1:${ports.api}
  Database: ${env.MEDFORGE_DB_PATH}

Press Ctrl+C to stop both local services.`)
