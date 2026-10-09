# MEDFORGE — Luna XHigh implementation handoff (working draft)

**DO NOT BEGIN IMPLEMENTATION solely from this draft.** We have not locked complete feature scope, data availability or module readiness. This is the checklist and contract that will be finalized after design sign-off. No repo was created or modified in this research pass.

**Read order:** `00_ARCHITECTURE_BASELINE.md` -> `01_RESEARCHED_LIBRARIES_AND_AGENT_SKILLS.md` -> `02_GAMIFICATION_EDUCATOR_AND_UX_SPEC.md` -> this file. Follow source license terms. Commit/fork upstream only with explicit permission and repository owner details. The three modules are NEVER silently removed.

## Mission

Deliver a coherent, technically correct MEDFORGE monorepo. Preserve and integrate all feasible upstream capabilities progressively; maintain a transparent capability readiness registry for anything requiring checkpoints/data/GPU/solvers. Build full professional scientific viewers plus shared educational workflows from a single source of truth. First demonstrate three authentic data vertical slices rather than claiming that all model families execute instantly. Include documentation, tests, provenance, reproducibility and failure states.

## Required repo deliverables

```text
medforge/
  AGENTS.md
  README.md
  .env.example
  pnpm-workspace.yaml
  apps/web/                # React/TypeScript/Vite, lazy-loaded modules
  apps/api/                # FastAPI, typed route handlers, registry, auth abstraction
  workers/surgery/         # isolated upstream adapter/runtime
  workers/dose/            # OpenKBP calculations, optional solver adapter
  workers/acoustic/        # SciPy, scikit-learn signal-processing pipeline
  packages/contracts/      # generated TS types + OpenAPI schema versioning
  packages/ui/             # shared shadcn-derived components/tokens
  data/                    # gitignored raw/processed/artifacts
  docs/architecture/
  docs/scientific-validation/
  docs/provenance/
  docs/licenses/
  docs/feature-parity.md
  scripts/                 # doctor, seed_sample, verify_assets, demo, smoke
  tests/                   # fixtures + core integration and E2E
```

**Scope discipline:** a modular monolith FastAPI API is recommended; long-running worker commands may be subprocesses initially, not full distributed microservices. SQLite/local assets acceptable in MVP; no requirement for MinIO/Postgres unless deployment explicitly needs them. Vite must not import heavyweight scientific components into all routes; use lazy module boundaries.

## Architecture entities and minimal invariants

1. `Dataset`: ID, source URL, license, version, split protocol, allowed purpose, access constraints.
2. `EvidenceCase`: immutable dataset case ID, modality, pseudonymized subject/video linkage, available assets, annotation coverage, units, provenance.
3. `Artifact`: typed modality-specific schema, storage locator, checksum, explicit origin, geometries and labels.
4. `ModuleCapability`: module/task/tool, requirements, readiness reason, applicable datasets and models.
5. `ModelRegistration`: upstream URL+commit, config, checkpoint hash, runtime/device, accepted input types, output schemas, status.
6. `AnalysisRun`: case, operation, versioned config, job state, metrics/artifacts, logs, code revision, error details.
7. `Challenge`: immutable version, case reference, ordered step blocks, allowed tools, reveal policy, rubric.
8. `Attempt`: learner reference, challenge version, observations, submission, grading/review status; server enforces reveal gate.
9. `AchievementEvent`: durable idempotent learning activity event, not an unverifiable client-side counter.
10. `EvidenceReport`: selected artifact references, calculations, limitations, source/license notices, test status.

**Key distinctions:** reference annotation vs archived prediction vs live inference vs computed metric vs synthetic teaching example; prediction vs optimized plan; display parameter vs numerical computation; account role vs UI mode; single-frame detection vs full surgical timeline.

## API contract / OpenAPI draft

