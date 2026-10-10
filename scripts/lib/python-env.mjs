// Cross-platform helpers shared by the local launcher and the Python script runner.
import { existsSync } from 'node:fs'
import path from 'node:path'

export function venvPython(venvDir, platform = process.platform) {
  return platform === 'win32' ? path.join(venvDir, 'Scripts', 'python.exe') : path.join(venvDir, 'bin', 'python')
}

export function resolvePython({ root, platform = process.platform, env = process.env, exists = existsSync }) {
  if (env.MEDFORGE_PYTHON) return env.MEDFORGE_PYTHON
  const projectVenv = venvPython(path.join(root, 'apps', 'api', '.venv'), platform)
  if (exists(projectVenv)) return projectVenv
  return platform === 'win32' ? 'python' : 'python3'
}

function port(name, raw, fallback) {
  const value = raw ?? String(fallback)
  if (!/^[0-9]+$/.test(value)) throw new Error(`${name} must be numeric (received '${value}')`)
  const number = Number(value)
  if (number < 1 || number > 65535) throw new Error(`${name} '${value}' must be between 1 and 65535`)
  return number
}

export function localPorts(env = process.env) {
  const api = port('MEDFORGE_API_PORT', env.MEDFORGE_API_PORT, 8000)
  const web = port('MEDFORGE_WEB_PORT', env.MEDFORGE_WEB_PORT, 5173)
  if (api === web) throw new Error('API and web ports must differ')
  return { api, web }
}
