# PR-UX-16 — CholecT50 authentic source annotation review

## What changed

SurgiVision now offers a frame-by-frame review of the official CholecT50 Challenge Validation subset. The viewer loads source PNGs from the local API and overlays only the published tool-tip boxes for that exact image. It presents the original instrument/action/target triplets, phase labels, source frame identity, source citation and CC BY-NC-SA 4.0 terms. Previous/next and source-video selection controls move between available samples without inventing missing frames, timestamps or continuity. The screen states that these are dataset reference labels, not MEDFORGE predictions.

The unrelated Appendix300 video remains a continuous playback example and is explicitly labeled as having no aligned annotations or model results. CholecT50 reference labels are not painted over it. Endoscapes stays a separate sampled-still source.

## Source and storage

- Official source: [CAMMA CholecT50 repository](https://github.com/CAMMA-public/cholect50), [download instructions](https://github.com/CAMMA-public/cholect50/blob/master/docs/README-Downloads.md), [data format](https://github.com/CAMMA-public/cholect50/blob/master/docs/README-Format.md).
- Installed package: five validation videos (VID68, VID70, VID73, VID74, VID75), 1,318 sample images and 1,128 labeled frames. Samples are sparse and preserve their official source frame IDs.
- License stated by the source: CC BY-NC-SA 4.0. The subset remains local/ignored by Git. Do not redistribute the raw files or use commercially.
- Acquisition and integrity check: `apps/api/.venv/bin/python scripts/acquire_cholect50_challenge_validation.py`. The script pins archive size and ETag, validates safe archive paths and CRC, and records archive/file SHA-256 hashes.
- Local data root: `data/cholect50/challenge-validation/`. Set `MEDFORGE_CHOLECT50_VALIDATION_ROOT` only when launching against a different installed copy.

## Files changed

- `scripts/acquire_cholect50_challenge_validation.py` — official archive acquisition and verification.
- `scripts/doctor.py`, `scripts/start_local.sh`, `scripts/smoke_local.py` — readiness, local asset discovery and smoke coverage.
- `apps/api/app/cholect50_validation.py`, `apps/api/app/main.py`, `apps/api/app/schemas.py` — manifest validation and local source/frame/image API.
- `apps/api/tests/test_cholect50_validation.py` — manifest, integrity and source-label checks.
- `src/components/surgivision/CholecT50Review.tsx`, `src/pages/SurgiViewer.tsx`, `src/lib/api.ts` — source review UI, clear source separation and typed client.
- `packages/contracts/generated-api.ts`, `contracts/openapi-implemented.json` — generated API contracts.
- `RUN_LOCAL.md`, `docs/LOCAL_ACCESS_AND_PROFILES.md`, `docs/PARITY.md`, `docs/BLOCKERS.md`, `docs/STATUS.md` — local use, provenance and current product boundary.
- Also in this working tree: `src/pages/StudentProgressChart.tsx`, `src/styles.css`, `tests/e2e/student-progress-history.spec.ts` — preserve separate fix for distinct chart reviews recorded at the same second.

## UI components and sources

The viewer composes the repository's installed shadcn/ui Base Nova components: Card, Badge, Button, Checkbox, Select, Slider and Alert, styled with the existing Tailwind setup. Components are checked into the repository and remain the source of truth; no additional package was installed for this change. shadcn/ui is MIT-licensed; component implementation/source versions are those already pinned in this checkout. The source PNGs and annotations retain their separate dataset terms above.

## Verification

- CholecT50 API tests: 3 passed.
- Full API suite: 42 passed.
- Frontend unit suite: 42 passed across 12 files.
- `npm run contracts:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- Browser review against the running local app: desktop 1440×900, laptop 1280×800, tablet 768×1024 and phone 390×844; no horizontal overflow or page errors. Verified image dimensions, exact source overlay, next sample and switching VID68→VID70.
- Screenshots (private, ignored): `.local-review/CHOLECT50-REAL-ANNOTATIONS/desktop-1440.png`, `laptop-1280.png`, `tablet-768.png`, `phone-390.png`, and `desktop-switch-video.png`.
- Production build: passed (Vite emitted existing large-chunk and module-directive warnings).
- Student Academy same-second history regression: 1 passed.
- Live local smoke: passed; confirmed two DoseTwin cases, 59 FiSaV recordings, all 1,933 Endoscapes annotation records, source-backed CholecT50 image/box/triplet/provenance and all 19 app routes.
- The running review instance for this checkout is <http://127.0.0.1:15194/studio/surgivision/cases/current> (API on loopback port 18098, isolated temporary database). Start the standard local services using [`RUN_LOCAL.md`](../../RUN_LOCAL.md).

## Not provided by this dataset

The Challenge Validation subset is sparse still-frame annotation data; it does not contain the full continuous source movies. No action recognition model inference or prediction results were added. The Appendix300 video is a different source/procedure and has no matching labels. Thus a truthful annotation-on-video overlay remains unavailable until the same source video and timestamp-aligned annotations or verified model outputs are obtained.
