# UX-38 — Model Lab source-aware registry

## Result

Model Lab now presents the seven registered methods in a compact, searchable shadcn table. Each row keeps the real source, specialty, operation, readiness state, and license visible. Selecting a method opens its source-specific detail panel with revision, use terms, registered operations, API validation gates, and case selection. Existing API-provided readiness and execution blockers remain authoritative; this work does not claim a blocked method can run.

The shared shadcn combobox popover now sizes to the visible viewport as well as the component's available height. This fixes the Educator source picker at 200% zoom on short screens.

## Files changed

- `src/pages/Pages.tsx` — method table, source-aware detail panel, factual registry summary.
- `src/components/ui/combobox.tsx` — viewport-constrained popover sizing using the existing Base UI component.
- `tests/e2e/workspace-shell.spec.ts` — current SurgiVision and DoseTwin behavior assertions, Model Lab responsive checks, and educator high-zoom coverage.

No dependency, API, dataset, scientific calculation, or license record changed. The table uses the installed shadcn Base Nova components already in this project; no new component source or vendor was introduced.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test -- --run` — 44 passed.
- `npm run test:e2e:ci -- --workers=1 tests/e2e/workspace-shell.spec.ts` — 15 passed, including all tested workspaces and educator source-picker behavior at 200% zoom.
- `git diff --check` — passed.
- Local UI captures: `.local-review/UX-38/` at desktop, tablet, and phone sizes; ignored by Git.

The Model Lab continues to show real source and execution gates. For example, CVS-AdaptNet remains blocked by the actual worker/checkpoint/text-backbone and terms gates returned by the local service.
