# MEDFORGE

A local research and education application for three independent evidence domains: SurgiVision, DoseTwin and FistulaGuard. The professional, educator and student experiences share a provenance-first product shell. This is not clinical software and it does not diagnose, recommend treatment or claim model/clinical validation.

## Run the app

Use Python 3.13 if available for the reference harness dependencies. On first setup, install the local API and web dependencies:

```sh
cd apps/api
python -m venv .venv
. .venv/bin/activate
pip install -r requirements-test.txt
cd ../..
npm ci
```

Then start both services together from the project root:

```sh
./scripts/start_local.sh
```

The launcher binds both services to `127.0.0.1`, uses the installed OpenKBP, Endoscapes and FiSaV source folders when present, and stores the local database at `data/local.sqlite3`. Browser API requests use the Vite same-origin `/api` proxy; Vite forwards them to the loopback FastAPI service. Stop both with Ctrl+C. To use different local ports, set `MEDFORGE_API_PORT` and `MEDFORGE_WEB_PORT`; both must remain local. To override a source path or database location, set `MEDFORGE_OPENKBP_CASE_DIR`, `MEDFORGE_ENDOSCAPES_ROOT`, `MEDFORGE_FISAV_ROOT` or `MEDFORGE_DB_PATH` before launch.

Open `http://127.0.0.1:5173`. The API docs are at `http://127.0.0.1:8000/docs`. The pinned `pt_201` case files are stored under ignored `data/openkbp/`; their source commit and checksums are recorded in `docs/openkbp-pt201-manifest.json`. The dataset files are not covered by the upstream repository's MIT software license. Keep their use local to research/education and review terms before external display, publication or commercial use. Selected education endpoints support operator-provisioned local educator/student accounts; research endpoints do not have general account authorization, so keep the API on loopback.

## Finding cases

Open the research navigator from the search button in the top bar or press `Ctrl+K` (`⌘K` on macOS). Search a source case ID, dataset, specialty or workspace. Results keep the dataset and source-case identity visible; broad matches open the case registry with the search preserved in the URL. The registry search also filters the local source cases directly.

For profile access and local sign-in setup, follow [`docs/LOCAL_ACCESS_AND_PROFILES.md`](docs/LOCAL_ACCESS_AND_PROFILES.md). For a step-by-step offline demo launch, source acquisition and preflight, follow [`RUN_LOCAL.md`](RUN_LOCAL.md).

The optional CVS-AdaptNet upstream source is pinned as a submodule. Clone with `git clone --recurse-submodules` (or run `git submodule update --init`) before using its worker or running tests that verify the prompt source. The model checkpoint is not included and its use remains gated; see [`docs/BLOCKERS.md`](docs/BLOCKERS.md).

For the current implementation snapshot, verification results, and remaining review gates, see [`docs/SHARE_CHECKPOINT.md`](docs/SHARE_CHECKPOINT.md). Local research datasets, model weights, databases, and generated evidence files are intentionally excluded from Git; read [`docs/BLOCKERS.md`](docs/BLOCKERS.md) before acquiring or displaying data.

Before a demo, inspect the machine and installed source resources with `npm run doctor`. For a read-only check of local readiness, source-backed DoseTwin/SurgiVision/FiSaV API paths, and all application route shells, run `npm run smoke:local` while the launcher is active. The smoke check reports explicitly that it does not replace interactive browser review. Save a machine report with `npm run doctor -- --output docs/evidence/machine-readiness.json`.

SurgiVision displays checksum-verified CVS label coverage across the installed splits. Recreate the source audit with `npm run audit:endoscapes-cvs`; it writes `docs/evidence/endoscapes-cvs-label-coverage.json`.

Run `npm run lint` for ESLint and React Hooks checks, `npm run typecheck` for the TypeScript project, and `npm run build` for the production bundle.

The local sign-in profiles and safe account-provisioning steps are documented in [`docs/LOCAL_ACCESS_AND_PROFILES.md`](docs/LOCAL_ACCESS_AND_PROFILES.md). A fresh checkout has no default student or educator credentials.

To re-acquire that exact case from the pinned public repository tree, run `python scripts/acquire_openkbp_pt201.py`. The script verifies every file against the pinned Git blob SHA before saving a local manifest. To configure a different local OpenKBP case, set `MEDFORGE_OPENKBP_CASE_DIR` in Terminal 1 to its absolute folder path and independently verify its provenance and use terms. MEDFORGE never downloads data from browser input or a third-party URL.

## Implemented research behavior

- Browse local case and model registries.
- Run and replay the reference case-summary operation on a configured OpenKBP case; validate and run source-bound CVS-AdaptNet single-frame inference when its independent checkpoint and use-term gates are cleared.
- Inspect genuine OpenKBP `pt_201` benchmark-space voxel slices with CT, reference-dose and ROI-edge layers; calculate the cumulative voxel DVH and mean dose from the source arrays.
- Compare MEDFORGE mean, D0.1cc and PTV D99/D95/D1 values against the pinned official evaluator with `python scripts/crosscheck_openkbp_pt201.py`.
- Create and save educator lesson drafts to the local API. Drafts are owner-scoped, revisioned, and their rubrics are excluded from student challenge responses.
- Preview and publish immutable student-safe lesson versions after an educator records source review; OpenKBP publication stays blocked pending dataset permission.
- Create educator cohorts and assignments, save student responses, submit idempotently, manually grade, and release debriefs and progress only after review.
- Review truthful availability states and research provenance.

