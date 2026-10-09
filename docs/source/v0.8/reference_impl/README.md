# MEDFORGE v0.8 — Executable reference, LOCAL ONLY

This is an **implementation contract and deliberately limited functioning API**, not the complete MEDFORGE product. The accompanying v0.3–v0.7 documentation preserves all three scientific modules, Student Academy, Educator Studio, Professional Studio, Model Lab, Experiment Center and reports.

## Included and genuinely executed
- `db/migrations/0001_init.sql`: proposed schema for 21 major tables (all SQL parses in an actual SQLite in-memory database).
- `apps/api/app/schemas.py`: Pydantic V2 input/output contracts, discriminated scientific-artifact union.
- `apps/api/app/main.py`: functioning local-only endpoints for module readiness, optional OpenKBP case registry, viewer manifest, model unavailability, saved OpenKBP summary runs.
- `contracts/openapi-implemented.json`: OpenAPI 3.1 generated **from executable code** (only the routes present in the reference harness).
- `packages/contracts/selection.ts`: TypeScript workspace selection types (not yet typechecked in a React application).
- `apps/api/tests/test_contracts.py`: local synthetic contract/integration tests. Synthetic case is generated at test time; no fake medical case is packaged.
- `scripts/check_sql_schema.py`, `scripts/export_openapi.py`: reproducibility utilities.

## Important limitations
- NO authentication, authorization, user administration or role enforcement implemented. Bind only `127.0.0.1` and NEVER put this server on a public network.
- No clinical use. No surgical inference, no 3D mesh/CT browser viewer, no AVF sound inference, no radiation optimizer, no Model Lab UI, no Educator/Academy endpoints are implemented here.
- `POST /api/v1/runs` runs **synchronously** for exactly one permitted analysis operation: `openkbp.case_summary`. The eventual async job queue is specified separately.
- Its dose percentiles are exploratory; official benchmark/clinical metric equivalence is **not** established. No independent real-case official metric cross-check in this package.
- An installed local path alone does not prove a dataset's origin: operator must independently verify source manifests and permitted use.
- UI stack package versions are NOT locked until actual React 19/Vite + medical libraries pass a compatibility smoke test.

## Start locally (Python 3.13 recommended for this tested harness)
```bash
cd reference_impl
python -m venv .venv
source .venv/bin/activate
python -m pip install -r apps/api/requirements-test.txt
python scripts/check_sql_schema.py
python -m pytest -q apps/api/tests/test_contracts.py
export MEDFORGE_DB_PATH="$PWD/data/reference.sqlite3"
# To register an actual downloaded and independently verified research case:
export MEDFORGE_OPENKBP_CASE_DIR="/absolute/path/to/authorized/open-kbp/provided-data/validation-pats/pt_201"
export MEDFORGE_SOURCE_KIND=benchmark
cd apps/api
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
The API lives at `http://127.0.0.1:8000/docs`. Without configured data, `/api/v1/cases` returns `[]`; it does not invent a case.

## Regenerate source of truth
```bash
cd reference_impl
python scripts/export_openapi.py
# Example frontend client generation after actual frontend toolchain validation:
# npx openapi-typescript contracts/openapi-implemented.json -o packages/contracts/generated-api.d.ts
```
Do not manually patch generated types; fix their Pydantic model source, regenerate and review the diff.

## Proposed frontend developer contract
- One module-specific typed selection state, see `packages/contracts/selection.ts`.
- Viewer assets are identified by `asset_key` (opaque logical key), not public/absolute OS paths.
- `/viewer-manifest` does not deliver the heavy volume bytes yet; build a separately authorized binary asset endpoint or safe local file bridge.
- Attach provenance + source type to all results, including synthetic fixtures.

## Strict definition of 'verified'
- `SCHEMA PASS`: schema parses, not all relational business rules implemented.
- `API TEST PASS`: expected synthetic data behavior, not medical accuracy.
- `SOURCE CHECK`: upstream repository inspection and actual case folder presence, not ML model execution.
- `MODEL VERIFIED`: requires a pinned checkpoint and a reproducible inference test with authentic, legally usable data.
- `CLINICAL VALIDATION`: NOT achieved by this project. Do not claim it.
