# MEDFORGE v0.8 — Executable Reference Architecture (PRE-LOCK)

**2026-10-09.** This package carries forward the complete MEDFORGE project design from v0.3–v0.7 and adds a runnable **local-only reference** for database/API/scientific schema contracts. **Not an implemented product, not a model-run validation, not a clinical device.** No user-owned repository has been modified.

## Mandatory reading order for Luna XHigh
1. **`00_ARCHITECTURE_BASELINE.md`** — product goal and what must be preserved.
2. **`31_EXECUTABLE_REFERENCE_SPEC_OVERVIEW.md`** — exact implemented-versus-planned distinction.
3. **`reference_impl/README.md`** — run local API, schema checks and tests.
4. **`32_DATABASE_SCHEMA_AND_INVARIANTS.md`** — migration, source ownership and lesson/run invariants.
5. **`33_API_ENDPOINTS_ERRORS_AND_EXAMPLES.md`** — real routes versus planned routes, contracts, errors.
6. **`34_SCIENTIFIC_DATA_CONTRACTS_AND_REPLAY.md`** — science and visual state boundaries.
7. **`35_DEVELOPMENT_SETUP_DEPENDENCIES_AND_DEVICES.md`** — local pins and separate worker/frontend toolchains.
8. **`36_SECURITY_AUTH_AND_EDUCATIONAL_INTEGRITY.md`** — non-negotiable authorization and grading integrity.
9. **`37_ACCEPTANCE_TESTS_AND_EVIDENCE_LEVELS.md`** — avoid claiming synthetic tests prove real medical validity.
10. **`38_LUNA_XHIGH_MASTER_EXECUTION_HANDOFF_V08.md`** — complete task graph, PR order, definitions of done.
11. **`39_ARCHITECTURE_PRELOCK_DECISIONS_AND_SIGNOFF.md`** — decisions stable vs open.
12. **`40_SOURCE_PINS_AND_CAPABILITY_INDEX.md`** — source commits and full feature-preservation list.
13. Read **`17–30`** for feasibility and earlier Luna plans and **`01–16`** for detailed scientific UI, charts, gamification, education and visual system.

## New working code and contracts
```text
reference_impl/
  apps/api/app/{main.py,schemas.py,openkbp.py}
  apps/api/tests/test_contracts.py
  apps/api/requirements{,-test}.txt
  db/migrations/0001_init.sql
  contracts/openapi-implemented.json     # generated, only actual routes
  packages/contracts/selection.ts       # typed visual selection union
  scripts/{check_sql_schema.py,export_openapi.py,run_reference_checks.sh}
  .env.example
  .nvmrc
  README.md
```

## Run verification
```bash
cd reference_impl
python -m pip install -r apps/api/requirements-test.txt
bash scripts/run_reference_checks.sh
cd ..
python -m pytest -q tests/test_openkbp_case.py
```
The tests use **synthetic non-clinical fixtures** only, and do not download or certify published model weights, source datasets, a complete frontend or a radiotherapy optimizer.

## Stable architecture
- One product, three independent scientific domains: SurgiVision, DoseTwin, FistulaGuard.
- Three experiences: Professional Studio, Educator Studio, Student Academy, sharing authentic scientific evidence and a common provenance chain.
- React/Vite/shadcn UI, modular FastAPI, typed artifact/job/learning contracts, scientific workers isolated by dependencies.
- Long-term upstream feature parity preserved; each capability is independently labeled ready, blocked or planned rather than deleted.

## Decisions and permissions
Current product architecture is only **provisionally stable**; v1.0 final user approval is pending. Repo integration, external git pushes, model downloads, protected-data access, identity, hosting and licensed clinical software use are not authorized by these docs.
