# UX-44: Educator-to-student source review loop

## Scope

Add a source-backed browser workflow through the current Educator Studio and Student Academy. The educator authors a FiSaV lesson, reviews the source terms, publishes a version, and assigns it to the local demo cohort. A separate student browser session opens the learner-safe lesson, selects a window in the authentic FiSaV viewer, answers two questions, and submits. The educator reviews the submitted response and source window against the published rubric and releases a manual grade. The student then signs in again and sees feedback, criterion scores, and the educator reference.

The check uses the installed `fisav:pat001` record and verifies its CC BY 4.0 license. It does not generate or assert a diagnosis, establish clinical competence, or publish the assignment outside the local demo cohort. Student XP and achievements remain opt-in; this flow does not turn them on.

## Files changed

- `tests/e2e/educator-student-review-loop.spec.ts` — source-backed full user journey with separate educator and student sessions.
- `docs/STATUS.md` and `docs/PROGRESS.md` — current implementation and test record.
- `docs/ui/PR-UX-44-educator-student-review-loop.md` — this record.

## Captures

Real application screenshots from the isolated local profile are saved under ignored `.local-review/UX-44-learning-loop/`:

- Mission before submission: desktop 1440×900, tablet 768×1024, phone 390×844.
- Educator review: desktop 1440×900, tablet 768×1024, phone 390×844.
- Student debrief after manual review: desktop 1440×900, tablet 768×1024, phone 390×844.

Every captured viewport checks for horizontal document overflow. The test profile and one-time credentials are local-only; use `docs/ui/PR-UX-41-local-demo-profile-guide.md` to create a fresh educator/student profile.

## Components and dependencies

No application components, packages, APIs, source files or license handling changed. The flow uses the existing shadcn Base Nova lesson builder, source viewer, mission, submissions and grading UI. Existing dnd-kit, Base UI, Recharts and uPlot code runs as already installed; their package licenses and source versions are unchanged.

## Verification

Run the test against a seeded disposable local API profile with installed FiSaV data:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:<web-port> \
MEDFORGE_E2E_RESEARCH_USERNAME=<local-educator> \
MEDFORGE_E2E_RESEARCH_PASSWORD=<local-educator-password> \
MEDFORGE_E2E_STUDENT_USERNAME=<local-student> \
MEDFORGE_E2E_STUDENT_PASSWORD=<local-student-password> \
npm run test:e2e -- tests/e2e/educator-student-review-loop.spec.ts
```

Verified on 2026-10-10 against an isolated seeded database and the running local FastAPI/Vite services: 1 source-backed browser test passed. It checked the learner projection excluded the educator Reveal before grading, a real measured PZT2 source window was attached to the student attempt and restored in educator review, score 88/100 was calculated and persisted through manual grading, and the rubric feedback/reference appeared for the student only after grade release. Responsive captures were made for all three roles/states listed above.

The `@source` tag intentionally keeps this browser test out of regular CI unless the runner provisions source manifests and both local roles. Existing API integration coverage remains responsible for privacy, authorization, delayed reference release, grading idempotency, and opt-in progress semantics.
