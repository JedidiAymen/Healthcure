# MEDFORGE — BUILD NOW (Luna XHigh Master Execution Directive)

**Date:** 2026-10-09 · **Status:** Implementation baseline frozen from v0.8; final product/clinical verification NOT claimed.  
**Canonical source:** `MEDFORGE_Architecture_Research_Luna_Executable_Prelock_v0.8.zip` (provided alongside this directive).  
**Mission:** Implement an actual working research/education application, not another specification or empty UI prototype.

## 0. Execution contract: start with code

You are the lead implementation agent. Read `medforge_planning_v0.8/README.md`, `00_ARCHITECTURE_BASELINE.md`, `23_UPSTREAM_FEATURE_PARITY_REGISTER.md`, `24_MVP_CUTLINE_REAL_CAPABILITIES_AND_DEMO_FLOWS.md`, `31_EXECUTABLE_REFERENCE_SPEC_OVERVIEW.md`, `38_LUNA_XHIGH_MASTER_EXECUTION_HANDOFF_V08.md`, and `reference_impl/README.md`. Use other v0.8 docs for details only when executing affected work packages. Do **not** rewrite the full architecture or generate v0.9/v1.0 planning documents instead of implementing software.

If this is a clean workspace, create `medforge/` and implement there. If an existing MEDFORGE repository is available, inspect and reuse it non-destructively. Never overwrite unrelated work. Do not push code or deploy externally without authorization. Write and maintain `docs/STATUS.md`, `docs/PARITY.md`, and `docs/BLOCKERS.md` while implementing, not as substitutes for code.

### Non-negotiable product scope
- **Independent medical domains:** SurgiVision (laparoscopic gallbladder surgical CV), DoseTwin (head-and-neck OpenKBP radiotherapy research), FistulaGuard (hemodialysis vascular-access acoustics).
- **Three experiences:** Professional Studio, Educator Studio and Student Academy.
- **Shared features:** dataset/case registry, typed scientific artifact registry, synchronized viewers, run/job and model registry, provenance, experiment comparison, evidence reports, lesson grading and gamification.
- **Full upstream capability parity is a roadmap obligation**, not a false MVP claim. Keep each research model/training/solver capability in `docs/PARITY.md` with its precise ready/blocked/planned status.
- **Medical scope:** education/research only. No surgical clearance, patient diagnosis, treatment prescription, validated medical-device claim, or fabricated model output.

## 1. Architecture freeze (do not debate again)

- Frontend: **React 19 + Vite + TypeScript + Tailwind 4 + shadcn/ui**. Use Recharts for ordinary charts, uPlot for dense vascular signals, WaveSurfer only for genuine playable audio, dnd-kit for educator ordering, restrained Motion for Academy, and 3D/Cornerstone only after a smoke test proves format + React/Vite compatibility. Build a reliable index-space DoseTwin viewer first if needed; do not delay MVP for DICOM conversion or an elaborate 3D effect.
- Backend: **FastAPI modular monolith**, Pydantic contracts, SQLite local database, isolated Python workers/adapters for legacy Torch/CUDA, Keras, signal processing and radiotherapy solvers. Introduce queues/Postgres/MinIO only if a real requirement demands them.
- Read `reference_impl/` first: reuse its SQLite migration, actual limited FastAPI routes, generated OpenAPI, discriminated artifact schemas, OpenKBP sparse parser, TypeScript scientific-selection types and tests. It is a reference harness, **not** an authenticated public deployment.
- Data: approved research cases and hashed assets; no patient-identifiable information, hardcoded public uploads, unsanitized filesystem path APIs or direct third-party URLs assumed reliable during the demo.
- Scientific views have real data origin labels, units and source hashes; unavailable data/model features display truthful status, not a dummy or simulated success.

## 2. Build sequence — actual code before documentation

