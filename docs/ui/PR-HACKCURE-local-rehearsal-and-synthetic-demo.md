# HackCure follow-up — synthetic DoseTwin and local rehearsal path

**Date:** 2026-10-11  
**Branch:** `feat/experiments-run-workspace`  
**Commits:** `bf66ddb` (synthetic viewer), `f207546` (local HackCure/backup path)

## Delivered

- Added a deterministic `128 × 128 × 128` synthetic DoseTwin phantom with water-cylinder relative density, a spherical target, two cylindrical OAR masks, a smooth analytic dose field, slice/DVH/mask API routes, source hashes and an optional existing vtk.js surface view.
- Kept it separate from `/api/v1/cases` and from OpenKBP IDs. The direct route is `/studio/dosetwin/cases/synthetic-dose%3Aphantom-v1`. It is viewer-only: model runs, prediction imports, comparisons, report generation and educator evidence are gated off.
- Added a permanent `SYNTHETIC PHANTOM · NOT ANATOMY · NOT A TREATMENT PLAN` notice. Dose values use an arbitrary illustrative scale; density is not CT HU; spacing and measurements do not describe patient geometry. Existing real-source OpenKBP values keep their physical Gy label.
- Added the local-only Docker HackCure overlay for the same `pt_241` source path and a shared, host-inspectable rehearsal database. Only the existing proxy ports may be published, and the launcher verifies they bind to `127.0.0.1` before startup. The overlay does not seed accounts.
- Added a read-only Docker profile preflight and a local backup/restore-check workflow. Backups are explicitly unencrypted and contain the local database and research arrays; restore-check extracts only into a temporary directory and never overwrites live state.

## Files

Synthetic viewer commit: `apps/api/app/main.py`, `apps/api/app/schemas.py`, `apps/api/app/synthetic_dose.py`, `contracts/openapi-implemented.json`, `packages/contracts/generated-api.ts`, `src/features/dosetwin/DoseTwinSurfaceViewer.tsx`, `src/lib/workspace-preferences.ts`, `src/pages/DoseViewer.tsx`, `src/pages/Pages.tsx`, `docs/DEMO_DATA_POLICY.md`, `docs/SYNTHETIC_DOSETWIN_DEMO.md`.

HackCure local rehearsal commit: `docker-compose.hackcure.yml`, `scripts/start_hackcure_docker.sh`, `scripts/hackcure_docker_preflight.sh`, `scripts/hackcure_backup_restore.py`, `RUN_LOCAL.md`, `docs/DEMO_ASSETS.md`, `docs/L3_DEPLOYMENT_DOSSIER.md`, `docs/HACKCURE_BACKUP_RESTORE.md`.

Follow-up runbook/compatibility corrections: `docs/HACKCURE_COMPLIANCE.md`, `docs/LOCAL_ACCESS_AND_PROFILES.md`, `docs/L3_DEPLOYMENT_DOSSIER.md`, `RUN_LOCAL.md`, `scripts/lib/hackcure-compose-version.sh`, `scripts/start_hackcure_docker.sh`, `scripts/hackcure_docker_preflight.sh`.

Offline image bundle and fresh-profile rehearsal: `scripts/hackcure_bundle_images.sh`, `docs/HACKCURE_BACKUP_RESTORE.md`. The current private local bundle is `hackcure-images-20261011T000615Z.tar.gz`, 160,521,875 bytes, SHA-256 `dcf675ec125b01deb1e4cb7290d528adc51f648f24b445233e7e14eb0423068a`; it contains `medforge-api:local`, `medforge-web:local`, `caddy:2.10.2-alpine` and `eclipse-mosquitto:2.0.20`. The sidecar checksum and gzip integrity checks passed. A fresh Compose project booted all four services using `--no-build --pull never` with the expanded read-only source mounts. Its modules, case registry, surgical clips and CholecT50 registry returned HTTP 200; the `pt_201` viewer manifest returned HTTP 200; both Cholec80 and Appendix300 video byte-range requests returned HTTP 206. The first profile pass exposed a 500 in the DoseTwin scientific viewer manifest (`VoxelVolumeArtifact` was shadowed by a function-local import); removing that redundant import fixed it, and the manifest returned HTTP 200 with one radiotherapy-volume artifact. This was a same-host no-pull rehearsal, not a second-machine or network-isolated rehearsal.

