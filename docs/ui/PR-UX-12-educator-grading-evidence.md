# UX-12 — Show the submitted evidence beside educator grading

**Status: Implemented in `1b5141f`; bounded FiSaV timestamp fix `d1a5417`; embedded-control responsive fix `476a387`. Focused checks, production build, and authenticated source-backed desktop/tablet/phone review passed.**

## Change

The Educator submissions page restores the exact evidence a learner submitted next to the manual rubric. The viewer is read-only, uses the immutable case identity from the published lesson manifest, and derives its source state from the attempt's typed `viewer_evidence`; it does not read saved professional-workspace preferences.

- DoseTwin opens the submitted case, voxel and ROI with case-matched source revision and array checks; slice navigation is locked.
- SurgiVision opens only the submitted Endoscapes frame and verifies the current frame identities/hashes.
- FistulaGuard opens only the assigned FiSaV record/channel/time window after validating the recording hash.
- FiSaV response timestamps describe actual sample endpoints, so a requested 5.0-second window may be returned as 4.9969 seconds. The check now requires the exact case, record, SHA-256, channel, sample rate and start time while bounding both the measured duration and sample-count deviations to source timestamp variation. Larger drift is rejected.
- Missing assignment identity, absent evidence, identity mismatch, or source failure produces an explanatory status without substituting another source.

The server adds only the published manifest's learner-visible `module`, `case_id` and `case_label` to educator attempt-review responses. Secret rubrics remain on the existing educator-only response path; learner privacy, grading and publication rules are unchanged.

## Files

- `apps/api/app/learning.py`, `apps/api/app/schemas.py` — project the assigned source identity for attempt review and grade receipts.
- `apps/api/tests/test_contracts.py` — assert exact assignment identity through review, grade and idempotent replay.
- `contracts/openapi-implemented.json`, `packages/contracts/generated-api.ts`, `src/lib/api.ts` — update the typed contract.
- `src/components/EducatorEvidencePreview.tsx`, `src/lib/educator-evidence-preview.ts` and `.test.ts` — safe dispatch and preview gate.
- `src/pages/Pages.tsx`, `src/pages/DoseViewer.tsx`, `src/pages/FistulaViewer.tsx` — responsive review layout, locked submission state and width-aware signal control layout.
- `tests/e2e/workspace-shell.spec.ts` — regression for source controls wrapping within the desktop review column and phone-width overflow.

No new package was installed. It reuses project viewers and existing source APIs.

## Verification

- Focused frontend test: `npx vitest run src/lib/educator-evidence-preview.test.ts` — 2 passed.
- Authentic FiSaV learning/API regression: `python3 -m pytest -q apps/api/tests/test_contracts.py::test_authentic_fisav_learning_delivery_with_delayed_reference_release` — passed.
- `npm run contracts:check` — passed.
- `npm run lint` and `npm run typecheck` — passed.
- `npm run build` — passed after the viewer implementation.
- Focused Playwright: `embedded FiSaV evidence controls wrap inside the educator review column` — passed. It verifies the desktop evidence/rubric layout, all signal channel controls fit the review column, and the phone page/control strip do not overflow.
- Regression for the authentic source's 5.0-second request/4.9969-second response and 50,000 source samples — passed; larger duration/count drift and changed start time are rejected.
- Authenticated review used an isolated temporary educator database and a real FiSaV `pat001` attempt. At 1440×900, 768×1024 and 390×844 the measured PZT1 waveform for 2.5–7.5 seconds (50,000 source samples), checksum, CC BY 4.0 label and unspecified-unit caveat were visible; there were no page errors, failed requests, horizontal page overflow, or hidden Reveal text. The review caught the timestamp mismatch, which `d1a5417` corrected. The final width-aware controls at `476a387` are additionally covered by the focused Playwright regression. Screenshots: [desktop](../../.local-review/UX12-grading-evidence/grading-desktop.png), [tablet](../../.local-review/UX12-grading-evidence/grading-tablet.png), [phone](../../.local-review/UX12-grading-evidence/grading-phone.png), [measurements](../../.local-review/UX12-grading-evidence/visual-review.json). The disposable database, credentials and capture scripts were removed.

## Limits

This supports educator source review; it does not validate clinical competence or turn research evidence into clinical advice. Data remains local-only, and source licensing/publication gates remain in force.
