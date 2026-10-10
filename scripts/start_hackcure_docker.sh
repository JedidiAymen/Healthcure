#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CASE_DIR="$ROOT/data/openkbp-opt/pt_241"
DB_DIR="$ROOT/data/hackcure-docker"

source "$ROOT/scripts/lib/hackcure-compose-version.sh"
require_hackcure_compose
if [ ! -f "$CASE_DIR/medforge-source-manifest.json" ] || [ ! -f "$CASE_DIR/ct.csv" ] || [ ! -f "$CASE_DIR/prediction-set_1.csv" ]; then
  printf 'Verified OpenKBP-Opt pt_241 files are missing. Follow RUN_LOCAL.md source setup first.\n' >&2
  exit 1
fi

export MEDFORGE_HACKCURE_DB_DIR="$DB_DIR"
export MEDFORGE_HACKCURE_UID="$(id -u)"
export MEDFORGE_HACKCURE_GID="$(id -g)"
mkdir -p "$DB_DIR"

compose=(docker compose -f "$ROOT/docker-compose.yml" -f "$ROOT/docker-compose.hackcure.yml")
"${compose[@]}" config --format json | node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", () => {
  const config = JSON.parse(input);
  const proxyPorts = config.services?.proxy?.ports ?? [];
  if (!proxyPorts.length || proxyPorts.some((port) => port.host_ip !== "127.0.0.1")) {
    throw new Error("Compose proxy ports are not all bound to 127.0.0.1.");
  }
  for (const [name, service] of Object.entries(config.services ?? {})) {
    if (name !== "proxy" && (service.ports ?? []).length) {
      throw new Error(`Compose service ${name} publishes a host port.`);
    }
  }
  console.log("Compose configuration check passed: only the proxy publishes loopback ports.");
});
'
"${compose[@]}" up -d --no-build --pull never

printf '\nLocal HackCure stack started at https://localhost:%s\n' "${MEDFORGE_HTTPS_PORT:-8443}"
printf 'Flagship route: https://localhost:%s/studio/dosetwin/cases/openkbp%%3Apt_241\n' "${MEDFORGE_HTTPS_PORT:-8443}"
printf 'Shared host/API database: %s/medforge.sqlite3\n' "$DB_DIR"
printf 'Stop with: docker compose -f docker-compose.yml -f docker-compose.hackcure.yml down\n'
printf 'No demo accounts are seeded by this profile. App startup may apply database schema migrations.\n'
