# UX-62 — Educator cohort learner roster

## Change

Added the Educator Studio **Learners** workspace required by the locked B handoff. Educators can select one of their cohorts, search its enrolled learner names, and move to the existing Assignments or Submissions workflows. The page uses the repository's existing shadcn Base UI components and semantic tokens; no dependency was added.

The API endpoint is scoped to a single cohort owned by the signed-in educator. It returns that cohort's ID/name/count and enrolled learner display names; learner account IDs are not included. It does not return grades, attempt content, contact details, or memberships from another cohort. The route uses the existing educator role gate. A cohort not owned by the caller returns the same not-found response as a missing cohort.

## Files

- `apps/api/app/learning.py`
- `apps/api/app/schemas.py`
- `apps/api/tests/test_contracts.py`
- `src/App.tsx`
- `src/components/Shell.tsx`
- `src/lib/api.ts`
- `src/lib/query-client.ts`
- `src/pages/EducatorLearners.tsx`

## Verification

- `npm run typecheck -- --pretty false` — passed.
- Focused ESLint on the changed frontend modules — passed.
- Python byte-compilation of the changed API/schema/contract-test modules — passed.
- `git diff --check` — passed.
- `apps/api/.venv/bin/python -m pytest -q apps/api/tests/test_contracts.py::test_educator_cohort_roster_is_owner_scoped_and_minimal` — **1 passed**. The system Python lacks `scipy`, so the focused check used the project's API environment. No broad suite was run.
- `npm run build` — passed. Vite reports the existing large DoseTwin viewer chunk warning (835.96 kB; 221.35 kB gzip); the new roster is lazy-loaded.
- Regenerated `contracts/openapi-implemented.json` and `packages/contracts/generated-api.ts` for the new API response; `npm run contracts:check` passes.
- Reviewed the actual running app after signing in to the private local demo profile with its one clearly named demo cohort/member. Captured 1440×900, 768×1024, and 390×844 screenshots under ignored `.local-review/UX-62-educator-learners/`. All three returned HTTP 200, showed the authenticated roster, had no page errors, and had no horizontal overflow. The seeded credentials are stored in ignored mode-0600 `data/jury-demo.credentials.md`; no credentials or screenshots are committed.

## Privacy and compatibility

The existing `/api/v1/educator/students` account-provisioning list remains unchanged and is not used by the roster page. No cohort membership, assignment, grading, or student learning behavior changed.
