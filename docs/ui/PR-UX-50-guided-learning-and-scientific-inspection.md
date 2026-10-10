# UX-50: Guided learning and scientific inspection

Updated: 2026-10-10

## Delivered

- **Student Academy:** lessons now move through Brief → Explore evidence → Observe → Explain → Submit. Learners can revisit stages they have reached, but source evidence and answer completion still gate progression. The active stage restores from valid same-device state or saved work. Invalid local stage values are rejected and clamped to the existing evidence/answer gates. Assigned real viewers, answer/evidence persistence, offline submission recovery, learner-safe debrief, educator grading, and opt-in private awards remain in place.
- **FistulaGuard:** the measured waveform remains the primary full-width scientific viewport. The same selected source window's PSD/time-frequency analysis and integrity/provenance now live in a tabbed inspection dock directly below it; the source-window comparison stays beneath the dock. Source sample binding, exact values/units, integrity counts, checksums, and non-diagnostic boundary are preserved.
- **Model Lab:** added operation and license/use-term filters from the actual registered method metadata. Existing text, specialty, and readiness filtering remain; no model readiness or output is inferred.
- An independent review found and corrected two issues before integration: a FistulaGuard layout that contradicted the locked waveform-first handoff and invalid saved Academy stage values that could hide all mission content.

## Files

- `src/pages/Pages.tsx`
- `src/pages/StudentMissionStepper.tsx`
- `src/pages/FistulaViewer.tsx`
- `src/pages/fistulaguard.css`
- `docs/HACKCURE_COMPLIANCE.md` and `docs/L3_DEPLOYMENT_DOSSIER.md` were updated in the adjacent UX-49 documentation commit; they are not modified by UX-50.

## Components and packages

No package was installed. Academy and FistulaGuard use the existing local shadcn Tabs/Select/Button wrappers backed by Base UI React 1.8.0 (MIT) and Tailwind CSS 4.3.3 (MIT). The PSD continues using Recharts 3.10.1 (MIT); the waveform continues using uPlot 1.6.32 (MIT). Model Lab filters use the existing shadcn Select and field components.

## Running review

- Academy sign-in and mission: `http://127.0.0.1:18301/academy`, then open an assignment at `/academy/missions/:assignmentId` with a locally provisioned student account.
- FistulaGuard: `http://127.0.0.1:18301/studio/fistulaguard/cases/current` (reviewed with installed `fisav:pat001`).
- Model Lab: `http://127.0.0.1:18301/studio/models`.

FistulaGuard's actual running-app screenshots are local-only under `.local-review/PR-UX-50-specialist-and-academy/` at desktop and phone sizes. The waveform is first and full width; its inspector and source-recording boundary remain reachable below it. Model Lab was visually reviewed at desktop and its operation/use-term options were visible in the running registry. The Academy route requires a local student account; this pass did not create or expose credentials and did not capture an authenticated mission screenshot.

## Verification

- `npm run typecheck -- --pretty false` passed after all three slices and the reviewed fixes.
- `git diff --check` passed.
- FistulaGuard was manually reviewed with the installed FiSaV source at desktop and phone widths. The Model Lab running registry was inspected; its seven actual records remain gated/unverified according to source metadata.
- No broad test suite was run for this milestone.

## Remaining redesign work

This milestone improves the Academy investigation flow and three research workspaces but does not finish the full Cobalt/Porcelain handoff. Remaining cutline items are tracked in [`05_LOCK_MATRIX_AND_RELEASE_CUTLINE.md`](../design-handoff/MEDFORGE_B_LOCKED_HANDOFF_V3/05_LOCK_MATRIX_AND_RELEASE_CUTLINE.md), including complete specialist-route visual review, authenticated Academy/Educator capture, and the remaining release gates.