### Gate A — Boot and contracts
1. Inspect the target machine and existing repo. Run the v0.8 reference tests. Record Node, Python, OS, RAM, GPU, and disk resources.
2. Scaffold/integrate monorepo (`apps/web`, `apps/api`, `workers`, `packages/contracts`, `docs`, `scripts`). Implement documented API-to-TS type generation and basic database migrations.
3. Implement common shell, specialty routes, case registry, case-detail and case-viewer-manifest API, safe artifact serving and a local health/readiness page. Use explicit loading, empty and error states.
4. **Exit Gate A only when** fresh install, lint/typecheck, API tests, route smoke tests, and case-metadata loading succeed.

### Gate B — DoseTwin (first complete verified scientific slice)
1. Obtain legally usable OpenKBP `pt_201` or equivalent from published data; record source revision and file checksums. Actual case folder must contain `ct.csv`, `dose.csv`, `possible_dose_mask.csv`, ROI CSVs and `voxel_dimensions.csv`.
2. Use sparse arrays correctly. Verify 128×128×128 benchmark grid if appropriate, source voxel spacing, mask indices, missing ROI behavior, numerical dose units. Do **not** claim original DICOM world geometry or clinically delivered dose.
3. Implement orthogonal index-space slices, linked voxel selection, CT + dose layers, ROI visibility/opacity, cumulative DVH, dose metrics, proper legends/units, saved analysis and evidence report.
4. Cross-check representative calculations against the official OpenKBP evaluator. Never compare different patient IDs or inconsistent grids. Difference maps require two **genuine compatible** dose artifacts; otherwise explain unavailable comparison.
5. **Exit Gate B only when** real case opens and numeric cross-check, synchronization and report tests pass.

### Gate C — SurgiVision
1. Acquire permitted Endoscapes images + COCO annotations. Preserve frame/case identity and original image dimensions.
2. Implement image/frame explorer, pan/zoom, boxes, masks and instruments overlays, three CVS criteria with reference-provenance and annotation coverage; selecting an annotation updates inspector and timeline.
3. Set up optional CVS-AdaptNet/SurgLatentGraph worker. Verify CUDA/dependencies and actual checkpoint hashes, run authentic sample inference and compare outputs **before** enabling the Run button.
4. Record all upstream research tasks (object detection, instance segmentation, CVS, phases, action triplets, training/evaluation) in `PARITY.md`; don't pretend all pretrained models exist.
5. **Exit Gate C only when** genuine annotation alignment passes visual/data tests; live inference may be explicitly blocked if it cannot be verified.

### Gate D — FistulaGuard
1. Search/acquire FiSaV authorized raw signals or another scientifically appropriate *AVF* dataset and document access/license, sample rate, units, channel identity, patient IDs and acquisition position. Clearly distinguish AVF from AVG.
2. Build multichannel waveform, synchronized time-window selection, FFT/PSD or spectrogram, signal quality indicators, feature extraction and source metadata.
3. Support an experimental stenosis classifier only if patient-disjoint labeled evaluation and honest confidence/uncertainty reporting are possible.
4. If recordings are not accessible: leave a truthful **data-blocked** case state, test synthetic signals only in tests, and allow correctly labeled published *feature-only* analysis without pretending raw waveform availability.
5. **Exit Gate D when** genuine authorized waveform works with real feature calculation **or** dataset gate is honestly documented and the UI blocks fabricated medical results.

### Gate E — Shared Model Lab and education
1. Model readiness: code/checkpoint/runtime/case compatible; display source repo + commit/license; run only executable adapters. Persist run input hashes, parameters, status, artifacts and logs. Failed job != success.
2. End-to-end learning loop: educator selects an authorized research case → composes a lesson with draggable instruction/evidence/observation/measurement/question/reveal blocks → defines a validated rubric → publishes immutable lesson version → student investigates in restricted viewer → submits → backend grades/reveals permitted reference → records progress/XP idempotently.
3. Hidden answers and instructor-only annotations **must not be serialized to students** before authorized reveal. Implement role checks server-side before publishing externally.
4. Evidence report contains actual provenance, selected views, scientific limitations, derived metrics and data/method identifiers.
5. **Exit Gate E only when** one genuine research-case mission completes from educator publishing through student submission and server-side feedback without answer leakage.