HackCure source-availability follow-up: `docker-compose.hackcure.yml`, `docker/api.Dockerfile`, `scripts/start_hackcure_docker.sh`, `scripts/hackcure_docker_preflight.sh`, `scripts/lib/hackcure-dataset-roots.sh`, `RUN_LOCAL.md`, `docs/DEMO_ASSETS.md`, `docs/HACKCURE_COMPLIANCE.md`. The Docker review stack previously could not follow host-absolute data symlinks and exposed only `pt_241`. The launcher now resolves source roots on the host and mounts them read-only under `/medforge-datasets`, separate from the existing read-only `/datasets` mount. The profile adds `pt_201` as viewer-only while leaving `pt_241` as the only comparison-enabled case; OpenKBP cases remain separate. Verified in the actual Docker app: both DoseTwin cases returned valid viewer manifests; all three modules reported ready; registry included 1,933 Endoscapes records and 59 FiSaV recordings; CholecT50 exposed five validation sequences. Cholec80 full-rate video served HTTP 206 byte ranges with the matching 25 fps publisher phase overlay; the Appendix300 excerpt served HTTP 206 with its timestamped source event. The 26,947,136-byte Appendix300 excerpt was reacquired from its official ETag-pinned archive using the supplied range-extraction script; source hash is `af050e90b66076f7dd83e8278be3cc4bd50ea490a375165e9747946b0e94c2bc`. Only that small clip was downloaded, not the full 80.77 GB archive.

## Installed component sources

No packages were installed for this milestone. The UI reuses the project's generated shadcn/Base UI components and Tailwind utilities; DoseTwin uses the existing Recharts, Lucide and vtk.js integrations.

| Existing dependency | Version | License | Use |
|---|---:|---|---|
| shadcn/Base Nova UI source (`src/components/ui/*`) | Generated source in this repository; no runtime package version | MIT-licensed shadcn/ui source | Cards, alerts, controls and layout primitives |
| `@base-ui/react` | 1.8.0 | MIT | Interaction primitives used by the generated components |
| `tailwindcss` | 4.3.3 | MIT | Existing utility styling and semantic theme tokens |
| `recharts` | 3.10.1 | MIT | Existing DoseTwin DVH chart components |
| `@kitware/vtk.js` | 37.4.1 | BSD-3-Clause | Existing optional 3D mask surface viewer |
| `lucide-react` | 1.53.0 | ISC | Existing interface icons |

## Verification recorded

