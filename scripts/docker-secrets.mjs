#!/usr/bin/env node
// Create local Docker secrets once: a random 256-bit SQLCipher key in docker/secrets/db_key.
// The file is git-ignored. Losing it makes the encrypted database unreadable, so back it up.
import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(ROOT, 'docker', 'secrets')
const keyFile = path.join(dir, 'db_key')
mkdirSync(dir, { recursive: true })
if (existsSync(keyFile)) {
  console.log(`Kept existing database key: ${path.relative(ROOT, keyFile)}`)
} else {
  writeFileSync(keyFile, randomBytes(32).toString('hex') + '\n', { mode: 0o600 })
  try { chmodSync(keyFile, 0o600) } catch { /* Windows keeps its own ACLs */ }
  console.log(`Created a new 256-bit database key: ${path.relative(ROOT, keyFile)} (back it up; it cannot be recovered)`)
}
