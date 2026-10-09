# 38 — MEDFORGE Luna XHigh master execution handoff v0.8 — PRE-LOCK

> Read `README.md`, `00_ARCHITECTURE_BASELINE.md`, then `17`, `23`, `24–30` and `31–39`. The v0.8 executable reference is a **small verified engineering foundation**, not the finished platform. User has NOT approved v1.0 lock or code modifications to an external repository.

## Mission and constraints
Build a unified React/FastAPI medical **research and education** platform for HackCure. MEDFORGE contains **three independent full-scope specialty modules**: SurgiVision (surgical CV), DoseTwin (head/neck radiotherapy benchmark analysis) and FistulaGuard (vascular-access acoustic research). The experiences are Professional Studio, Student Academy and Educator Case Builder. Preserve Model Lab, Experiment Center, reporting, source/algorithm provenance, gamification and scientific chart/viewer interactions.

**Do not silently remove features** from the original research repositories. Mark every feature `integrated`, `implemented`, `requires-setup`, `unverified`, `planned` or `blocked` in a parity register. A blocked upstream capability may be unavailable at hackathon time without being deleted from the future architecture.

## Read the actual code reference
- `reference_impl/db/migrations/0001_init.sql`: normalized relational data model.
- `reference_impl/apps/api/app/schemas.py`: strict Python data schemas and artifact union.
- `reference_impl/apps/api/app/main.py`: very limited local API with real OpenKBP sparse CSV processing only when installed.
- `reference_impl/contracts/openapi-implemented.json`: generated machine-readable contract for existing routes, **NOT** the complete planned API.
- `reference_impl/packages/contracts/selection.ts`: discriminated state for synchronized scientific viewers.
- `reference_impl/apps/api/tests/test_contracts.py`: contract tests from synthetic non-clinical fixtures.

## Required technical approach
- One monorepo: web React 19/Vite/TS/Tailwind4/shadcn; main FastAPI API; workers isolated by scientific dependency group; shared generated API contracts.
- SQLite for local hackathon; PostgreSQL and MinIO only when justified by actual multiuser deployment. Do not create infrastructure merely to appear complex.
- No arbitrary user-supplied filesystem path. Scientific artifacts referenced by storage keys, hashes, role/license conditions and authorized retrieval API.
- No direct import of old TensorFlow/Keras, CUDA/MMDetection, optimization-solvers and SciPy research algorithms into one gigantic backend process.
- Use scientific viewers with separate modality types; don't force all data into one medical universal file format.
- User-visible visual outputs must cite underlying real dataset, algorithm, version, units and/or annotation source.

## Dependency-ordered work packages and DoD

### ARC-00 — Validate environment and repository layout
- Check source repo ownership/permissions, OS, CPU, RAM, GPU/VRAM, Python/Node and disk.
- Verify source revisions from `17` and licenses from `18/27`; do not vendor restricted raw media.
- Re-run `reference_impl` DB schema, pytest, OpenAPI export and TypeScript selection typecheck.
- Deliver `docs/TECH_LOCK.md`, repository map and honest `docs/STATUS.md`.
- **DoD:** local tests pass; no data/PHI in Git; target dependency versions documented.

### ARC-01 — Canonical contracts and storage
- Integrate SQL migrations into actual backend, implement dataset/case/artifact/model/job entities.
- Adopt **one** canonical schema generating OpenAPI + TS types; typed asset union and validation at API boundaries.
- Implement role-restricted storage keys and artifact streaming **before** making uploads public.
- **DoD:** deployed schema migrations, seeded permitted cases, input validation, OpenAPI type checks and storage access controls.

### SCI-01 — DoseTwin vertical slice FIRST
- Acquire official OpenKBP `pt_201` (or other permitted case) and verify provenance/hashes.
- Parse sparse CSV `ct`, `dose`, ROI masks, feasible mask and spacing; compare selected benchmark metrics to official evaluator.
- Build three synchronized orthogonal index-space slice views, dose overlay in Gy, ROI toggle, cumulative DVH and organ metrics.
- Add case/dose analysis run, source-linked report and selected discrepancy where there are **two real compatible saved dose artifacts**.
- **DoD:** real licensed case loads, calculations independently verified, browser displays true voxels and source disclaimers, no invented physical DICOM orientation.

