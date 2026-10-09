#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export MEDFORGE_DB_PATH="$(mktemp -u /tmp/medforge-reference-openapi-XXXXXX.sqlite3)"
python scripts/check_sql_schema.py
python -m pytest -q apps/api/tests/test_contracts.py
python scripts/export_openapi.py
TSC="$ROOT/node_modules/.bin/tsc"
if [[ -x "$TSC" ]]; then
  "$TSC" --noEmit --strict --target ES2022 --moduleResolution bundler --skipLibCheck packages/contracts/selection.ts
  echo 'TYPESCRIPT SELECTION CONTRACT PASS'
else
  echo 'TypeScript not present; run npm ci before the reference checks.'
fi
