# UX-40 — Correct source-readiness accounting for Endoscapes

Updated: 2026-10-10

## Problem and correction

The local `data/endoscapes` directory includes both the curated Endoscapes-BBox201 keyframes and a separate larger 1 fps sampled-frame release. The system readiness report counted every `*/<frame>.jpg` as part of the curated manifest. As a result, the real local inventory (1,933 manifested BBox201 images) appeared to have 132,338 images and was reported `ready: false`.

`scripts/doctor.py` now counts only the safe basenames listed under each split in `medforge-source-manifest.json`. Its output reports both the selected manifest count and how many of those files are present. The three COCO split files remain counted independently. The API still verifies each annotation manifest/hash and each frame's SHA-256 on access.

## Current local source evidence

- `scripts/doctor.py`: Endoscapes-BBox201 manifest has 1,933 images; 1,933 manifested images are present; all 3 split annotation files are present; readiness is `true`.
- The separate sampled-release source manifest reports 60,339 installed files and the runtime lists 201 sampled-video groups. These additional images are not counted as BBox201 keyframes.
- An isolated `TestClient` source audit returned 1,933 SurgiVision records. Authenticated profile behavior was not changed. Three real frame requests passed: `endoscapes:train:100_27200`, `endoscapes:val:125_13175`, `endoscapes:test:162_6575`; each metadata record and image returned HTTP 200 and the matching source SHA-256 ETag.
- Regression test creates manifest-listed frames plus an extra sampled-release JPEG and verifies the readiness count stays scoped to the manifest.

## Files changed

- `scripts/doctor.py`
- `apps/api/tests/test_doctor.py`
- `docs/STATUS.md`
- `docs/ui/PR-UX-40-source-readiness-audit.md`

## Verification

- `apps/api/.venv/bin/python -m pytest -q apps/api/tests/test_doctor.py` — 1 passed.
- `apps/api/.venv/bin/python scripts/doctor.py` — reports the expected 1,933/1,933 manifested BBox201 images and readiness `true`.
- Source-backed FastAPI read audit described above — 3 train/val/test frames returned verified metadata and image bytes.

No source files, DB, package, scientific calculation, permissions or license claims changed. No external dataset files are committed.
