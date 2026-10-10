# PR-UX-18 — DoseTwin comparison report history

**Status:** implemented on `review/cobalt-dosetwin-d2-d3`; authentic `pt_241` report reopening verified against the live loopback profile. This remains a research workflow, not clinical validation.

## Change

Evidence Reports now renders `medforge.dosetwin-dose-comparison/v1` as its own record type. Reopened reports show reference and prediction SHA-256 values, the selected plane/ROI, source and model revisions, published checkpoint-hash availability, the user-declared local-use basis, all seven source-derived ROI summaries, and limitations. The report offers source-case navigation and JSON export. The parity table no longer contradicts the verified `pt_241` archive record. `pt_201` remains correctly marked as lacking a second authentic prediction.

## Files changed

- `src/pages/Pages.tsx` — dedicated persisted-comparison report card and schema-specific report classification.
- `tests/e2e/dosetwin-comparison-report.spec.ts` — live-source report save/readback check using the installed archived `pt_241` prediction and matching benchmark reference.
- `docs/PARITY.md` — reconcile `pt_241` capability with source evidence.
- `docs/STATUS.md` — record this milestone and evidence.
- `docs/ui/PR-FIX-05-dosetwin-dose-comparison.md` — close the report-reopen verification item and record viewport review.

## Components and licenses

No dependency was added. This report view composes existing local shadcn component source in `src/components/ui/card.tsx`, `badge.tsx`, `button.tsx`, and `table.tsx`, styled with Tailwind 4 semantic tokens. Runtime dependencies: React 19.3.0 (MIT) and Base UI React 1.8.0 (MIT). No new third-party component is introduced.

## Verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test` — 42 tests passed across 12 files.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:15176 npm run test:e2e -- --workers=1 tests/e2e/dosetwin-comparison-report.spec.ts` — 1 passed against the running isolated `pt_241` loopback profile. It checks the authentic source artifact hash, saves the real comparison, navigates to Reports, and verifies the reopened source hashes and seven ROI measurements.
- `npm run build` — passed; existing vtk.js large-chunk and React compiler directive warnings remain.
- Manual screenshot/browser review at 1440×900, 768×1024 and 390×844 — each route returned 200, no browser errors, and no document-level horizontal overflow. Screenshots are intentionally ignored local medical-data artifacts at `.local-review/DOSETWIN-COMPARISON-REPORT-REOPEN/reports-{desktop,tablet,phone}.png`.

## Limits

The source prediction is an archived output, not executable inference. OpenKBP-Opt publishes no checkpoint hash or separate clinical-array license. The report preserves source/rights caveats; it does not claim independent verification, redistribution rights, clinical-plan interpretation or patient-space orientation. No prediction for `pt_201` is present.
