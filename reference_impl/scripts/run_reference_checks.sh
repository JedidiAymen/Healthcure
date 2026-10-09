#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export MEDFORGE_DB_PATH="$(mktemp -u /tmp/medforge-reference-openapi-XXXXXX.sqlite3)"
python scripts/check_sql_schema.py
python -m pytest -q apps/api/tests/test_contracts.py
python scripts/export_openapi.py
if command -v tsc >/dev/null 2>&1; then
  tsc --noEmit --strict --target ES2022 packages/contracts/selection.ts
  echo 'TYPESCRIPT SELECTION CONTRACT PASS'
else
  echo 'TypeScript not present; run npm toolchain verification before frontend lock.'
fi
