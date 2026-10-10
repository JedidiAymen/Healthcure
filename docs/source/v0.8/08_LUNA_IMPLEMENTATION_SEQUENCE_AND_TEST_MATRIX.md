# 08 — Luna XHigh: actionable development sequence, vertical slices and test matrix

**Status:** DRAFT v0.4. **Do not implement until the user locks MEDFORGE architecture.** This supplements `03_LUNA_XHIGH_IMPLEMENTATION_HANDOFF_DRAFT.md` and does not replace it.

## Mandatory implementation philosophy

- Do not reinterpret agreed module scope, remove source research capabilities, or invent unsupported scientific features to make the demo look complete.
- Prioritize real runnable vertical slices over static cards or marketing pages.
- 'All features' refers to **long-term capability preservation** and honest setup statuses, not guaranteed execution of every GPU/solver experiment on day one.
- Document upstream provenance, pin commits, check license, and perform source-parity validation.
- Do not silently convert raw research annotation into AI inference or a synthetic teaching fixture into actual patient data.
- Do not replace existing work in repo without reviewing changes; use Git commits/branches and record progress in `docs/implementation-status.md`.

## Feature freeze / acceptance definitions

P0 = full platform shell, typed research cases, three honest usable scientific viewers, one curated authentic dataset artifact per module **if legally accessible**.

P1 = at least one meaningful calculation or annotation comparison for each module, educator publishes one real guided lesson, student completes it and receives traceable answer reveal; case provenance and job status functional.

P2 = robust authoring, grades/reviews, metrics/analytics, model registry/job runner, saved evidence reports and role security hardening.

P3 = all original upstream model training/evaluation and PortPy/OpenKBP-Opt optimization runtimes, multiuser infrastructure, advanced LMS/EHR integrations.

**Never mark P0 or P1 green if it relies on fake numeric results, nonexistent weights or private/unavailable datasets.**

## Dependency graph

```
S0 Audit licenses, data and checkpoint access + machine capabilities
 |
S1 Monorepo + typed cases + asset URLs + source fixtures + design tokens
 |
S2 Viewer components x3 + scientific units & transforms
 |                         
S3 Capability registry + case adapters + tested calculations
 |
S4 Educator selects source and publishes immutable learning case
 |
S5 Student receives restricted viewer grant + commits answer
 |
S6 Real debrief + grade event + progress projection
 |
S7 Professional reuse + selected models/experiments + reports
 |
S8 Scientific QA, UX/accessibility QA, offline demo pack and record final blocker statuses
```

### S0: source and environment audit

1. Inspect `references` and README/license of Endoscapes, CVS-AdaptNet, SurgLatentGraph, OpenKBP, OpenKBP-Opt, PortPy, FiSaV.
2. Create `docs/upstream-catalog.csv`: repo URL, commit sha, license, dependencies, training/inference/checkpoint status, dataset availability, legal reuse, required device.
3. Verify actual local assets and checksums; don't trust README download links as successful transfers.
4. Evaluate available CPU/GPU memory, free disk and internet reliability. Report supported executable inference jobs.
5. Produce `docs/risks-and-blockers.md` with reproducible commands and observed outputs.

### S1: contracts and API foundations

1. Create monorepo as agreed in baseline; initialize web and FastAPI only once.
2. Define discriminated `EvidenceCase` and `ScientificArtifact` schemas with scientific metadata validation; API generates OpenAPI and TS types.
3. Implement server-only asset authorization and source provenance; loader IDs with content hashes.
4. Seed three *real* cases only after successful asset import, with explicit source artifact and license metadata.
5. Add 4 UI shells `/academy`, `/studio`, `/educator`, `/models/experiments`; role-specific access at backend.
6. Add status representations `ready`, `requires_setup`, `unverified`, `blocked`; do not treat all as available.

### S2: three scientific viewer vertical slices

**SurgiVision**: scientific frame + independent box/mask layers, opacity and class toggles, zoom/pan with original-coordinate transform, frame-ID access, source coverage, truth-vs-model provenance. Use Endoscapes and upstream models only after compatibility tested.

**DoseTwin**: OpenKBP sparse loader, CT/structure/dose reconstruction, matched plan validation, synced slices, DVH and dose difference with known Gy and voxel geometry, selectable organ, preprocessed 3D meshes if time allows. Compare code outputs with upstream functions and independent synthetic-array tests.

**FistulaGuard**: real approved research waveform if accessible; if not available, expose explicitly synthetic demonstration while keeping module `source data blocked`, and document that P0 real-asset requirement is not fulfilled. FFT/spectrogram/QC from actual selected interval; correct channel and sample rate. Separate acoustic sound and vibration semantics; never claim phone clinical diagnosis.

### S3: integration adapters and Model Lab

- Define `ScientificAdapter`: capability manifest, compatibility check, execute, output artifact/provenance.
- Implement first real calculations locally: dose difference/DVH, signal FFT/QC, surgical expert annotation overlay.
- Run CVS or surgical model only when weights and environment actually work; ensure `.cuda()` compatibility and pinned PyTorch stack.
- Keep PortPy/OpenKBP-Opt optimization in a separate worker after solver access; display setup-gated capability in catalog.
- Use immutable run records; only `completed` status with validated artifacts.

### S4: educator local authoring

