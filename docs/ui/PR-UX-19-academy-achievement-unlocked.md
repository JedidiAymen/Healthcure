# PR-UX-19 — Academy award announcement

**Status:** implemented on `review/cobalt-dosetwin-d2-d3`; presentation verified in the running app at desktop, tablet and phone widths. Award creation and opt-in enforcement remain server-authoritative.

## Change

When the signed-in learner has opted into activity awards and the API returns a newly observed server grant, Academy home, the reviewed mission and Progress show an accessible **Achievement Unlocked** announcement with the existing Trophy badge. It is private and explicitly does not represent clinical skill. Dismissed/seen award keys are scoped to the learner and stored locally; a small in-memory ledger prevents repeats when browser storage is unavailable. Revisiting routes or reloading does not replay the same grant. Opting out hides and clears the announcement.

## Files

- `src/pages/Pages.tsx` — reusable announcement in Academy, mission debrief and Progress.
- `src/lib/academy-achievement-announcement.ts` and `.test.ts` — stable server-award identity and once-only filtering.
- `tests/e2e/academy-achievement-announcement.spec.ts` — UI once-only persistence, dismissal and responsive screenshots. The test stubs progress only to isolate presentation; real grant issuance/opt-in/idempotency remain covered by the API contract suite.
- `docs/STATUS.md`, `docs/RELEASE_CHECKLIST.md` — verification record.

## Components and license

No dependency added. The announcement composes the already vendored Trophy UI `AchievementBadge` (`src/components/ui/achievement-badge.tsx`, source/license recorded in [`PR-UX-06`](PR-UX-06-trophy-achievement-grid.md)) and local shadcn `Button` (`src/components/ui/button.tsx`) with Tailwind 4. Runtime is React 19.3.0 MIT and Base UI React 1.8.0 MIT.

## Verification

- `npm run test` — 44 tests passed across 13 files.
- Focused award-identity tests — 2 passed.
- Focused Playwright `academy-achievement-announcement.spec.ts` — 1 passed. It proves the notice appears for an opted-in API grant, can be dismissed, stays absent across Academy/Progress navigation and full reload, and introduces no document-level horizontal overflow.
- `npm run lint`, `npm run typecheck`, and `npm run build` — passed. Existing large vtk.js chunk and React compiler directive warnings remain.
- Actual route screenshots at 1440×900, 768×1024 and 390×844 are in ignored `.local-review/ACADEMY-AWARD-ANNOUNCEMENT-QA-FIXTURE/`. They use an explicitly mocked award for UI review, not a real learner record. The announcement fits at all widths; the mobile card stacks its Trophy, message and dismiss control for readable text.

## Limits

The announcement reflects the API's award list and the learner's opt-in setting. It does not alter grades/access, create awards, or imply clinical competency. Without browser storage, once-only tracking lasts only for the current app session.
