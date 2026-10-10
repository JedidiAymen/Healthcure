#!/usr/bin/env node
// Prove the app database in the running api container is encrypted at rest (SQLCipher, AES-256)
// and state what is not covered. Usage (stack running): node scripts/check-db-encryption.mjs
import { spawnSync } from 'node:child_process'

const probe = `
import json, os, sqlite3, urllib.request
path = os.environ['MEDFORGE_DB_PATH']
header = open(path, 'rb').read(16)
try:
    sqlite3.connect(path).execute('SELECT count(*) FROM sqlite_master').fetchone()
    readable = True
except sqlite3.DatabaseError:
    readable = False
health = json.load(urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=5))
print(json.dumps({'path': path, 'plain_sqlite_header': header.startswith(b'SQLite format 3'),
                  'readable_without_key': readable, 'storage_encryption': health.get('storage_encryption')}))
`
const result = spawnSync('docker', ['compose', 'exec', '-T', 'api', 'python', '-c', probe], { encoding: 'utf8' })
if (result.status !== 0) {
  console.error(`Probe failed. Is the stack running?\n${result.stdout}${result.stderr}`)
  process.exit(1)
}
const report = JSON.parse(result.stdout.trim().split('\n').at(-1))
let failures = 0
const check = (ok, message) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`); if (!ok) failures++ }
check(!report.plain_sqlite_header, `database file ${report.path} has no plain SQLite header`)
check(!report.readable_without_key, 'the standard sqlite3 driver cannot read it without the key')
check(report.storage_encryption === 'sqlcipher-aes-256', `API reports storage_encryption=${report.storage_encryption}`)
console.log(`\nNot encrypted by this control: research datasets mounted read-only from ./data (including the FiSaV patient sheet),
the SQLCipher key file in docker/secrets, and the Caddy local CA in its volume. Use OS disk encryption (for example
BitLocker) on the demo PC for those.`)
process.exit(failures ? 1 : 0)
