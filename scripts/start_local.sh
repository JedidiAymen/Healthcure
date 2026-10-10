#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -n "${MEDFORGE_PYTHON:-}" ]; then
  PYTHON_BIN="$MEDFORGE_PYTHON"
elif [ -x "$ROOT/apps/api/.venv/bin/python" ]; then
  PYTHON_BIN="$ROOT/apps/api/.venv/bin/python"
else
  PYTHON_BIN=python3
fi
API_PORT="${MEDFORGE_API_PORT:-8000}"
WEB_PORT="${MEDFORGE_WEB_PORT:-5173}"
API_PID=""
WEB_PID=""

fail() {
  printf 'MEDFORGE could not start: %s\n' "$1" >&2
  exit 1
}

for port in "$API_PORT" "$WEB_PORT"; do
  case "$port" in
    ''|*[!0-9]*) fail "ports must be numeric (received '$port')" ;;
  esac
  [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || fail "port '$port' must be between 1 and 65535"
done
[ "$API_PORT" -ne "$WEB_PORT" ] || fail 'API and web ports must differ'

[ -x "$ROOT/node_modules/.bin/vite" ] || fail "web dependencies are missing; run npm ci in $ROOT"
command -v "$PYTHON_BIN" >/dev/null 2>&1 || fail "Python executable '$PYTHON_BIN' was not found"
"$PYTHON_BIN" -c 'import fastapi, uvicorn' >/dev/null 2>&1 || fail "FastAPI and Uvicorn are missing for '$PYTHON_BIN'; install apps/api/requirements-test.txt in that environment"

if [ -z "${MEDFORGE_DB_PATH+x}" ]; then
  export MEDFORGE_DB_PATH="$ROOT/data/local.sqlite3"
fi
if [ -z "${MEDFORGE_OPENKBP_CASE_DIR+x}" ]; then
  case_dir="$ROOT/data/openkbp/pt_201"
  if [ -f "$case_dir/dose.csv" ]; then export MEDFORGE_OPENKBP_CASE_DIR="$case_dir"; fi
fi
if [ -z "${MEDFORGE_OPENKBP_CASES_JSON+x}" ]; then
  viewer_case_dir="$ROOT/data/openkbp-opt/pt_241"
  if [ -f "$viewer_case_dir/dose.csv" ]; then
    export MEDFORGE_OPENKBP_CASES_JSON="$("$PYTHON_BIN" -c 'import json,sys; print(json.dumps({"openkbp:pt_241":sys.argv[1]}))' "$viewer_case_dir")"
  fi
fi
if [ -z "${MEDFORGE_ENDOSCAPES_ROOT+x}" ] && [ -d "$ROOT/data/endoscapes" ]; then
  export MEDFORGE_ENDOSCAPES_ROOT="$ROOT/data/endoscapes"
fi
if [ -z "${MEDFORGE_FISAV_ROOT+x}" ] && [ -d "$ROOT/data/fisav" ]; then
  export MEDFORGE_FISAV_ROOT="$ROOT/data/fisav"
fi
export MEDFORGE_BIND=127.0.0.1
EXPECTED_API_URL="http://127.0.0.1:${API_PORT}"
if [ -n "${VITE_API_URL:-}" ] && [ "$VITE_API_URL" != "$EXPECTED_API_URL" ]; then
  fail "VITE_API_URL must stay on the local API at $EXPECTED_API_URL"
fi
export VITE_API_URL=""

cleanup() {
  trap - INT TERM EXIT
  for pid in "$API_PID" "$WEB_PID"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then kill "$pid" 2>/dev/null || true; fi
  done
  for pid in "$API_PID" "$WEB_PID"; do
    if [ -n "$pid" ]; then wait "$pid" 2>/dev/null || true; fi
  done
}
trap cleanup INT TERM EXIT

(
  cd "$ROOT/apps/api"
  "$PYTHON_BIN" -m uvicorn app.main:app --host 127.0.0.1 --port "$API_PORT"
) &
API_PID=$!

(
  cd "$ROOT"
  npm run dev -- --port "$WEB_PORT" --strictPort
) &
WEB_PID=$!

printf 'MEDFORGE local workspace\n  Web: http://127.0.0.1:%s\n  API: http://127.0.0.1:%s\n  Database: %s\n\nPress Ctrl+C to stop both local services.\n' \
  "$WEB_PORT" "$API_PORT" "$MEDFORGE_DB_PATH"

wait -n "$API_PID" "$WEB_PID"
