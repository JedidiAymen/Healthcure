# PR-UX-20 — Academy mission keyboard and authentic-source review

**Status: PASS for the keyboard presentation flow and authentic FiSaV source viewer.** This is local UI verification, not a screen-reader voice test and not a new educator-grade record.

## What changed

Added a focused Playwright browser path through the complete learner mission: local student sign-in, all five stepper links, source selection, authored answers, and submission for educator review. Keyboard input activates every stepper link with Enter; ArrowRight moves focus in the shadcn/Base UI signal-channel ToggleGroup, and Space selects PZT2. Submit remains disabled until the viewer has emitted source evidence and each authored question has an answer.

The assignment and session/progress endpoints use explicit in-test UI fixtures. The scientific viewer is not mocked: Vite proxies to the local FastAPI installation, which reads installed FiSaV `pat001`, returns its checksum-verified 2,100,000-sample recording, waveform, features, and PSD. The test asserts the captured evidence still identifies that source record and the selected measured PZT2 channel.

## Files

- `tests/e2e/academy-mission-keyboard.spec.ts` — focused role-based browser flow; desktop, tablet and phone captures; page-error and horizontal-overflow checks.
- `docs/STATUS.md` — current implementation evidence and fixture boundary.
- `docs/RELEASE_CHECKLIST.md` — keyboard investigation acceptance item.

## Components and licenses

No application component or dependency changed. The flow exercises the existing generated shadcn Base Nova `ToggleGroup`, `Card`, form fields, buttons and the existing uPlot signal viewer. Dependencies remain those already pinned in `package.json` and `package-lock.json`.

## Verification

- `MEDFORGE_API_PORT=18082 npm run test:e2e -- tests/e2e/academy-mission-keyboard.spec.ts` — **1 passed** against the active local API profile; no app page errors; exact mission submission/evidence assertions passed.
- The test captured desktop (1440×1000), tablet (768×1024), and phone (390×844), each with no document-level horizontal overflow. Captures are local QA fixtures and are ignored by Git: [desktop](../../.local-review/ACADEMY-MISSION-KEYBOARD-QA-FIXTURE/mission-desktop.png), [tablet](../../.local-review/ACADEMY-MISSION-KEYBOARD-QA-FIXTURE/mission-tablet.png), [phone](../../.local-review/ACADEMY-MISSION-KEYBOARD-QA-FIXTURE/mission-phone.png).
- `git diff --check` — passed before commit.

## Limits

The test verifies browser accessibility roles, labels and keyboard operation. It does not launch a screen reader or claim a narrated voice review. Assignment creation, local authentication and educator grading are fixtures in this focused presentation E2E; real authorization, educator grading, learner-safe release and debrief behavior remain covered by the separate isolated API and signed-in workflow checks in `docs/RELEASE_CHECKLIST.md`.
