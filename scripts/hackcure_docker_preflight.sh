#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="$ROOT/data/hackcure-docker/medforge.sqlite3"
CASE_DIR="$ROOT/data/openkbp-opt/pt_241"

# Match the host-side paths to the bind mounts and container paths declared in
# docker-compose.hackcure.yml. The doctor opens this database read-only.
export MEDFORGE_DB_PATH="$DB_PATH"
export MEDFORGE_OPENKBP_FULL_CASES_JSON="{\"openkbp:pt_241\":\"$CASE_DIR\"}"

cd "$ROOT"
npm run doctor -- --hackcure-preflight
