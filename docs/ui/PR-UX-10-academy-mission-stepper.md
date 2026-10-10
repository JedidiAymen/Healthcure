# UX-10 — Academy mission flow and submission readiness

**Status: Implemented, authenticated against real local FiSaV, and visually reviewed at desktop/tablet/phone sizes.**

## Issue addressed

The learner mission already used the assigned scientific viewer, typed evidence selection, authored question blocks, draft saving, idempotent submission, and a delayed educator debrief. It did not show the handoff's `Brief → Explore Evidence → Observe → Explain → Submit` progression. Its submit control also enabled after any one non-empty answer, while the API rejects a submission unless every published Question block is answered and valid source evidence is selected.

## Changes

- Added an accessible five-stage navigation at the top of the mission. Each step links to the corresponding real lesson section; the mobile layout stacks the same ordered steps. The stepper uses the installed shadcn `Separator`, Tailwind utilities, existing `cn`, and Lucide `Check`; no dependency or custom stylesheet rule was added.
- Step status reflects learner state: evidence selection and question answers are described as such; `Ready to submit` is derived only when evidence is selected and every question has a non-empty answer. `Submitted` and `Reviewed` come from the API attempt state (`review_required`/`submitted` and `graded`/`revealed`).
- The submit button now stays disabled until evidence is selected and all authored questions are answered. This mirrors the server check in `apps/api/app/learning.py` (`student_attempt_submit`) and preserves the server's case/specialty/bounds validation.
- Kept the assigned-only scientific viewer, locked answer editing after submit, hidden reference annotations before review, educator-only Reveal blocks, and existing save/submit APIs unchanged.
- The authenticated mobile review exposed a stretched vertical `Separator` rendering as full-width horizontal bars between mission steps. Removed those redundant mobile separators; the ordered numbered step controls remain keyboard-operable and visually clear.

## Verification

- `npx eslint src/pages/Pages.tsx src/pages/StudentMissionStepper.tsx src/lib/academy-mission-progress.ts src/lib/academy-mission-progress.test.ts` — passed.
- `npx vitest run src/lib/academy-mission-progress.test.ts` — **4 passed**: no evidence, partial multi-question answers, ready-to-submit state, and submitted/reviewed states.
- `npm run typecheck` — passed.
- `npm run build` — passed. Existing Vite warning remains for the large vtk.js chunk; this change adds no package.
- An isolated temporary database was provisioned with separate educator/student accounts, a local CC BY 4.0 FiSaV `pat001` lesson and assignment. The learner preview was checked to omit the educator Reveal block. No regular database or credentials were used.
- Running application screenshots: [desktop, 1440×900](../../.local-review/UX10-authenticated/mission-1440x900.png), [tablet, 768×1024](../../.local-review/UX10-authenticated/mission-768x1024.png), and [phone, 390×844](../../.local-review/UX10-authenticated/mission-390x844.png). The real FiSaV waveform loaded at all sizes, document width matched viewport width, and the Brief step activated with Enter. Browser page errors: none. See `../../.local-review/UX10-authenticated/visual-review.json` for measurements.

## Remaining review

The local authenticated visual/keyboard review is complete for the selected-FiSaV assignment state. This does not imply production identity, a standing demo password, clinical competency, instructor approval, or permission for public hosting. The QA database and account secret were temporary; raw source datasets and capture PNGs remain ignored local review artifacts.
