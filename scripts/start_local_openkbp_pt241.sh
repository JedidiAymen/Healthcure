#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CASE_DIR="$ROOT/data/openkbp-opt/pt_241"

if [ ! -f "$CASE_DIR/ct.csv" ] || [ ! -f "$ROOT/data/openkbp-opt/pt_241/prediction-set_1.csv" ]; then
  printf 'Verified OpenKBP-Opt pt_241 files are missing. Follow the local source setup in RUN_LOCAL.md.\n' >&2
  exit 1
fi

export MEDFORGE_OPENKBP_CASE_DIR="$CASE_DIR"
export MEDFORGE_DB_PATH="${MEDFORGE_DB_PATH:-$ROOT/data/openkbp-opt/pt_241/local.sqlite3}"
export MEDFORGE_API_PORT="${MEDFORGE_API_PORT:-18082}"
export MEDFORGE_WEB_PORT="${MEDFORGE_WEB_PORT:-15176}"

exec "$ROOT/scripts/start_local.sh"
