# UX-39 — Cholec80 source video with frame-matched results

Updated: 2026-10-10

## What is available

SurgiVision now offers an authentic full-rate Cholec80 cholecystectomy recording alongside the separate Appendix300 appendectomy excerpt. The Cholec80 video is 25 fps and 28:53 long. The publisher phase annotation is verified against every frame, compressed into seven source intervals, and overlaid for the frame currently shown by the video player. The UI identifies these as publisher ground-truth labels, not model output or surgical guidance.

The CholecT50 instrument/action annotations remain on their source-matched 1 fps stills. They are not interpolated across the Cholec80 video. Appendix300 continues to show its own publisher-timed event and reported grade.

## Source, use terms, and acquisition

- Dataset: [CAMMA Cholec80](https://camma.unistra.fr/datasets/), the official source and citation page.
- Video archive: `https://s3.unistra.fr/camma_public/datasets/cholec80/cholec80.zip` (about 75 GB); only `videos/video01.mp4` and `phase_annotations/video01-phase.txt` are retrieved.
- License: CC BY-NC-SA 4.0. Keep the source attribution and share-alike terms with any allowed redistribution. The existing release checklist still requires rights review before external presentation/publication.
- Local acquisition: `python3 scripts/acquire_cholec80_sample.py`. The script requests exact HTTP byte ranges from the official archive, pins the archive ETag, validates ZIP64 boundaries and CRCs, and checks frame rate, resolution, duration and SHA-256 values. The downloaded files and manifest live under ignored `data/cholec80/`; they are not in Git.
- Verified asset: 854×480, 25 fps, 43,326 frames, 1,733.04 seconds; video SHA-256 `ef1ff0428b34e7a98dfe83d5f1cbc66d5461b9376203d841d38ad28325c05094`; phase track SHA-256 `60a1e0f4e71de924205b74911b2f53766601cccef88512063b681a3233ba2433`.

## Implementation

- API verifies the local manifest, video and phase-track hashes, contiguous frame coverage and source metadata; serves the video through the existing byte-range route.
- Generated OpenAPI and frontend contracts describe the two dataset IDs, fps and frame-indexed phase intervals.
- SurgiVision provides a source picker with readable dataset labels, frame-accurate phase display and a link to source/license information.
- Specialty capability rows distinguish the installed Cholec80 and Appendix300 sources and state that neither is linked to Endoscapes stills.
- No medical dataset files or new npm dependencies are committed. The existing React integration package `@videojs/react` 10.0.1 (Apache-2.0) provides the player.

## Files changed

- `scripts/acquire_cholec80_sample.py`
- `apps/api/app/cholect80_video.py`
- `apps/api/app/main.py`, `apps/api/app/schemas.py`
- `apps/api/tests/test_cholect80_video.py`, `apps/api/tests/test_appendix300.py`
- `src/pages/SurgiViewer.tsx`, `src/pages/Pages.tsx`
- `tests/e2e/surgivision-cholect80-video.spec.ts`
- `tests/e2e/cholect50-sampled-review.spec.ts`
- `tests/e2e/surgivision-appendix300-source-annotation.spec.ts`
- `tests/e2e/workspace-shell.spec.ts`
- `contracts/openapi-implemented.json`, `packages/contracts/generated-api.ts`
- `docs/LOCAL_ACCESS_AND_PROFILES.md`, `docs/RELEASE_CHECKLIST.md`, `docs/STATUS.md`, `docs/ui/library-spikes.md`

## Verification performed

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test -- --run` — 44 passed.
- `npm run build` — passed. Vite reports the existing large DoseTwin viewer chunk and a React Compiler directive warning.
- `python3 -m pytest -q apps/api/tests` — 45 passed.
- `npm run contracts:check` — passed.
- Focused live-source/browser review across Cholec80, Appendix300, CholecT50 and workspace routes — 18 passed using installed sources. The CholecT50 sampled-review flow also passed separately in fixture mode.
- Captures from the running local application: `.local-review/CHOLECT80-VIDEO/cholec80-1440x900.png`, `cholec80-768x1024.png`, and `cholec80-390x844.png`. Captures are local-only because they visibly contain licensed surgical footage.

## Local review

Run `./scripts/start_local.sh`, then open `http://127.0.0.1:5173/studio/surgivision/cases/current`. Select **Continuous video · source labels**. With `data/cholec80/` installed, Cholec80 is the default clip and Appendix300 is available from the source picker. Open the **Sampled replay · source labels** tab to inspect the separate CholecT50 labeled stills.

The Cholec80 source video is locally installed on the developer machine and is not included in a fresh clone. Reacquire it with the script above. Provisioned profile credentials and first-run setup remain documented in [`LOCAL_ACCESS_AND_PROFILES.md`](../LOCAL_ACCESS_AND_PROFILES.md).
