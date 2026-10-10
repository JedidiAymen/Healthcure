#!/usr/bin/env node
// Build everything the local Docker stack needs: the secret, the static web build, then the images.
// Usage: node scripts/docker-build.mjs   (run once while online; the stack then runs offline)
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function step(label, command, args, attempts = 1) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(`\n== ${label}${attempts > 1 ? ` (attempt ${attempt}/${attempts})` : ''}`)
    // Only npm.cmd needs a shell on Windows; node and docker paths may contain spaces.
    const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: command === npm && process.platform === 'win32' })
    if (result.status === 0) return
  }
  console.error(`Failed: ${label}`)
  process.exit(1)
}

step('Database key (kept if it exists)', process.execPath, ['scripts/docker-secrets.mjs'])
step('Static web build', npm, ['run', 'build'])
// Image builds download pinned Python packages; retry because slow networks drop connections.
for (const service of ['api', 'web', 'worker', 'sim-device']) {
  step(`Image ${service}`, 'docker', ['compose', '--profile', 'tools', '--profile', 'device', 'build', service], 4)
}
console.log('\nDone. Start with: docker compose up -d   (then open https://localhost:8443)')