- `GET /api/v1/modules`: module descriptors, available tasks and readiness.
- `GET /api/v1/datasets?module=&license=`: dataset records with access policy.
- `GET /api/v1/cases?module=&dataset=&query=&page=`: paged, metadata-only.
- `GET /api/v1/cases/{id}`: case metadata and permitted assets.
- `GET /api/v1/cases/{id}/viewer-manifest`: typed assets, geometry, channels, annotations, provenance references.
- `GET /api/v1/artifacts/{id}`: short-lived access to permitted preprocessed assets.
- `GET /api/v1/models`: model readiness and prerequisites.
- `POST /api/v1/models/{id}/check`: `ready`, `missing_weights`, `missing_runtime`, `incompatible_case`, `blocked_license`, reasons.
- `POST /api/v1/experiments`: validate versioned experiment spec, return ID.
- `POST /api/v1/experiments/{id}/runs`: create idempotent analysis run.
- `GET /api/v1/runs/{id}` and `/events`: status, progress, errors, artifacts. No false completion.
- `POST /api/v1/comparisons`: compatible-run comparison; reject different protocols/units/splits.
- `GET/POST /api/v1/challenges`: educator-only authoring and learner-safe views.
- `POST /api/v1/challenges/{id}/attempts`: create immutable attempt.
- `PATCH /api/v1/attempts/{id}/draft`: allowed observations and draft responses.
- `POST /api/v1/attempts/{id}/submit`: server-validated idempotent commit, then reveal authorization.
- `GET /api/v1/attempts/{id}/debrief`: hidden before submit.
- `POST /api/v1/reports` and `GET /api/v1/reports/{id}`: provenance-linked export.

Use Pydantic v2 typed unions and generated TypeScript/OpenAPI contracts; reject inconsistent version/units/mismatched case; do not use `dict[str, Any]` as the only validation of scientifically meaningful data. Server access to hidden reference artifacts must be protected, not merely hidden by browser CSS.

## Work packages with acceptance tests

### W00 — Discovery and audit (BLOCKS IMPLEMENTATION)
- Inventory every upstream repo commit/ref and license. Produce `docs/feature-parity.md`, each capability linked to original module and exact relevant code/config/data/checkpoint.
- Verify 1 actually accessible, redistributable sample case per target modality or mark explicit blocked status with substitution policy.
- Test hardware and dependencies: CPU/GPU/VRAM, audio decoding, WebGL, Python/Node, solver availability; write `scripts/doctor` producing a concise JSON compatibility report.
- Never insert invented demo predictions; if FiSaV inaccessible, clearly label a synthetic acoustic educational sample and keep actual FiSaV task blocked.
- AC: audit table contains source, required artifact, license, operational readiness, and automated verification or reason blocked.

### W01 — Foundation and integration contract (P0)
- Bootstrap pnpm monorepo frontend + FastAPI backend; lints, typechecks, pytest, Playwright, meaningful CI.
- Define shared theme, sidebar/header/responsive shell, route-level code splitting, global request error boundary.
- Implement Case/Dataset/Artifact/Run/Model registries and API contracts; seed 3 valid sample manifest records with REAL data references only when files validated.
- UI: shared Case Library / Case Detail / explicit missing asset states; no inert navigation placeholders.
- AC: three modules are discoverable, API refuses invalid manifests, unit test/contract test passes, direct URL refresh works, provenance visible.

### W02 — SurgiVision full vertical slice (P0/P1)
- Import selected Endoscapes sample(s), parse COCO boxes/masks/CVS metadata, verify frame ID and shape.
- Implement frame explorer (or legal continuous video when available), timeline sampled-frame indicator, zoom/pan, canvas overlays using a single coordinate transform, confidence/reference toggle.
- If a verified checkpoint/runtime works: wrap real inference in isolated adapter, include model registration/checkpoint hash and output conversion; else disable with reason.
- Show three CVS criterion labels, not one overconfident surgical approval. Include model/ref comparison and report.
- AC: mask/box pixels align known reference fixture at resize/zoom; file loading and layer toggles real; 1 sample export with provenance; no assumed continuous video.

### W03 — DoseTwin full vertical slice (P0/P1)
- Convert OpenKBP sparse CSV to verified dense volumes, retain voxel order/spacing and orientation information only when proven.
- Preprocess one compatible case + reference and two published archived prediction arrays if obtainable; compare same patient/case ID and geometry.
- Provide three synchronized CT planes, controlled dose/structure overlay and per-ROI DVH with explicit Gy and %/cc conventions; optional mesh from verified voxel world mapping.
- Difference map `prediction - reference`, independent diff tests and navigation from hotspot to CT coordinates. Correct Dmean and benchmark-relevant metrics; don't equate maximum plotted color with unsafe treatment.
- AC: phantom tests for axis ordering, 3D navigation, numeric DVH monotonicity and known percentile values; unit tests match official evaluation for representative available case.

