# UX-63 — Experiments operation trace

## Change

Experiments displays a React Flow trace connecting the selected installed OpenKBP source case, the existing case-summary request, the API response and any evidence report saved during the current page visit. The trace reflects the selected case and the actual returned run fields (status, available ROI count, grid shape and reference kind). It does not present synthetic model stages or infer historical report state.

The feature does not issue an API request on its own. The existing **Run case summary** action remains the only operation trigger; saving an evidence report remains an explicit action. No backend, calculation, dataset, authorization, or profile behavior changed.

## Component dependency

- `@xyflow/react` **12.12.0**, pinned in `package.json` and `package-lock.json`.
- License: MIT.
- Used for pan/zoom, linked nodes and edges, and a dot-grid canvas. Official attribution remains visible.
- Nodes use existing shadcn `Card` and `Badge`, Lucide icons and Tailwind classes.

## Files

- `src/features/dosetwin/CaseSummaryWorkflow.tsx` — trace component.
- `src/pages/Pages.tsx` — binds selected case/run/report state and run/save errors.
- `package.json`, `package-lock.json` — pinned library.
- `docs/PROGRESS.md` — milestone record.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `git diff --check` — passed.
- Hosted CI on parent commit `b02f809` — passed. New branch commit triggers its own hosted CI run.
- Current app is open at `http://127.0.0.1:5173/studio/dosetwin/cases/openkbp%3Apt_201`, showing the authentic installed OpenKBP source viewer. The Experiments route rendered its operation trace with `pt_201`, but the disposable local demo intermittently returned to its no-case empty state after refresh; no run/report was created to mask that behavior.
- Dedicated desktop/tablet/mobile screenshots for this trace were not captured in this follow-up.

## Limits

The API currently exposes one deterministic case-summary request, not a multi-stage server workflow. The visualization intentionally reports only selected source, request, returned metrics and current-visit report-save state; it does not imply independent stages exist.
