# PR-UX-47 — DoseTwin review authorization matrix

## Status

Implemented on `feat/experiments-run-workspace`. This is a test and handoff update; it does not change runtime authorization behavior.

## Behavior verified

The DoseTwin research-review routes follow the existing local policy:

- Anonymous requests receive HTTP 401.
- Educator and admin accounts can inspect voxels, create reviews, and read review history/details/exports.
- Student and researcher accounts receive HTTP 403.

The matrix covers voxel inspection, review creation, history, detail, JSON export and FHIR export. It preserves the existing decision that review access uses educator/admin accounts and does not imply clinical credentials or authority.

## Files changed

- `apps/api/tests/test_research_review.py` — add a route-wide role-matrix regression using synthetic test data.
- `docs/PROGRESS.md`, `docs/STATUS.md` — record UX-47.
- `docs/ui/PR-UX-47-review-route-authorization.md` — this implementation and verification note.

## Verification

- `apps/api/.venv/bin/python -m pytest -q apps/api/tests/test_research_review.py` — 8 passed.
- `apps/api/.venv/bin/python -m pytest -q apps/api/tests` — 144 passed, 2 skipped.

No product code, role policy, research data, calculations, or dependencies changed.
