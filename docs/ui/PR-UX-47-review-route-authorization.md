# PR-UX-47 — DoseTwin review authorization matrix

## Status

Implemented and pushed before the proposal-aligned role update. Its educator/admin authorization matrix is retained as historical evidence; UX-48 supersedes that policy with a dedicated local Clinical Reviewer role.

## Behavior verified

At the time of this milestone, the DoseTwin research-review routes followed the prior local policy:

- Anonymous requests receive HTTP 401.
- Educator and admin accounts can inspect voxels, create reviews, and read review history/details/exports.
- Student and researcher accounts receive HTTP 403.

The matrix covered voxel inspection, review creation, history, detail, JSON export and FHIR export. It did not imply clinical credentials or authority. The current role policy is documented in [`PR-UX-48`](PR-UX-48-clinical-reviewer-workflow.md).

## Files changed

- `apps/api/tests/test_research_review.py` — add a route-wide role-matrix regression using synthetic test data.
- `docs/PROGRESS.md`, `docs/STATUS.md` — record UX-47.
- `docs/ui/PR-UX-47-review-route-authorization.md` — this implementation and verification note.

## Verification

- `apps/api/.venv/bin/python -m pytest -q apps/api/tests/test_research_review.py` — 8 passed.
- `apps/api/.venv/bin/python -m pytest -q apps/api/tests` — 144 passed, 2 skipped.

No product code, role policy, research data, calculations, or dependencies changed.