SurgiVision includes all 1,933 annotated Endoscapes-BBox201 keyframes from the official train, validation and test splits (1,212 / 409 / 312) plus the original COCO annotations. The frame and annotation files stay under ignored `data/endoscapes/`; the manifest records per-image and annotation SHA-256 values, split, video/frame identity, archive ETag, annotation and segmentation counts, and research-only terms. Acquire or resume the set with `python scripts/acquire_endoscapes_bbox201.py`; it verifies each ZIP member by CRC and SHA-256 using bounded byte-range reads and does not save the 6.3 GB ZIP. The viewer supports split-qualified frame selection, original-pixel COCO boxes, compressed COCO RLE segmentation overlays, raw image-level label values, and dataset-wide coverage and fractional-mean counts. Official Endoscapes documentation defines each CVS value as the mean of three annotators; fractional values indicate disagreement. Continuous video and model output are not included. Endoscapes is for non-commercial scientific research under CC BY-NC-SA 4.0. Do not redistribute this local sample; verify public-display terms before sharing a demo.

The app itself only serves locally configured source files and never downloads data from browser input. The dataset, inference, production authorization and full parity limitations are detailed in `docs/STATUS.md`, `docs/PARITY.md` and `docs/BLOCKERS.md`.

FistulaGuard includes all 59 checksum-verified FiSaV CSV recordings (`pat001`–`pat059`), 8,144,854,743 uncompressed bytes. The source DOI, CC BY 4.0 license, archive identity, per-file sizes and SHA-256 values are recorded in the ignored local manifest. Re-acquire the complete cohort using `python scripts/acquire_fisav_sample.py --all-recordings`; extraction uses bounded byte ranges and does not save the full 2.27 GB archive or demographics workbook. The viewer lets you choose a record and calculates a bounded time-domain trace, Welch power spectrum and descriptive features from the same measured source window. Researchers can compare and save two equal-length windows from the same recording and channel; saved results retain source hash, parameters and limitations and can be reopened in the viewer. Signed differences do not imply clinical meaning or improvement. A separate, reproducible integrity audit verified all 59 source hashes and finite samples; 49 recordings contain one or more intervals differing from the median-derived 10 kHz interval by over 0.1% (306 intervals across the cohort). This is descriptive context, not a pass/fail grade. Recorded timestamps are preserved. Sensor calibration/physical units are unspecified; no stenosis labels, classifier, pooled cohort analysis or clinical interpretation are included. Attribute the dataset as described by its repository and descriptor before sharing derived material. Recreate the local audit using `python scripts/audit_fisav_window_integrity.py`.

The interface uses generated shadcn/ui Base Nova Sidebar, Card and Badge components, composed with Tailwind 4 utilities. Recharts renders standard dose charts, uPlot renders dense measured signals, and dnd-kit powers keyboard- and pointer-accessible lesson ordering. Motion supplies one reduced-motion-aware Academy entrance effect with its feature code split from the main bundle. WaveSurfer is omitted because the installed FiSaV source consists of measured CSV signals, not playable audio. The Professional Studio uses locally bundled, credited representative clinician photographs above three separate data-backed specialty views; those photos are not MEDFORGE staff, dataset participants, or research evidence. See [`docs/IMAGE_CREDITS.md`](docs/IMAGE_CREDITS.md). Scientific domain viewers and the lesson editor load on demand.

The FastAPI/Pydantic schemas are the API contract source. `npm run contracts:generate` exports OpenAPI from the implemented routes and regenerates `packages/contracts/generated-api.ts`; `npm run contracts:check` verifies the generated TypeScript types are current. Frontend API response types reuse these generated schemas.

## Evidence and release records

- [`docs/DEMO_ASSETS.md`](docs/DEMO_ASSETS.md) — installed dataset inventory, source hashes, attribution and display boundaries.
- [`docs/VALIDATION_REPORT.md`](docs/VALIDATION_REPORT.md) — numerical parity, source-view checks, software verification and remaining evidence gaps.
- [`docs/MVP_SCOPE.md`](docs/MVP_SCOPE.md) — implemented scope, partial learning behavior and capabilities retained for later research workers.
- [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) — verified local-demo gates and open external-display and browser-review actions.
- [`RUN_LOCAL.md`](RUN_LOCAL.md) — reproducible local setup, verified dataset acquisition, offline demo launch and preflight commands.
- [`docs/STATUS.md`](docs/STATUS.md), [`docs/PARITY.md`](docs/PARITY.md) and [`docs/BLOCKERS.md`](docs/BLOCKERS.md) — detailed implementation history, upstream capability status and external blockers.
