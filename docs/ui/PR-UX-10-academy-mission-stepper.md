# UX-10 — Academy mission flow and submission readiness

**Status: Implemented and contract-tested; authenticated visual review remains open.**

## Issue addressed

The learner mission already used the assigned scientific viewer, typed evidence selection, authored question blocks, draft saving, idempotent submission, and a delayed educator debrief. It did not show the handoff's `Brief → Explore Evidence → Observe → Explain → Submit` progression. Its submit control also enabled after any one non-empty answer, while the API rejects a submission unless every published Question block is answered and valid source evidence is selected.

## Changes

- Added an accessible five-stage navigation at the top of the mission. Each step links to the corresponding real lesson section; the mobile layout stacks the same ordered steps. The stepper uses the installed shadcn `Separator`, Tailwind utilities, existing `cn`, and Lucide `Check`; no dependency or custom stylesheet rule was added.
- Step status reflects learner state: evidence selection and question answers are described as such; `Ready to submit` is derived only when evidence is selected and every question has a non-empty answer. `Submitted` and `Reviewed` come from the API attempt state (`review_required`/`submitted` and `graded`/`revealed`).
- The submit button now stays disabled until evidence is selected and all authored questions are answered. This mirrors the server check in `apps/api/app/learning.py` (`student_attempt_submit`) and preserves the server's case/specialty/bounds validation.
- Kept the assigned-only scientific viewer, locked answer editing after submit, hidden reference annotations before review, educator-only Reveal blocks, and existing save/submit APIs unchanged.

## Verification

- `npx eslint src/pages/Pages.tsx src/pages/StudentMissionStepper.tsx src/lib/academy-mission-progress.ts src/lib/academy-mission-progress.test.ts` — passed.
- `npx vitest run src/lib/academy-mission-progress.test.ts` — **4 passed**: no evidence, partial multi-question answers, ready-to-submit state, and submitted/reviewed states.
- `npm run typecheck` — passed.
- `npm run build` — passed. Existing Vite warning remains for the large vtk.js chunk; this change adds no package.

## Open review gate

No new authenticated mission screenshot or keyboard/browser review is claimed for this change. The current local profile database does not seed student credentials or released lessons; an authenticated QA assignment is required to inspect the rendered stepper and guided viewer together at 1440×900, 768×1024, and 390×844. The pure progression and API submission contract are covered by the checks above, but they do not replace that visual/accessibility review.
