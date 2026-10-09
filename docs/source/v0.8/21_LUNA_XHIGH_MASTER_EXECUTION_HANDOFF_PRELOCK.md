# 21 — Luna XHigh master implementation handoff (v0.6 PRE-LOCK)

> **Not authorization to replace scientific features with mockups. Not a locked architecture.** Use this as the implementation contract once user approves the outstanding lock gates. Read files `00..20` first. Ask only for unavailable essential authorizations; otherwise execute defensible fallbacks, report exact blockers, and never claim an unavailable feature is complete.

## Nonnegotiable scope
- **One MEDFORGE monorepo**: `apps/web` React+Vite+TypeScript+Tailwind+shadcn; `apps/api` FastAPI; `workers/` isolated scientific adapters; `packages/contracts` typed shared DTOs; `references/` pinned research repos; `data/` ignored raw/derived; `docs/` provenance and architecture.
- **Three independent specialty modules remain in scope**: SurgiVision, DoseTwin, FistulaGuard. Do not collapse them into a false same-patient oncology/vascular workflow. All original research capability families are tracked in `PARITY.md`, even if only selectively runnable in 37-hour hackathon demo.
- **Three user experiences**: Professional Studio (serious, research/teaching use), Student Academy (gamification over real evidence), Educator Case Builder (author/publish versioned and answer-safe assignments). One scientific engine, separate permissions and context.
- **Shared systems**: cases, artifacts, datasets, models, runs, reports, evidence provenance, analysis readiness, experiment comparisons. Default to local SQLite + file artifacts for offline demo, architecture ready for PostgreSQL/MinIO/worker queue later.
- Medical integrity: research/education only; no clinical diagnosis or treatment recommendations, no patient identity data, no fabricated statistics, no unverifiable checkpoint claim, no synthetic results labeled clinical.

## First tasks: evidence acquisition and feasibility (must happen before UI embellishment)
1. Clone original Git repos at vetted SHAs in `17_REPOSITORY_FEASIBILITY_AUDIT_2026_10_09.md`; log hashes and license decisions. Run included unit tests.
2. Obtain source-approved assets: OpenKBP `pt_201` (priority), Endoscapes labeled subset, author-provided CVS weights if feasible, FiSaV raw data only if rights and exact metadata resolved. Verify file checksums after transfers.
3. Run `scripts/validate_openkbp_case.py` on a real case. Reconcile its metrics with the **official** OpenKBP evaluation protocol; its built-in D95/D0.1cc are preliminary explanatory calculations, not benchmark-matching certification.
4. On target laptop record CPU, RAM, disk, GPU/driver. Test React19/Vite library dependencies; do not assume compatibility from documentation.
5. Fill `DEMO_ASSETS.md` with only real authorized samples and their source IDs. If one module lacks real assets, record this as a specific demo blocker and retain the module's workflow/architecture intact.

## Technical vertical slices (implementation order)

### V0 — Platform shell + contracts
- Working routes `/studio`, `/studio/cases`, `/studio/surgivision/cases/:id`, `/studio/dosetwin/cases/:id`, `/studio/fistulaguard/cases/:id`, `/studio/models`, `/studio/experiments`, `/educator`, `/academy`, `/reports`.
- Permission-aware navigation and module cards; mobile-safe case explorer; error/loading/empty/unavailable states. One single scientifically typed manifest per modality.
- Typed models: DatasetVersion, EvidenceCase, FileAsset, ModalityGeometry, ModelManifest, RunSpec, RunStatus, EvidenceProvenance, StudentAttempt, PublishedLessonVersion.

### V1 — DoseTwin first dependable scientific slice
- Reconstruct sparse OpenKBP 128³ arrays, preserve original grid and spacing. Render honest benchmark-grid axial/sagittal/coronal slices with aligned ROI boundaries and dose overlay, pixel/voxel location and dose in Gy.
- Pick any available named organ; compute DVH and Dmean, Dmax and benchmark-matching ROI metrics with source code comparisons. Save results + provenance + hash. Force same-case/dimensions/voxel geometry before two-dose compare.
- Advanced AI dose prediction/PortPy optimization are separate, optional worker operations, not disguised color-filter controls. Do NOT claim native patient DICOM geometry.

### V2 — SurgiVision dependable slice
- Preserve frame ID and original image size, upload/parse COCO, correct coordinates and masks; filter by expert label/phase where available.
- Video player only if actual video; otherwise sample frame browser with discrete timestamps. Clear legend: expert annotation vs model prediction.
- Plug in actual tested CVS AdaptNet inference only if checkpoint and isolated runtime pass. Expose detector/segmentation/CVS/phase/triplet capability inventory even if advanced tasks require setup.

