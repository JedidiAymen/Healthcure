# 30 — Luna XHigh — MEDFORGE implementation contract v0.7 (PRE-LOCK)

> This is an implementation-ready **draft of instructions**, not user authorization to initiate a repository modification or claim full parity. Read `README.md`, `00`, `17–29`, and detailed UX `04–16` in order; newer decisions supersede older status.

## Goal
Implement one medical research and education platform with independent SurgiVision, DoseTwin and FistulaGuard workspaces, unified provenance, Model Lab, Experiment Center, Student Academy and Educator Case Builder. User expects original upstream research functionality preserved in a capability register and independently integrated over stages, not quietly discarded. Hackathon slice deliberately limited to demonstrated science and practical offline UX.

## Delivery rule
At every commit, report feature source, status, sample evidence, test outcome and blockers. No faked CTs, surgical segmentation, dose predictions, audio recordings, model accuracy, clinical risk, trained checkpoints, hospital patient journeys, or downloadable assets. Educational static previews may exist only when conspicuously labeled and excluded from claim of working scientific functionality.

## First command sequence on development machine (example; adapt to actual OS)
```bash
mkdir -p medforge/{apps/{web,api},workers,packages/contracts,references,docs,data/{raw,processed,artifacts}}
cd medforge
# Copy planning docs to docs/planning, then audit pinned upstream commits and terms.
# Do NOT commit licensed/raw medical datasets or large checkpoints to Git.
# Record node/pnpm/python versions and GPU/driver/disk status in docs/TECH_LOCK.md.
```
Do **not** paste one universal package install command before verifying compatible versions. Build `apps/web` and `apps/api` with repeatable lockfiles. Use src-per-module boundaries and one generated API contract.

## Task one: freeze typed manifests
- Implement DatasetVersion, EvidenceCase, SurgicalFrameArtifact, OpenKBPVolumeArtifact, VascularSignalArtifact, ModelManifest, AnalysisRun, EvidenceProvenance, LessonVersion and Attempt.
- Each path is a typed source artifact, not arbitrary browser file path. Blob content `sha256` and license provenance.
- API offers `GET /modules`, `/datasets`, `/cases`, `/{case}/viewer-manifest`, `/models`, `/models/{id}/validate`, `POST /runs`, `/runs/{id}`, `/runs/{id}/artifacts`, educator/academy endpoints.
- Generate TS types from FastAPI/OpenAPI or shared Zod schemas, not incompatible parallel hand-coded definitions.

## Task two: scientific validation first
- Copy pinned OpenKBP pt_201 files from official source. Use validated sparse index parser; compute real metrics; cross-check official repo `provided_code/dose_evaluation_class.py`. Preserve grid spacing and distinguish synthetic benchmark reference dose.
- Use official Endoscapes image and annotation file. Correctly resize overlay in CSS transformed coordinates, accounting for original source width and height. Verify sample mask/box visually and numerically.
- Attempt legitimate vascular raw source, record metadata. If unavailable, implement quality/signal functions with explicitly synthetic *unit-test fixtures* while showing an honest blocked state in the real-data viewer; optionally use verified authentic feature-only XLSX for feature analytics.

## Task three: workspaces and interactions
- Build `/studio`, `/studio/cases`, `/studio/{surgivision|dosetwin|fistulaguard}/cases/{caseId}` with provenance drawer and four states ready, loading, no-source, error.
- Surge: frame browser, COCO overlay and CVS reference criterion; model outputs only upon tested checkpoint.
- Dose: axial/sagittal/coronal voxel-index views, ROI highlight, dose overlay in Gy, cumulative DVH with units and algorithm ID; same-case dose comparison only if real saved predictions exist.
- Vascular: waveform/PSD/spectrogram from raw sound when available, channel/time synchronized. Derived-feature-only dataset cannot drive waveform UI.

## Task four: scientific jobs and teaching
- Model manifest readiness depends on installed assets and hardware; never render unsupported operations as working.
- Support one genuine analysis run saved to local assets/SQLite with hash and input provenance; replay restores stored output without re-executing absent model.
- Educator publishes immutable versioned case challenge. Student API excludes answer keys before submit/reveal; server computes score; API idempotency and permissions tested.

## Task five: release and tests
- Synthetic numerical tests + real selected OpenKBP case official metric cross-check + one genuine surgical annotation overlay test.
- No AVF medical classifier claims without patient-disjoint held-out evaluation on real labeled recordings.
- Script for offline cold start, browser smoke in Chromium, typecheck/lint/pytest, actual screenshot proof, document LICENSE/NOTICE.
- `STATUS.md` must list every advertised feature with real status. `PARITY.md` tracks all original upstream capability families and next steps for blocked models.

## Definition of done
A vertical slice must be real data -> verified processing -> specialized viewer -> saved reproducible run -> source-linked report, with no hidden mock results and a clean startup. For hackathon, at least one complete scientific loop is required. The full research capability families remain preserved for follow-on work; advanced training and licensed solvers are not mandatory for a 37-hour demo.
