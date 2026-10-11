# UX-64 — Experiments scientific operation trace

## What changed

The Experiments view now presents the selected OpenKBP source, the real case-summary API request, returned benchmark metrics, and evidence-report save as connected workflow steps. The existing run and report handlers power the graph controls; source eligibility, pending states, request errors, result metrics and report errors come from the current page/API state. The regular run button uses the same ready-source gate. This trace does not run a prediction model and does not invent metrics.

The graph nodes use responsive vertical spacing so the longer API request node no longer overlaps returned metrics on a phone-sized screen. The Academy offline submission notice retains its established accessible sentence while its title distinguishes a queued submission from a restored draft.

## Component sources

- `@xyflow/react` 12.12.0, MIT, renders and connects the scientific workflow nodes. It is an existing locked dependency.
- Local generated shadcn/Base Nova `Card`, `CardHeader`, `CardContent`, `Badge`, and `Button` components render the nodes and actions. No new UI library or registry component was installed for this change.
- Existing `api.createRun`, `api.createReport`, run-history navigation, and learner offline queue APIs remain the sources of operation state.

## Visual review

Real running-app captures use installed `OpenKBP pt_201` and the disposable local review service. No run/report action was clicked. There were no page errors or horizontal document overflow, and the measured gaps between all adjacent graph nodes remained positive at each viewport:

- 1440×900 desktop
- 768×1024 tablet
- 390×844 phone

Captures and browser measurements are local-only under `.local-review/UX-64-experiments/`; the repository does not publish research-source screenshots.

## Validation and limits

- `npm run build` passed after the graph spacing change. Vite reports the lazily loaded `DoseTwinSurfaceViewer` chunk at 835.93 kB (221.33 kB gzip); this warning is visible for follow-up and was not hidden by changing the warning threshold.
- `npm run typecheck`, `npm run lint`, and `git diff --check` passed on the preceding workflow commit. The latest CI run also passed lint, typecheck, frontend unit tests, browser shell tests, API contract tests and the OpenAPI contract check before the offline Academy browser test found a copy-only expectation mismatch. The displayed sentence has been restored to its established wording; CI will rerun on this checkpoint.
- Result-only graph actions are conditional and were not inspected in a post-result browser session because doing so would create a persisted run/report in the selected profile.

## Files

- `src/features/dosetwin/CaseSummaryWorkflow.tsx`
- `src/pages/Pages.tsx`
- `docs/ui/PR-UX-64-experiments-scientific-trace.md`
