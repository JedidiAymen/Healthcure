# UX-12 — Show the submitted evidence beside educator grading

**Status: Implemented in `1b5141f`; timestamp jitter fix in `d1a5417`; focused code checks and production build passed. Authenticated visual recapture is in progress.**

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
- `src/pages/Pages.tsx`, `src/pages/DoseViewer.tsx` — responsive review layout and locked submission state.

No new package was installed. It reuses project viewers and existing source APIs.

## Verification

- Focused frontend test: `npx vitest run src/lib/educator-evidence-preview.test.ts` — 2 passed.
- Authentic FiSaV learning/API regression: `python3 -m pytest -q apps/api/tests/test_contracts.py::test_authentic_fisav_learning_delivery_with_delayed_reference_release` — passed.
- `npm run contracts:check` — passed.
- `npm run lint` and `npm run typecheck` — passed.
- `npm run build` — passed after the viewer implementation.
- Regression for the authentic source's 5.0-second request/4.9969-second response and 50,000 source samples — passed; larger duration/count drift and changed start time are rejected.
- Authenticated visual review at desktop, tablet and phone widths initially confirmed the privacy/layout but exposed the overly strict duration comparison. The check has been fixed; a second isolated real-FiSaV capture is in progress. No regular user DB or credentials are used.

## Limits

This supports educator source review; it does not validate clinical competence or turn research evidence into clinical advice. Data remains local-only, and source licensing/publication gates remain in force.
