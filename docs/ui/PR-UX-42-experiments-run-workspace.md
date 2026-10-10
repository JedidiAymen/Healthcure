# UX-42 — Experiments configure and run history views

## What changed

Split `/studio/experiments` into two task-focused shadcn Tabs views: **Configure analysis** and **Run history**. The Configure view names the only enabled operation (`openkbp.case_summary`), its deterministic behavior, the source-case input and its research-only limits. Running it sends the existing request to the existing FastAPI operation; a successful or idempotently reused run opens the History view. The History view keeps the real per-ROI measurements, source revision, report save action and selectable saved runs together. A home-page `?runId=` deep link opens the matching saved result directly.

This is a research reference calculation. The operation does not run a prediction model. No inference, clinical interpretation, fake run, dataset or API behavior was added.

## Files changed

- `src/pages/Pages.tsx` — compose the actual analysis and history actions into accessible Configure / History tabs; preserve saved-run selection and report persistence.
- `tests/e2e/workspace-shell.spec.ts` — verify deep-link selection and switching between the two views without losing the selected result.
- `tests/e2e/experiments-source-workspace.spec.ts` — source-backed browser flow with a provisioned local educator, authentic `pt_201`, four viewport captures for each workspace view, run provenance, and evidence-report hash verification.
- `docs/STATUS.md` and `docs/PROGRESS.md` — record this implementation and verified results.

## Components and dependencies

- Existing checked-in shadcn Base Nova `Tabs`, `Card`, `Badge`, `Button`, `Field`, and `Table` compositions; the project uses `@base-ui/react` **1.8.0**, MIT. The Tabs source is in `src/components/ui/tabs.tsx`.
- Official component references: [shadcn Base Tabs](https://ui.shadcn.com/docs/components/base/tabs) and [Base UI Tabs](https://base-ui.com/react/components/tabs).
- No dependency or component source was installed or upgraded. No API, schema, calculation, or dataset changed.

## Verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test` — **67 passed** (20 files).
- `npm run build` — passed. The existing lazy vtk.js chunk-size warning and React compiler module-directive warning remain.
- `npx playwright test tests/e2e/workspace-shell.spec.ts -g "home resumes the latest completed source-backed case summary" --workers=1` — **1 passed**. The route test uses a clearly isolated UI fixture.
- `npx playwright test tests/e2e/experiments-source-workspace.spec.ts --workers=1` with an isolated local API/DB and provisioned educator — **1 passed**. It ran the installed authentic OpenKBP `pt_201` reference summary, verified its completed benchmark result and source-file hashes, switched both views, and saved/reopened the evidence report with matching run ID and file hashes. No patient identifiers or passwords are committed.
- `git diff --check` — passed.
- Actual source-backed configure and history screens were captured at 1440×900, 1280×800, 768×1024 and 390×844. The tab strip and document fit within each viewport; the phone result view explains that the dose-metrics table scrolls horizontally. Captures and the disposable profile remain ignored under `.local-review/UX-42-experiments/` and `.local-review/UX-42-profile/`.

Capture files: `experiments-configure-{desktop,laptop,tablet,phone}.png` and `experiments-history-{desktop,laptop,tablet,phone}.png` under `.local-review/UX-42-experiments/`.

## Limits

Only the source-verified OpenKBP reference summary is runnable here. Model inference remains blocked by its recorded checkpoint/runtime/rights gates. The OpenKBP data remain local and are not published or redistributed by this change.