- `npm run typecheck -- --pretty false` — passed.
- `npm run contracts:check` — passed; generated OpenAPI/TypeScript contracts match.
- `npm run build` — passed; Vite reports the existing optional vtk.js surface chunk above 500 kB and a React compiler directive warning.
- `python3 -m py_compile apps/api/app/main.py apps/api/app/schemas.py apps/api/app/synthetic_dose.py` — passed.
- `git diff --check` — passed.
- Live API check returned synthetic-only case status, manifest unit `synthetic-illustrative-scale`, dose-slice unit/provenance, and DVH `dose_scale_kind=synthetic-illustrative-scale`, `metrics_kind=synthetic-descriptive`.
- Manual running-app review at desktop (1440×900), tablet (768×1024) and phone (390×844) produced no browser page errors and no horizontal overflow. Local-only captures: `.local-review/HACKCURE-synthetic-dose/synthetic-dose-desktop.png`, `synthetic-dose-tablet.png`, and `synthetic-dose-mobile.png`.
- Latest authentic SurgiVision capture from the running local app: `.local-review/hackcure-source-mount/surgivision-desktop.png`, `surgivision-tablet.png`, `surgivision-mobile.png`, with `report.json`. All 3 returned HTTP 200, decoded the 28:53 Cholec80 clip (`readyState=4`), showed the phase label on the video and had no browser page errors or horizontal overflow. The on-frame and evidence-inspector label is publisher reference data, not a MEDFORGE temporal model result; no temporal model stream is installed. Raw screenshots/media are local-only and remain ignored by Git.
- The synthetic UI/API agent additionally checked the direct route and report/import gate. The optional 3D surface route was not verified.
- The backup/restore agent exercised archive creation, restore-check, tampered-hash rejection, path-traversal rejection, unchanged live-state hashes and temporary-directory cleanup with tiny temporary fixtures. A real local backup was then created and restore-checked: 15 members verified, SQLite `quick_check=ok`, and live database/source files remained unchanged. This is not a second-machine/offline boot test.
- Caddy/Mosquitto images were pulled and the API/web images built locally. The Docker HackCure stack started; `/healthz` returned 200; the actual `pt_241` viewer returned HTTP 200 and rendered the source dose, DVH and benchmark metrics. A separate fresh Compose project also booted from the locally saved images with `--no-build --pull never`; its health route, actual `pt_241` route, case API and viewer manifest returned HTTP 200. That pass exposed and verified the fix for the viewer-manifest import-shadowing error in `apps/api/app/main.py`. Caddy TLS 1.3 passed with its exported local root CA; TLS 1.2 was refused. A browser without the local CA still reports `ERR_CERT_AUTHORITY_INVALID`, so the root must be trusted on the presentation machine. Local Docker screenshots cover desktop/tablet/phone under `.local-review/HACKCURE-docker-pt241/`; all three had HTTP 200, zero page errors and no horizontal overflow.
- Exact Docker preflight: `pt_241` source/archive and Compose loopback checks pass; imported matching prediction, saved comparison report and reviewer account fail; optional published/assigned Academy check fails. Both shell scripts pass `bash -n`.
- Fresh development-database preflight passes the source, imported matching prediction, saved comparison report and loopback checks; reviewer account and optional Academy lesson remain missing. The Docker-specific profile has the source and loopback passes only; it remains a separate empty rehearsal database. Its startup/preflight now check the Compose minimum required for `!reset` (2.24.4); this host runs Compose 5.1.0. `RUN_LOCAL.md` and the L3 dossier now state the unencrypted overlay boundary and separate educator/reviewer responsibilities.
- Hosted CI for `1978f36` initially failed because Vite was running without the API, causing `ECONNREFUSED` on API-backed routes. `playwright.config.ts` now starts the standard loopback API + Vite launcher together. On `5d43f6a`, browser tests reported 12 passed and 8 failed. The UI corrections then passed seven focused browser checks, and hosted run [38096476664](https://github.com/JedidiAymen/Healthcure/actions/runs/38096476664) on `a2817f0` passed install, lint, typecheck and frontend unit tests. Its browser suite reported 19 passed and one failure: the CVS self-check test expects its commit button immediately after sign-in, before the lesson's required source inspection and observation steps. I left the staged learner progression intact; the brief now warns the learner to commit before submission, and the test should advance through the flow before asserting commit behavior. API contracts, OpenAPI, production build and offline Academy checks were skipped after this browser failure.
- No full suite was run.

## HackCure readiness still open

This is **not an L2-ready or organizer-approved release**. The existing development DB passes source/archive, matching imported prediction, saved report and loopback checks, but it lacks a credentialed reviewer and the optional published/assigned Academy lesson. The Docker DB and stack now exist locally, but its preflight has no imported artifact/report or reviewer account. No reviewer/student account, password or assignment was created. The archive-check passed locally; a separate project also booted on this host from saved images without building or pulling. There was no second-machine restore, network-isolated boot, or proof of offline transfer to another machine. The local Caddy root CA still needs trust installation in the review browser.

There is still no hosted URL, passing hosted CI result for this correction, independent clean-clone result, release tag, organizer acceptance, resolved external-use basis for OpenKBP-Opt, or clinical/legal approval. See [`HACKCURE_COMPLIANCE.md`](../HACKCURE_COMPLIANCE.md), [`SYNTHETIC_DOSETWIN_DEMO.md`](../SYNTHETIC_DOSETWIN_DEMO.md), and [`HACKCURE_BACKUP_RESTORE.md`](../HACKCURE_BACKUP_RESTORE.md).
