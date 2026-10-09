# MEDFORGE v0.5 — Luna XHigh UI Implementation Work Packages

**Status: HANDOFF DRAFT / NOT AUTHORIZED TO BUILD YET.** Read all documents 00–15. This is an addition to `03_LUNA_XHIGH_IMPLEMENTATION_HANDOFF_DRAFT.md` and `08_LUNA_IMPLEMENTATION_SEQUENCE_AND_TEST_MATRIX.md`. Maintain feature parity with original research repositories without pretending unverified code is installed.

## Entry conditions

- User explicitly approves v1.0 architecture lock before the final build-all prompt.
- Verify runtime, licenses, dataset access, case formats and compute availability before integration promises.
- Review actual app code if exists; avoid destructive changes; existing features are preserved by default.
- Pin exact versions after Vite/React/TS compatibility spike (Trophy canonical URL, RGL v2 API, dnd-kit current API, Recharts 3 for shadcn current Base path).

## UX task graph

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| UX00 | Audit inherited documents, propose visual ADRs | none | Decision log with no conflict, routes mapped |
| UX01 | Create shared tokens/design components | UX00 | light/dark, accessible primitives, charts and origin badge |
| UX02 | Navigation shell + experience presets | UX01 | cases deep-link, sidebar, breadcrumbs, scoped role mode |
| UX03 | Typed case/artifact manifests and fake-free test fixtures | UX02 + backend contracts | all screen states render with type guards |
| UX04 | SurgiVision viewport + linked inspector and frame timeline | UX03 + source dataset | real frames/labels aligned; no invented video |
| UX05 | DoseTwin CT views + DVH + difference + 3D gate | UX03 + processed scientific artifacts | validated sample, ROI->DVH and voxel sync |
| UX06 | FistulaGuard signal/spectrogram sync + quality controls | UX03 + verified raw asset | correct time-domain features, units, playback if supported |
| UX07 | Shared analysis readiness, model catalog, job status UI | UX03 | unavailable models disabled with reason; genuine completed run visible |
| UX08 | Academy mission wrapper + restricted viewers + debrief | UX04/05/06 at least one complete | backend redaction and idempotent grade |
| UX09 | Educator builder preview + publish | UX08 | case version publishing, safe tool selection, keyboard reorder |
| UX10 | Cross-app polished UX and accessibility + jury demo | all current release slices | 1366x768 tested, stable routes, no mock science |

### Implementation order for 37-hour hackathon

Release target = UX01-UX03 + ONE fully finished vertical slice (likely DoseTwin after asset verification), smaller evidence-backed views for remaining engines, UX08 basic mission and selected UX09 if time. UX07 advanced models, training, optimization and full editor can remain on post-hackathon roadmap; never render an active-looking feature with no implementation. Do not silently downgrade all-three preservation policy: record scope as `planned` vs `implemented` per capability.

### PR sequence & responsibilities

- PR-A shared shell + tokens + routes + scientific origin/readiness components.
- PR-B/C/D parallel specialty workspaces against frozen v0.5 typed contracts, each with independent end-to-end sample.
- PR-E shared model lab/review/report integration.
- PR-F Academy mission using an actual case plus restricted source projection.
- PR-G Educator builder publishing; optional for demo but in target architecture.
- PR-H visual/keyboard/science test and reproducible demo package.

Assign one integrator to own contracts and CI; one developer per science module where a fourth exists. No direct module-to-module data import. Changes to shared types require contract validation and tests across all three modules.

## Required deliverables with each PR

A feature-parity ledger row with source commit and status; screencast/screenshot at 1366x768; keyboard navigation and reduced-motion test; scientific numeric/annotation test; worker capability/readiness printout; docs update; evidence of real dataset source and license; changelog entry; known blockers and impact; accessible empty/error states.

## Anti-hallucination and safety gate

- All datasets real and source-linked or explicitly `teaching_simulation`. Never backfill missing FiSaV raw signals with simulated medical evidence without label.
- SurgiVision must distinguish expert CVS labels from actual model inference.
- DoseTwin must distinguish archived predictions from deliverable radiotherapy plans and report numerical differences without treatment recommendations.
- Student UI must not leak hidden references in API payloads.
- Medical user roles do not imply a validated clinical application; professional use is research/review only.

## Presentation storyline (only if assets verified)

**0:00** Home -> student Academy selects an authentic case. **1:00** Student explores scientific viewer, submits evidence-based observation, gets authentic comparison after reveal. **2:15** Professional switch via granted review mode opens same case and full provenance. **3:00** DoseTwin or SurgiVision deeper quantitative analysis. **4:00** Third module authentic artifact explorer. **4:40** Evidence report/Experiment Center. Keep fallback demo story if FistulaGuard recordings unavailable, plainly explain blocker.

## Review gate before v1.0 lock

Open decisions: frontend/chart npm version probe; Cornerstone/OpenKBP adapter feasibility; FiSaV raw access/license; CVS checkpoint execution GPU/CPU; final case IDs and licenses; reviewer for clinical teaching content; UX contrast/role usability on demo laptop; exact minimum MVP slice. Once verified, convert recommended ADRs into user-approved LOCKED choices and update `09_OPEN_DECISIONS_AND_LOCK_CHECKLIST.md`. Until then no agent should claim final full implementation is ready.