1. Choose one available case from source registry.
2. Configure title, learning objective, instructional description and a server-verified permitted tool list.
3. Add one typed observation block and rubric; block authoring uses dnd-kit **only if reordering multiple blocks is in scope**.
4. Validate original dataset license, reference coverage, question constraints and answer visibility.
5. Publish `v1` immutable manifest; editor changes produce v2 draft.
6. Preview student mode via actual student-redacted projection, not props from educator state.

### S5: Student Academy runner

1. Home -> specialty -> mission intro -> restricted scientific viewer.
2. Start persisted attempt with stable `attemptId`; server issues short-lived capability projection.
3. Student selects evidence region/voxel/time and writes observation; submission validated in original coordinate system.
4. Submit once, saved atomically; server computes objective dimension and flags manual evaluation.
5. Reveal reference only per immutable policy; preserve all origin labels and source links.
6. Render optional Trophy UI XP *only* from finalized events. Do not add a public leaderboard in MVP.

### S6: grading & educator review

- Write append-only grade events, manual dimension pending state and reviewer UI.
- Idempotency tests for submit/grade/reward.
- Demonstrate one completed attempt including reference debrief and a traceable rubric.

### S7: professional reuse

- Open same case in Professional Studio without gamification and with authorized full evidence options.
- Show data provenance, actual output interpretation, and experimental job history.
- Add PDF/Markdown export ONLY if generation is reliable; a simple Markdown/JSON research summary with real figures is acceptable for MVP.

### S8: polish and QA

- Run unit, API contract and Playwright E2E tests; record commands and results, do not just say 'tests passed'.
- Test keyboard/no mouse for Academy/authoring, reduced motion and chart legend accessibility.
- Test desktop 1366x768 minimum usable scientific layout; mobile read-only fallback.
- Switch modules repeatedly, change roles, reload attempts, compare assets; no stale cross-case data.
- Offline demo preflight: actual datasets loaded locally, no runtime CDNs/third-party API dependence, no unresolved source links in the actual demo.

## Proposed pull request / branch boundaries

`feat/platform-contracts` -> merges first; `feat/surgivision` `feat/dosetwin` `feat/fistulaguard` branch from confirmed contracts; `feat/educator-builder` and `feat/academy` branch after working grants/manifest; `feat/model-lab`; `feat/reporting`; `chore/integration-tests`. No force-rewrite of other's branches.

## Definition of Done per vertical slice

| Domain | Functional test | Science/provenance test | Failure test |
|---|---|---|---|
| Surgery | open real frame, toggle real mask, click region | original frame geometry and label source match | missing frame/label visible and harmless |
| Dose | open CT, select ROI, view DVH, compare real dose arrays | accepted numeric result matches upstream/reference oracle within tolerance | mismatched geometry blocks subtraction |
| Acoustic | open real signal, brush interval, recalc FFT | sample rate, channel and segment verified | clipping/empty/missing channel flagged |
| Educator | author+publish immutable case, preview | source license/reference coverage acknowledged | wrong rubric/hidden answer fails publish |
| Student | resume/submit/debrief existing case | reference only after authorized submission | guessed reference URL 403, submit retry idempotent |
| Professional | open same case full evidence | same shared scientific algorithm output | unauthorized model exec blocked |
| Model Lab | list status, run one ready tool | runner stores input model version + output hash | missing checkpoint shows setup state |
| Reports | export one legitimate source-based report | source/calc/version cited in export | unavailable result cannot be exported as completed |

## Optional infrastructure (only add with trigger)

| Tool | Trigger | Not before |
|---|---|---|
| PostgreSQL | multiuser transactional scale | SQLite insufficient |
| MinIO | large shared asset storage | local file backend proven |
| Celery/RQ/Redis | long-running concurrent/remote scientific jobs | one local runner insufficient |
| MLflow | multiple reproducible model-training runs | actual training/eval works |
| Full Cornerstone3D/OHIF | real DICOM-compatible imaging need | OpenKBP static slices sufficient |
| React Flow | educator branching lessons | linear lesson builder works |
| LTI 1.3 | actual university LMS integration | auth/grading core stable |
| FHIR/Medplum | authorized patient care system interoperability | actual clinical validation and privacy program |

## Luna reporting contract

After every meaningful work package, commit and update:

```
Module: SurgiVision / DoseTwin / FistulaGuard / Academy / Educator / Core
Feature: ...
Source: repo/path@commit or newly implemented code
Status: implemented / integrated / setup_required / blocked / unverified
Test command and observed result: ...
Scientific validation artifact: ...
Limitations: ...
Next dependent task: ...
```

Do not mark feature complete without working UI + backend data flow + test. Provide a `RUN_LOCAL.md` containing exact reproducible setup commands, dataset acquisition instructions and offline jury-demo command. Update blockers rather than silently dropping features.

## Final agent instruction (NOT YET AUTHORIZED TO RUN)

> Read docs 00–09 in order. Confirm latest explicitly locked decisions. Preserve SurgiVision, DoseTwin and FistulaGuard as independently functioning research modules. Follow S0–S8 dependencies and source-audit gates. Avoid fabricating predictions, data, scientific results, patient diagnoses or unsupported success statuses. Implement real vertical slices, test each against upstream or independently verified numerical references, and maintain a feature-parity register with honest blocked/setup states. Prioritize working scientific viewers and the evidence-to-learning flow before animations, dashboards or infrastructure complexity. After each stage, write reproducible tests and a status report. Do not assume every published research model runs on CPU or that downloadable source datasets have been obtained.

This is intentionally a **planning prompt**, not a command to start coding until architecture approval.
