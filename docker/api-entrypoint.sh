#!/bin/sh
# Seed the local database (idempotent; migrations run on first use), then start the API.
set -eu

: "${MEDFORGE_DB_PATH:=/var/lib/medforge/db/medforge.sqlite3}"
export MEDFORGE_DB_PATH

# A verified pt_241 case is fully enabled with its prediction, otherwise viewer only.
case_241=/datasets/openkbp-opt/pt_241
if [ -z "${MEDFORGE_OPENKBP_FULL_CASES_JSON:-}" ] && [ -z "${MEDFORGE_OPENKBP_CASES_JSON:-}" ] && [ -f "$case_241/dose.csv" ]; then
  if [ -f "$case_241/prediction-set_1.csv" ]; then
    export MEDFORGE_OPENKBP_FULL_CASES_JSON="{\"openkbp:pt_241\":\"$case_241\"}"
  else
    export MEDFORGE_OPENKBP_CASES_JSON="{\"openkbp:pt_241\":\"$case_241\"}"
  fi
fi

python /app/scripts/seed_demo.py --db "$MEDFORGE_DB_PATH"
# The API listens on the private compose network only; the proxy is the single public entry.
exec python -m uvicorn app.main:app --app-dir /app/apps/api --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'
