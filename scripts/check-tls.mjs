#!/usr/bin/env node
// Prove the proxy speaks TLS 1.3 with a verifiable certificate and refuses TLS 1.2.
// Runs curl in a container on the compose network so results do not depend on the host curl build.
// Usage (with the stack running): node scripts/check-tls.mjs
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CURL_IMAGE = 'curlimages/curl:8.11.1'
const certDir = path.join(ROOT, 'docker', 'certs')
const rootCert = path.join(certDir, 'medforge-local-root.crt')

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  return { code: result.status, out: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

mkdirSync(certDir, { recursive: true })
const copied = run('docker', ['compose', 'cp', 'proxy:/data/caddy/pki/authorities/local/root.crt', rootCert])
if (copied.code !== 0) {
  console.error(`Could not export the local root certificate. Is the stack running?\n${copied.out}`)
  process.exit(1)
}
console.log(`Exported local root CA: ${path.relative(ROOT, rootCert)}`)

const network = run('docker', ['inspect', '-f', '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}', 'medforge-proxy-1']).out.trim().split(/\s+/)[0]
const curl = (...tlsArgs) => run('docker', ['run', '--rm', '--network', network, '-v', `${certDir}:/certs:ro`, CURL_IMAGE,
  '-sS', '-v', '--max-time', '10', '--cacert', '/certs/medforge-local-root.crt', '--connect-to', 'localhost:443:proxy:443',
  ...tlsArgs, '-o', '/dev/null', '-w', 'HTTP %{http_code}', 'https://localhost/healthz'])

let failures = 0
const tls13 = curl('--tlsv1.3')
const negotiated = /SSL connection using (TLSv[0-9.]+)/.exec(tls13.out)?.[1]
if (tls13.code === 0 && negotiated === 'TLSv1.3' && tls13.out.includes('HTTP 200')) {
  console.log(`PASS  TLS 1.3 handshake with a verified certificate, /healthz HTTP 200 (negotiated ${negotiated})`)
} else {
  failures++
  console.log(`FAIL  TLS 1.3 check (exit ${tls13.code}, negotiated ${negotiated ?? 'none'})\n${tls13.out}`)
}

const tls12 = curl('--tlsv1.2', '--tls-max', '1.2')
if (tls12.code !== 0 && !tls12.out.includes('HTTP 200')) {
  console.log(`PASS  TLS 1.2 refused (curl exit ${tls12.code})`)
} else {
  failures++
  console.log(`FAIL  TLS 1.2 was accepted\n${tls12.out}`)
}
process.exit(failures ? 1 : 0)
