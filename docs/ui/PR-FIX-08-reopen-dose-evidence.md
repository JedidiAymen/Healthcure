# PR-FIX-08 — Reopen the reviewed DoseTwin source view

Evidence reports now preserve the selected slice plane alongside the voxel, ROI, overlays, and opacity. Reports with a saved DoseTwin view link back to the exact source case using the report ID; the viewer loads and applies only that report's case-matched state and suppresses browser-local restoration for that visit. A visible status is shown when the saved state cannot be loaded or does not match the case.

Older reports remain readable: their missing plane defaults to Z, matching the former viewer default. No imaging arrays, prediction artifacts, report calculations, or source identities are changed.

## Files

- `apps/api/app/schemas.py` — validates a plane index from 0 through 2, with Z as the backwards-compatible default.
- `apps/api/tests/test_contracts.py` — verifies that report persistence retains the selected plane.
- `packages/contracts/generated-api.ts` and `contracts/openapi-implemented.json` — regenerated API contract.
- `src/lib/api.ts` and `src/lib/workspace-preferences.ts` — typed and validated plane state.
- `src/pages/Pages.tsx` and `src/pages/DoseViewer.tsx` — report action and case-scoped state restoration.
- `src/lib/workspace-preferences.test.ts` — verifies valid, invalid, and legacy plane state handling.

## Verification

Checks passed: `npm run typecheck`, `npm run lint`, `npm run test` (36 passed), `npm run build`, `npm run contracts:check`, and `python3 -m pytest apps/api/tests/test_contracts.py -k report_is_saved_idempotently_with_run_provenance_and_limitations -q` (1 passed). The full Playwright suite ran 10 tests: 9 passed; the pre-existing Educator builder test failed its 200% zoom picker-height assertion (measured 239px against its 180px expectation), outside this report change. No new screenshot is claimed for this change.
