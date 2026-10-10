#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="$ROOT/data/hackcure-docker/medforge.sqlite3"
CASE_DIR="$ROOT/data/openkbp-opt/pt_241"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  printf 'Docker Engine with the Compose plugin is required.\n' >&2
  exit 1
fi

# Match the host-side paths to the bind mounts and container paths declared in
# docker-compose.hackcure.yml. The doctor opens this database read-only.
export MEDFORGE_DB_PATH="$DB_PATH"
export MEDFORGE_OPENKBP_FULL_CASES_JSON="{\"openkbp:pt_241\":\"$CASE_DIR\"}"
export MEDFORGE_HACKCURE_DB_DIR="$ROOT/data/hackcure-docker"
export MEDFORGE_HACKCURE_UID="$(id -u)"
export MEDFORGE_HACKCURE_GID="$(id -g)"

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
  console.log("HackCure Docker loopback configuration: PASS");
});
'

cd "$ROOT"
npm run doctor -- --hackcure-preflight