### SCI-02 — SurgiVision vertical slice
- Obtain legitimate Endoscapes frames and COCO labels, show original frame dimensions; boxes/masks track pan, zoom and contain correct classes.
- Show CVS criteria with expert-source/annotator meaning; reveal incomplete annotations honestly.
- Attempt CVS-AdaptNet weights in a pinned worker; if unverified, mark unavailable. Preserve SurgLatentGraph tasks (detection, segmentation, phase, action triplets, training) in parity register.
- **DoD:** correct genuine annotation overlay, screenshot proof with real source, no simulated live inference.

### SCI-03 — FistulaGuard vertical slice
- Verify usable AVF raw acquisition source/terms; if available inspect raw signals, channels, ECG, timestamps, sample rate and units.
- Build synchronized waveform, spectra, time-window feature calculation and quality checks.
- If source blocked, show dataset accession/limitation, not a generated pseudo-patient waveform; use synthetic signals **only in unit tests**. Feature-only publications may drive feature tables but not waveforms.
- Preserve patient-group ML evaluation and trial training capability as follow-on tasks. Explicitly distinguish AVF from AVG.
- **DoD:** genuine signal viewer or transparent blocked gate, reproducible unit tests, no medical classification claims without held-out evaluation.

### EXP-01 — Model Lab and experiment runners
- Registry with documented model tasks, compatible datasets, pinned repo revisions, weight SHA and environment readiness probes.
- Worker queue states: queued/running/completed/failed/cancelled; failure never writes successful output.
- Saved run stores inputs/hashes, parameters, algorithm build, environment, metrics/artifacts/provenance; replay stored results without GPU.
- **DoD:** one genuine scientific computation saved and reproducible; incompatible model disabled with visible error.

### EDU-01 — Educator/Academy shared learning engine
- Educator picks an authorized case and builds a lesson through draggable blocks: instructions, evidence viewer, observation, measurement, submission, reference reveal.
- Publish immutable lesson version after license/tool/rubric validation.
- Student receives restricted manifest, investigates genuine case, submits evidence and earns XP only after server-side grading; hidden rubrics and reference labels not sent prematurely.
- **DoD:** one complete real-case lesson/attempt/rubric/grade/reveal loop with ID-based idempotency and tests for unauthorized answer access.

### UX-01 — Product unification
- Professional Studio has restrained scientific workstation layout; Academy may use Trophy UI and meaningful rewards; Educator uses dnd-kit.
- Module-specific selection state drives synchronized charts (video frame/annotation, dose voxel/organ, acoustic interval/channel).
- Provide responsive laptop, tablet and mobile-appropriate flows; scientific 3D editing can be desktop-first with graceful small-screen viewer.
- **DoD:** no broken map-like centering issues, no panel overflow, keyboard focus, reduced motion, readable units, meaningful loading/error/empty states.

### QA-01 — Release demonstration and provenance
- Local offline cold-start script, health/readiness page, no third-party live dependencies in jury path.
- `STATUS.md`: every feature status and real evidence; `PARITY.md`: upstream capability mapping and why blocked.
- Scientific numeric tests, openapi schema drift check, TS typecheck, browser test, accessibility, error-state screenshots, privacy/license checklist.
- **DoD:** a live reproducible scientific loop from source data → calculation → viewer → saved run → evidence report; ideally all three show genuine data, but never fabricate missing datasets or outputs.

## Suggested PR sequence
`PR-00 environment/provenance` → `PR-01 contracts/db` → `PR-02 OpenKBP parser/official cross-check` → `PR-03 DoseTwin scientific viewer` → `PR-04 Endoscapes annotations` → `PR-05 FiSaV acquisition/signal worker` → `PR-06 Model Lab jobs/replay` → `PR-07 educator/academy` → `PR-08 charts/UX/a11y` → `PR-09 offline demo/reports/validation`.

Parallelism: after `PR-01`, scientific modules can be developed independently behind agreed typed contracts. Merge through tested slices, not mutually incompatible branches.

## Reporting template for each work package
```text
PACKAGE: SCI-02
SOURCE: repo URL + pinned SHA + dataset/asset checksum
DONE: measured, demonstrably working feature
TEST: command, pass/fail, input type (synthetic/real)
UI: screenshot or browser test evidence
NOT DONE: exact remaining feature
BLOCKED: missing checkpoint/solver/license/dataset/hardware
PARITY: original capabilities preserved and next integration path
NEXT: smallest reversible development task
```

## Safety requirements
Research/education only. No patient-specific therapeutic prescriptions, no surgical safety clearance, no hemodialysis stenosis diagnosis, no invented medical efficacy. Strong distinction between benchmark/synthetic reference and clinically delivered dose. Commercial reuse must await license analysis of all source datasets/code/checkpoints. No external git push without explicit user authorization.
