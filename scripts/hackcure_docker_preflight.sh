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
compose_config="$("${compose[@]}" config --format json)"
printf '%s\n' "$compose_config" | node -e '
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

# The launcher uses --no-build --pull never. Check all resolved image tags
# before the operator attempts startup, without pulling, building, or starting
# a service. `compose config --images` emits the exact tags selected above.
missing_images=0
while IFS= read -r image; do
  [ -n "$image" ] || continue
  if docker image inspect "$image" >/dev/null 2>&1; then
    printf 'HackCure local image available: %s\n' "$image"
  else
    printf 'HackCure local image missing: %s (prepare it before offline rehearsal)\n' "$image" >&2
    missing_images=1
  fi
done < <("${compose[@]}" config --images | sort -u)
if [ "$missing_images" -ne 0 ]; then
  exit 1
fi
printf 'HackCure no-pull image readiness: PASS\n'

# A same-machine cold start needs the images above. A second-machine/offline
# rehearsal also needs an image bundle built from this exact checkout. Surface
# that separate gate here so an old but checksum-valid archive cannot be
# mistaken for a transferable build of the current source.
bundle_dir="$ROOT/data/hackcure-docker/backups/images"
bundle=""
if [ -d "$bundle_dir" ]; then
  bundle="$(python3 -c 'import glob, os, sys; paths = glob.glob(os.path.join(sys.argv[1], "hackcure-images-*.tar.gz")); print(max(paths, key=os.path.getmtime) if paths else "")' "$bundle_dir")"
fi
bundle_ready=1
if [ -z "$bundle" ]; then
  printf 'HackCure current-source image bundle: FAIL (none found; prepare before second-machine/offline rehearsal)\n' >&2
  bundle_ready=0
elif python3 "$ROOT/scripts/hackcure_verify_image_bundle.py" "$bundle" --expected-source-commit "$(git -C "$ROOT" rev-parse HEAD)"; then
  printf 'HackCure current-source image bundle: PASS\n'
else
  printf 'HackCure current-source image bundle: FAIL (stale or invalid; rebuild after selecting the release commit)\n' >&2
  bundle_ready=0
fi

cd "$ROOT"
doctor_ready=0
if npm run doctor -- --hackcure-preflight; then
  doctor_ready=1
fi

if [ "$bundle_ready" -ne 1 ] || [ "$doctor_ready" -ne 1 ]; then
  exit 1
fi
