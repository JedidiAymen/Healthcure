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
- `python3 -m py_compile apps/api/app/main.py apps/api/app/schemas.py apps/api/app/synthetic_dose.py` — passed.
- `git diff --check` — passed.
- Live API check returned synthetic-only case status, manifest unit `synthetic-illustrative-scale`, dose-slice unit/provenance, and DVH `dose_scale_kind=synthetic-illustrative-scale`, `metrics_kind=synthetic-descriptive`.
- Manual running-app review at desktop (1440×900), tablet (768×1024) and phone (390×844) produced no browser page errors and no horizontal overflow. Local-only captures: `.local-review/HACKCURE-synthetic-dose/synthetic-dose-desktop.png`, `synthetic-dose-tablet.png`, and `synthetic-dose-mobile.png`.
- The synthetic UI/API agent additionally checked the direct route and report/import gate. The optional 3D surface route was not verified.
- The backup/restore agent exercised archive creation, restore-check, tampered-hash rejection, path-traversal rejection, unchanged live-state hashes and temporary-directory cleanup with tiny temporary fixtures only. No full suite was run.
- Compose configuration rendered with the required environment and showed only proxy ports bound to `127.0.0.1`; both shell scripts pass `bash -n`.

## HackCure readiness still open

This is **not an L2-ready or organizer-approved release**. The preflight against the existing development database passes source/archive, matching imported prediction, saved report and loopback checks, but fails because a credentialed local reviewer is missing; the optional published/assigned Academy lesson is also absent. The dedicated Docker rehearsal database does not yet exist, and this machine has no required MEDFORGE Docker images, so no Docker stack, event database, real-source backup or full backup restore rehearsal was run. Disk free space was 7.3 GB at the last check. No reviewer/student account, password, assignment, Docker image or public instance was created.

There is still no hosted URL, hosted CI result for these commits, independent clean-clone result, release tag, organizer acceptance, resolved external-use basis for OpenKBP-Opt, or clinical/legal approval. See [`HACKCURE_COMPLIANCE.md`](../HACKCURE_COMPLIANCE.md), [`SYNTHETIC_DOSETWIN_DEMO.md`](../SYNTHETIC_DOSETWIN_DEMO.md), and [`HACKCURE_BACKUP_RESTORE.md`](../HACKCURE_BACKUP_RESTORE.md).