### W04 — FistulaGuard full vertical slice (P0/P1)
- Inspect data access, channel types, sensor positions, units, sample rates, ECG and labels. Import only files permitted by license.
- Provide waveform playback where it is really audio-compatible and linked uPlot channels. For signals not physically audio, clearly label sonic rendering if used; do not claim native sound.
- Compute PSD/spectrogram through trusted SciPy routines, overlay quality gates, preserve original units, define selected time window and downstream feature recomputation.
- ML baseline only with labels adequate for patient-grouped eval. Keep all segments from a single patient in one split. Report confusion, counts, sensitivity/specificity with limitations, not diagnosis.
- AC: waveform sample count/time axis matches source; spectral test with a known test sine; clipping/noise flag tests; correct group split tests; do not activate classification without fitted artifact.

### W05 — Model Lab/Experiment Center (P1/P2)
- Model catalog and readiness messages; task-specific input schema, model info, checkpoint/version source.
- Enqueue real analysis jobs with status, log capture, cancellation and result artifact registry. Cache only by hash of source + config/version when valid.
- Small but genuine compare run: dose metrics and two predictions; do not fake metrics for other domains.
- Advanced training and solver workflows remain separate workers and marked `requires_setup` if not executable.
- AC: missing checkpoint/solver causes blocked status and no fake result; complete runs replay; failed jobs retain errors.

### W06 — Student Academy / Educator Builder (P1/P2)
- Reuse identical scientific viewer components with limited tools and gated reference/model layer reveal.
- Ship one curated mission per modality (subject to real data) with intro -> inspect -> submit -> reveal -> feedback; add simple Academy path screen.
- Adopt selected Trophy UI components for progress, no forced leaderboard; implement server-scored rubric events, one submission and no duplication after refresh.
- Educator can duplicate sample challenge, rearrange linear steps via dnd-kit when available, set allowed layers and scoring, publish immutable version.
- AC: student API cannot access reference prematurely; 3 demos run offline; score deterministic; accessible keyboard and reduced-motion; professional view unchanged.

### W07 — Reports, UX polish, demonstration (P1)
- Unified source-linked evidence report: real source attribution, exact method, input hash, algorithm/version, artifacts, units, limitations, state.
- Save/restore viewer state and case deep links. Focus/Compare/Analysis layout presets; handle missing result gracefully.
- Implement precise empty, loading, warning, blocked and cancelled states; keyboard nav/contrast/resize tests; no clinical 'safe/unsafe' badges.
- Validate on jury machine offline and rehearse three real analysis moments + academy mode switch.
- AC: one click reaches each real case, one meaningful scientific interaction per module, a reproducible report; no broken routes; no network requirement to demo.

### W08 — Advanced parity preservation (P3, long-term roadmap)
- Surgical detection/segmentation/phase/action model families with available checkpoints and genuine run configs.
- Radiotherapy inference with compatible weights, OpenKBP-Opt and PortPy isolated solver capabilities and input checks.
- Multi-channel/ECG-aligned FistulaGuard experiments, model calibration and robustness.
- MLflow integration and more complete research job worker infrastructure; authentication, permissions, collaborative review, backend database/object storage.
- This is tracked as pending capability parity with exact readiness flags. Never silently erase or redefine scientific upstream algorithms for convenience.

## Two release gates

**Hackathon gate**: 3 authentic modality workspaces or clear scientifically labeled blocked alternative; one complete analysis per module, one curated student challenge path, provenance and reliable offline demo. An unavailable raw acoustic dataset cannot be presented as a real AVF recording.

**Full parity gate**: all supported upstream research methods inventoried, implemented or intentionally blocked with precise reasons, tested against original benchmarks where feasible, licensing and reproducibility records complete. Full feature parity is not the same as 'every checkpoint present locally'.

## Exact UX requirements for Luna

