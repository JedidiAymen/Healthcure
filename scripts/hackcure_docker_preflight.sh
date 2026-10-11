#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="$ROOT/data/hackcure-docker/medforge.sqlite3"
CASE_DIR="$ROOT/data/openkbp-opt/pt_241"

source "$ROOT/scripts/lib/hackcure-compose-version.sh"
require_hackcure_compose
source "$ROOT/scripts/lib/hackcure-dataset-roots.sh"
hackcure_configure_dataset_roots

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
  const apiMounts = config.services?.api?.volumes ?? [];
  const requiredReadOnlyTargets = [
    "/datasets",
    "/medforge-datasets/openkbp",
    "/medforge-datasets/endoscapes",
    "/medforge-datasets/fisav",
    "/medforge-datasets/appendix300",
    "/medforge-datasets/cholec80",
  ];
  for (const target of requiredReadOnlyTargets) {
    const mount = apiMounts.find((candidate) => candidate.type === "bind" && candidate.target === target);
    if (!mount || mount.read_only !== true) {
      throw new Error(`HackCure dataset bind mount ${target} is missing or not read-only.`);
    }
  }
  console.log("HackCure API dataset mounts (read-only): PASS");
  console.log("HackCure Docker loopback configuration: PASS");
});
'

cd "$ROOT"
npm run doctor -- --hackcure-preflight