### Gate F — Final integration and demo
1. Run all three specialty routes, no hard-coded mock predictions, no stale UI state and no blank charts. Verify label/units and source attribution on all visible scientific figures.
2. Run offline/local cold-start demo on actual target laptop. Verify no live dependency on an external model-hosting URL. Provide dataset manifests but do not redistribute prohibited datasets.
3. Keep `STATUS.md` with working, tested, blocked and planned items. For blockers: actionable missing resource, attempted verification, and the exact functionality still exposed.
4. Test error states (wrong data type, bad indices, missing checkpoint/solver/recording, incompatible dose grids), permission checks, keyboard use and reduced motion.
5. End with launch commands, screenshots/screencast if feasible, reproducible test output and a truthful demo route.

## 3. Exact expected routes (simplify if needed, preserve semantics)

- `/` landing + persona selection
- `/studio`, `/studio/cases`, `/studio/surgivision/cases/:caseId`, `/studio/dosetwin/cases/:caseId`, `/studio/fistulaguard/cases/:caseId`
- `/studio/models`, `/studio/experiments`, `/studio/reports`
- `/academy`, `/academy/missions/:missionId`, `/academy/progress`
- `/educator`, `/educator/cases/:lessonId/edit`, `/educator/assignments`, `/educator/submissions`

Use stable deep links and preserve current case/view state. Professional tools stay sober; gamified rewards appear only in Academy.

## 4. Test/quality contract

- `pytest`: scientific loaders, synthetic array edge cases, official OpenKBP metric parity on **genuine** data when downloaded, safe worker failures and case/user authorization.
- Frontend: `tsc`, lint, browser smoke tests for routes, scientific selection synchronization, overlays, charts and restricted student manifests.
- Schema: SQL migrations apply on a fresh SQLite DB; OpenAPI is generated from implemented FastAPI endpoints, never invented. Frontend contracts match generated schema.
- Reproducibility: pin source commits and scientific dependencies; record all data access and licensing. Synthetic unit tests do not establish clinical validity.
- Each screenshot/chart must have actual scientific data OR an explicit fixture/test label. Do not claim successful model inference without logs, weights and test input.

## 5. Timeboxed hackathon strategy (~37 hours)

| Slice | Priority | Deliverable | Fallback |
|---|---|---|---|
| Platform boot and contracts | Must | one functioning app + one source-of-truth schema | no external deployment |
| DoseTwin | Must | genuine case + DVH + viewer + report | index-space viewer; archived reference only |
| SurgiVision | Must | genuine annotated frames + CVS inspection | honest model-not-ready banner |
| FistulaGuard | Must preserve | genuine acoustics if authorized, tested signal pipeline | clear dataset-blocked status, no fake patient signal |
| Academy/Educator | High | one publish → play → grade mission | use DoseTwin case first |
| Model/Experiment Lab | High | registry, readiness and saved run | disable unavailable engines |
| Advanced models/3D/solvers | Follow-up | parity register + validated adapters | do not delay baseline |

Parallelize specialist modules after interface contracts stabilize. Do not delay useful vertical slices for GPU installations, elaborate landing animations, a full virtual hospital, enterprise-scale services or unnecessary abstraction.

## 6. Reporting (required after every integration milestone)

Update `docs/STATUS.md` with: implemented features, exact test commands and results, authentic/synthetic source distinction, screenshots/URLs if present, remaining blocker, and next actionable code change. Update `docs/PARITY.md` whenever an upstream feature remains gated. Use `docs/BLOCKERS.md` for genuine external prerequisites, not solvable local bugs.

## 7. STOP criterion for the planning phase

No additional grand architecture version documents. Only make incremental decisions when real test failures, scientific-data restrictions or incompatible dependencies force them. **Build from this baseline now.** Do not push externally without approval.

## Primary scientific sources
- `https://github.com/CAMMA-public/Endoscapes`
- `https://github.com/CAMMA-public/CVS-AdaptNet`
- `https://github.com/CAMMA-public/SurgLatentGraph`
- `https://github.com/ababier/open-kbp`
- `https://github.com/ababier/open-kbp-opt`
- `https://github.com/PortPy-Project/PortPy`
- FiSaV data publication (raw-access and use terms must be verified)

**This document freezes implementation direction, not scientific evidence or claims of completed functionality.**
