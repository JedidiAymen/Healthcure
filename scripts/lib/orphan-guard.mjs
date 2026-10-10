// Detached watchdog for scripts/dev.mjs: if the launcher is force-killed (Task
// Manager, IDE stop button) it cannot clean up, so this stops the service trees.
// Usage: node orphan-guard.mjs <launcherPid> <childPid> [childPid...]
import { spawnSync } from 'node:child_process'

const [launcher, ...children] = process.argv.slice(2).map(Number)

function alive(pid) {
  try { process.kill(pid, 0); return true } catch (error) { return error.code === 'EPERM' }
}

function killTree(pid) {
  if (!alive(pid)) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
  else { try { process.kill(-pid, 'SIGTERM') } catch { try { process.kill(pid, 'SIGTERM') } catch { /* already gone */ } } }
}

const timer = setInterval(() => {
  if (!children.some(alive)) { clearInterval(timer); return }
  if (!alive(launcher)) {
    for (const pid of children) killTree(pid)
    clearInterval(timer)
  }
}, 1000)
