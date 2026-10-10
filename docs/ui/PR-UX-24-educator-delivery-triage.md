# PR-UX-24 — Educator delivery and submission triage

**Status: PASS for this UI slice; overall MEDFORGE release remains in progress.**

Educators can now search delivered lessons, filter assignments by cohort and due-date state, and open the matching review queue from each row. The submission screen has a learner-attempt table with search and status filters above the existing source-evidence and manual rubric review flow. The existing grading behavior, private rubric data, and student reveal boundary are unchanged.

## Review evidence

- Focused browser check passed using clearly scoped educator presentation fixtures. The test verifies assignment search and due-date filtering, learner search and review-state filtering, and preserves the existing grading screen.
- Desktop, laptop, tablet and phone captures were produced for both routes. They use fixture classroom names and dates, not medical results:
  - `.local-review/UX-24-educator-triage/assignments-{desktop,laptop,tablet,phone}.png`
  - `.local-review/UX-24-educator-triage/submissions-{desktop,laptop,tablet,phone}.png`
- At each size the browser check confirms the document does not overflow horizontally.

## Files changed

- `src/pages/Pages.tsx` — assignment filters/table and learner attempt search/status table.
- `tests/e2e/workspace-shell.spec.ts` — focused filtering and responsive checks.
- `docs/STATUS.md`, `docs/RELEASE_CHECKLIST.md`, this milestone record.

## Components and checks

- No new package or vendor component. Uses installed shadcn/Base Nova `InputGroup`, `Select`, `Table`, `Empty`, `Field` and `Card` compositions.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test -- --run` — 44 tests across 13 files passed.
- `npm run build` — passed. Existing warnings remain for the 835 kB DoseTwin viewer chunk and React Compiler's `"use no memo"` directive.
- `MEDFORGE_API_PORT=18098 PLAYWRIGHT_BASE_URL=http://127.0.0.1:4174 npx playwright test tests/e2e/workspace-shell.spec.ts --grep 'educator teaching desk shows real work'` — 1 test passed.
- The API suite was not rerun; no API code changed.
