# UX-48 — DoseTwin clinical reviewer workflow

## Scope

Implemented the newer platform enhancement proposal's separate local DoseTwin research-review workflow. A workspace operator may provision the `clinical_reviewer` role. This is a local account designation only: the app does not verify a medical license, clinical qualifications, or authority to treat patients.

The reviewer can inspect a same-case archived prediction against its source reference, inspect a voxel delta, create immutable source-backed research-review records, inspect their history, and export review evidence. Admin remains an override. Educator/admin retain general research preparation and writes (including prediction imports and comparison reports), while educator, student, researcher, and anonymous accounts cannot create or inspect DoseTwin review records. Students cannot use general research-write routes. Review decisions are explicitly for further expert assessment, never patient treatment.

The migration is forward-only and idempotent; it preserves existing role grants and rejects unknown roles. Accounts with multiple grants resolve deterministically, with admin precedence. Provision separate accounts for student, educator, and reviewer work.

## User-visible sign-in and local setup

The DoseTwin review panel offers a reviewer-specific sign-in prompt and states that the role does not verify credentials. General research writes continue to prompt for an educator/admin account. Setup instructions and profile boundaries are in [`LOCAL_ACCESS_AND_PROFILES.md`](../LOCAL_ACCESS_AND_PROFILES.md); no credentials, tokens, or temporary QA passwords are committed.

## Components and dependencies

No dependencies or vendor components were added for this authorization milestone. It reuses the existing project-local shadcn-style components (Dialog, Card, Button, Alert, Field and Input), backed by the already pinned `@base-ui/react` 1.8.0 package (MIT). The design system source is in `src/components/ui/`.

## Running-application screenshots

Captured from the isolated local app using the authentic OpenKBP pt_241 source prediction and the review UI:

- Desktop, 1440×900: [dosetwin-review-desktop.png](../../.local-review/DOSETWIN-RESEARCH-REVIEW/dosetwin-review-desktop.png)
- Laptop, 1280×800: [dosetwin-review-laptop.png](../../.local-review/DOSETWIN-RESEARCH-REVIEW/dosetwin-review-laptop.png)
- Tablet, 768×1024: [dosetwin-review-tablet.png](../../.local-review/DOSETWIN-RESEARCH-REVIEW/dosetwin-review-tablet.png)
- Phone, 390×844: [dosetwin-review-phone.png](../../.local-review/DOSETWIN-RESEARCH-REVIEW/dosetwin-review-phone.png)

These captures are local review artifacts under an ignored QA folder and are not added to the repository.

## Files changed

- `README.md`
- `RUN_LOCAL.md`
- `apps/api/app/audit.py`
- `apps/api/app/auth.py`
- `apps/api/app/main.py`
- `apps/api/app/research_review.py`
- `apps/api/app/schemas.py`
- `apps/api/tests/test_research_review.py`
- `apps/api/tests/test_role_grants_migration.py`
- `apps/api/tests/test_write_auth.py`
- `contracts/openapi-implemented.json`
- `db/migrations/0104_clinical_reviewer_role.sql`
- `docs/DECISIONS.md`
- `docs/HACKCURE_COMPLIANCE.md`
- `docs/LOCAL_ACCESS_AND_PROFILES.md`
- `docs/MVP_SCOPE.md`
- `docs/PROGRESS.md`
- `docs/SHARE_CHECKPOINT.md`
- `docs/STATUS.md`
- `docs/ui/PR-UX-47-review-route-authorization.md` (marked superseded)
- `docs/ui/PR-UX-48-clinical-reviewer-workflow.md`
- `packages/contracts/generated-api.ts`
- `scripts/create_local_learning_user.py`
- `src/features/dosetwin/DoseTwinComparisonPanel.tsx`
- `src/features/dosetwin/ResearchReviewPanel.tsx`
- `src/lib/research-write-auth.test.ts`
- `src/lib/research-write-auth.ts`
- `src/lib/session.tsx`
- `tests/e2e/dosetwin-comparison-report.spec.ts`
- `tests/e2e/research-sign-in.ts`
- `tests/e2e/workspace-shell.spec.ts`

## Verification

- API: `/tmp/medforge-validation-venv/bin/python -m pytest apps/api/tests -q` — **154 passed, 2 skipped**. The only warning is the existing Starlette TestClient/AnyIO deprecation.
- Frontend: `npm run lint`, `npm run typecheck`, and `npm run test` — passed; **69 tests across 20 files**.
- Contracts: `MEDFORGE_PYTHON=/tmp/medforge-validation-venv/bin/python npm run contracts:check` — passed.
- Production build: `npm run build` — passed. Existing warnings remain for the 835 KB `DoseTwinSurfaceViewer` chunk and the bundled React compiler directive.
- Browser suite: `MEDFORGE_API_PORT=18300 PLAYWRIGHT_BASE_URL=http://127.0.0.1:18301 npm run test:e2e:ci -- --workers=1` — **20 passed**. This confirmed the anonymous educator-only preparation gate and the constrained editor popup check.
- Authentic source workflow: `npm run test:e2e -- tests/e2e/dosetwin-comparison-report.spec.ts --workers=1` — **1 passed** using authentic OpenKBP pt_241 arrays, source hashes, saved comparison report, reviewer sign-in and immutable review on a clean isolated local database.
- `git diff --check` — passed.