### V3 — FistulaGuard dependable slice
- Confirm actual legal AVF dataset. If FiSaV unavailable, do not silently substitute AVG or synthetic physiological signals. Provide precise source blocker and keep module shell with waveform/spectral interface and validated unit-level algorithms.
- On real session: channels and sensor location metadata -> time selection -> PSD/spectrogram with units -> reproducible feature extraction -> report. Classifier optional and only after subject-disjoint evaluation.

### V4 — Shared experimental tooling
- Model registry with dynamic readiness checks. Completed result artifacts must be searchable; stable `POST /api/v1/runs`, `GET /api/v1/runs/:id` and streamed/polled status. Do not expose arbitrary Python commands to HTTP clients.
- One actual experiment comparison on compatible artifacts if available, linked back to source case and exact algorithm revision. Do not manufacture two dose predictions if only reference dose exists.

### V5 — Evidence-to-learning vertical slice
- Educator chooses one authorized source case and permitted scientific viewer tools, authors a task, assessment rubric and reveal rule, previews as student, publishes immutable version.
- Student starts a versioned mission, interacts with scientific data, submits answer, receives server-computed rubric result and authorized answer reveal, sees optional XP using Trophy UI.
- Backend never includes hidden answers in pre-submit JSON. Include replay protection, duplicate submission handling, attempt immutability, accessibility and keyboard controls.

### V6 — Report/export and jury story
- Export markdown or JSON evidence report (PDF optional) with dataset ID/version, source link, normalized parameters, model/algorithm hash, per-case units, reference class and limitations.
- A lightweight Department Atlas can guide Academy navigation; never imply the three datasets are linked to the same patient.
- Test at 1366x768 and keyboard-only; prepare OFFLINE mode and a reproducible cold start script.

## API contract quality gates
- `GET /api/v1/modules`, `/datasets`, `/cases`, `/cases/{id}`, `/cases/{id}/viewer-manifest`, `/models`
- `POST /api/v1/models/{id}/validate` -> typed `missing_requisites[]` and `can_run`
- `POST /api/v1/runs` -> immutable input manifest and explicit queued/failed/completed; `/runs/{id}/artifacts` returns typed references.
- `POST /api/v1/lessons`, `/lessons/{id}/publish`, `/missions/{id}/attempts`, `/attempts/{id}/submit`, `/attempts/{id}/reveal` with authorization and version checks.
- Artifact schema must distinguish origin: `reference_annotation`, `benchmark_reference_dose`, `archived_model_prediction`, `computed_metric`, `synthetic_test_fixture`.

## PR / quality workflow
1. Each PR includes dependency changes, code, unit/integration tests, screenshot or screen recording when UI, source attribution and one line in `PARITY.md`.
2. Record observed failure modes and partial coverage in `STATUS.md` under exactly `working`, `source-only`, `requires-setup`, `blocked`, `future`.
3. No dummy click actions or nonfunctional toggles; viewer mock/placeholder allowed only if labeled as **non-functional design preview** and excluded from acceptance criteria.
4. Run `typecheck`, `lint`, `unit test`, `api tests`, `browser smoke`, `scientific validation`, `offline demo` before release candidate.

## Recommended risk-controlled hackathon sequence (37h, 3–4 developers)
- **H0–4:** asset/license/compute reality checks; agree contracts; starter monorepo; decide live vs reference features.
- **H4–13:** parallel functional scientific slices with shared API; DoseTwin numerical path first; real case assets only.
- **H13–23:** finish three viewers where legal source data exists; institute run manifest, metrics, errors and provenance.
- **H23–29:** one educator→student mission based on actual source evidence; Polish viewer interactions not landing animations.
- **H29–34:** end-to-end tests, source attribution, research disclaimers, accessible UI and data-integrity checks.
- **H34–37:** demo rehearsal, offline cold start and deliverable archive; freeze nonessential features.

Do not wait until H29 to test integration. At the end of each block, there must be a cold-start runnable state and status recorded honestly.

## Release acceptance conditions
- Three **preserved** modules and full feature parity register.
- At least one authentic scientifically valid full data→calculation→viewer→report path (DoseTwin recommended).
- Honest source-backed case demonstration in other modules when files are available; if blocked, the release notes plainly state so, rather than describing all three as functioning demos.
- At least one versioned educator→student evidence challenge, answer hidden before submission, if sufficient authenticated research data exists.
- Scientific viewer selection synchronization, no broken actions, clear provenance and error states.
- No clinical certification or medical-use advertising. All tests and limitations documented.

**Architecture lock is user-controlled.** Do not interpret this pre-lock handoff as the user's approval to implement all advanced models or use restricted datasets.