- Medical scientific data is main visual focus; avoid dashboard of generic cards.
- Separate specialized viewers, not one reused chart template.
- Shared top status includes data source, run type (reference/archived/computed/live) and analysis availability.
- Left narrow specialty navigation, center primary data, right context inspector, bottom time/metric panel. Each can collapse; no accidental scroll-wheel page scroll during volume navigation.
- Academy uses Trophy UI and Motion selectively. Professional uses restrained motion and always labels units.
- Shared selected object state includes `{caseId, frameId?, voxel?, roiId?, channelId?, timeRange?}` and dispatches to existing compatible viewers only; no cross-specialty chart synchronization.
- Drag/resizing require explicit edit mode plus Reset Layout; moving evidence cards in teacher builder uses separate DnD primitives.
- No full OHIF integration unless actual data + transforms and maintenance case justify it.

## Suggested phased order for limited 37h event

These are **relative priority phases, not a claim of guaranteed completion**:

1. **Preflight**: dataset access/download+license audit, run one example from each upstream source if possible. Abandon unsupported live-inference promises immediately.
2. **Foundation**: typed contracts, 3 working case stubs referencing verifiable assets, shared UI shell, direct navigation.
3. **Parallel science**: each owner builds a full data->compute->view->validate slice; integrator ensures contract parity.
4. **End-to-end**: cross-module case discovery, real reports, one case-based Academy challenge; test browser responsiveness.
5. **Jury readiness**: seed legally permitted small offline demo assets, run smoke/geometry/quality tests, stabilize routes, remove fake/empty functionality.

With 4 people: surgery owner, dose owner, acoustic owner, platform/Academy integrator. With 3: rotate integration duty and defer advanced authoring.

## Source verification and scientific test suite

| Test | Fixture | Pass condition |
|---|---|---|
| Surgical frame geometry | COCO image with known bbox/mask | Overlay exact after rescale/crop and timeline navigation |
| Surgical split | IDs from official split | No video ID appears in train and test |
| Dose axis order | 3D phantom with asymmetric landmarks | Axial/sagittal/coronal consistent |
| Dose grid comparison | identical and offset arrays | zero and known difference map; same shapes+units enforced |
| Dose DVH | known voxel doses + organ mask | monotonic volume fraction, correct interpolation/percentile convention |
| Acoustic sine | synthetic pure-tone unit-test fixture | PSD peak near reference frequency |
| Acoustic signal time | N samples and Fs | `duration=N/Fs`, correct selected interval |
| Patient grouping | labeled patients with segments | no subject ID overlap in train/test |
| Academy answer gating | unauthorized attempt | reference/model answer endpoint refuses access |
| Academy XP | duplicate requestKey | one scoring event and one XP update |
| Job lifecycle | worker raises exception | failed state, logs and no completed results |
| Permissions | student tries model training | rejected by API, not just hidden by UI |
| Attribution | report for any case | source/algorithm/version/method and limitations present |
| Perf | hackathon laptop | no crashes during three core cases; lazy route loads |

## Open questions to resolve BEFORE lock

- Can permitted raw FiSaV files be downloaded in time? Channel format, sample rate, labels and redistribution?
- Are Endoscapes sampled frames sufficient for the planned live video experience? Which checkpoints actually download and execute on team hardware?
- Which OpenKBP / OpenKBP-Opt patient and which two prediction arrays can be subset-exported legally and reliably?
- Is the official runtime CPU-only, or can a teammate bring a GPU? VRAM and disk limits?
- Is MEDFORGE an educational/research hackathon demonstration only, or does the team plan future production with real patient data? The latter changes governance significantly.
- What is the final color/brand/typography direction? One full-screen specialist design to sign off before style proliferation.
- Is educator authoring a functioning hackathon deliverable or a post-hackathon extension?
- Which features are critical-path to demo vs full platform parity? Write acceptance tests for each before assignment.

## Final handoff prompt template (fill in after lock)

> Read the four specification files in order. Audit repository and source resources first; do not silently delete any of SurgiVision, DoseTwin or FistulaGuard. Create feature-parity + integration checklist and check each capability against actual models/data. Implement tested API contracts, medical viewers, core computations, student missions and honest model readiness. Never fabricate patient data, model inference, numbers or validation; use clearly labeled synthetic mathematical fixtures only for testing. Retain and document all supported upstream research capabilities; isolate conflicting dependencies. Run typecheck, scientific tests and E2E flows, fix failures and provide an implemented/blocked table with evidence, code refs and remaining work. Do not install all optional UI libraries; follow the selected stack matrix and design tokens. Treat design status as provisional until the team explicitly approves the lock file.
