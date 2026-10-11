# Academy mission evidence navigation

## Change

Advancing or revisiting an opened Academy investigation step now brings its section into the visible reading area. The stage scroll respects reduced-motion preferences and keeps the section clear of the app header. This makes the learner's transition from an assigned lesson to its scientific evidence viewer easier to follow on desktop and mobile.

The mission still loads the assigned source through the existing viewer and API. Evidence selection, permission gates, educator-only reference release, submission, and reward opt-in behavior are unchanged. No mock scientific values, XP, achievements, or database records were added.

## Files

- `src/pages/Pages.tsx` — shared mission-step navigation and header-offset scroll targets.
- `tests/e2e/academy-mission-keyboard.spec.ts` — keyboard route check for accessible step navigation, authentic FiSaV source loading and selection, and source evidence carried to educator review.

## UI components and licenses

The change composes existing local shadcn/ui `Button`, `Card`, and `Separator` components plus `StudentMissionStepper`. No package or component source was installed or modified, so there are no new component versions or licenses to report.

## Verification

- `npm run test:e2e -- tests/e2e/academy-mission-keyboard.spec.ts` — passed (1 test). The assignment/auth responses are isolated test fixtures; the FiSaV `pat001` waveform, checksum, and source samples load from the local API/data installation.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- The E2E captures the resulting learner route at desktop (1440×1000), tablet (768×1024), and phone (390×844) with no horizontal overflow. Captures: `.local-review/ACADEMY-MISSION-KEYBOARD-QA-FIXTURE/mission-{desktop,tablet,phone}.png`.
