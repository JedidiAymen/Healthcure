# 05 — MEDFORGE Educator Studio: authoring, publishing, grading

**Status:** DRAFT v0.4, to be locked after prototype review. **Scope:** build validated interactive training from real research data; not a clinical content publishing license.

## Information architecture

| Screen | Route | Role | Purpose |
|---|---|---|---|
| E-01 Educator home | `/educator` | educator | courses, recent drafts, published cases and reviews |
| E-02 Evidence library | `/educator/evidence` | educator | search eligible cases by module, label coverage, data rights, artifact status |
| E-03 Case builder | `/educator/builder/:draftId` | educator | staged authoring, live viewer preview, block reordering |
| E-04 Rubric editor | `/educator/builder/:draftId/rubric` | educator/reviewer | explicit measurable scoring and ambiguity policy |
| E-05 Student preview | `/educator/builder/:draftId/preview` | educator | exercise student redacted manifest end-to-end |
| E-06 Publish review | `/educator/builder/:draftId/release` | educator + approver | safety, scientific, legal, accessibility and answer-leak checks |
| E-07 Assignments | `/educator/assignments` | educator | class/cohort launches, due dates and policies |
| E-08 Attempt review | `/educator/assignments/:id/review` | educator/reviewer | manual feedback, score adjustment with audit |
| E-09 Analytics | `/educator/analytics` | educator | counts, rubric dimensions, item quality, attrition, no performance diagnosis |

## E-01 Educator home

Top area: `New from research case`, `Continue draft`, `Review submissions`. Table: title, module, source dataset, version, clinical content approval state, publication state, assigned cohort, submissions needing review. Error state if source rights expire.

## E-02 Evidence library

Filters: module, modality, dataset/source version, license (`usable_for_training` evaluated by explicit policy), raw/annotations/prediction availability, expert-reviewed reference, case split, processing readiness. A large `source badge` distinguishes archived model prediction from expert annotation.

**Selection workflow:** educator chooses eligible `EvidenceCase` + permitted `ArtifactReference` objects. The builder stores immutable source IDs and hashes; NOT copied medical pixels in the lesson JSON. If source lacks sufficient reference labels, only manual-review question types are permissible. Publication cannot silently replace assets.

## E-03 Builder (progressive stepper, not unbounded node graph)

**Step A: Learning intent** — title, target audience (medical student, biomedical engineer, trainee), specialty, prerequisites, learning objectives, accessible explanation, clinical content reviewer field.

**Step B: Choose evidence** — select one module/case; show license, source partition, permitted redistribution, available frame/volume/signal, and ground-truth coverage. Allow saved 'Evidence snapshot' (fixed frame, region, ROI or signal window) by **typed selection**.

**Step C: Add learning blocks** — drag blocks in an ordered vertical list with drag handle and explicit move-up/move-down keyboard controls. Block palette:

- `intro_text` (safe rich text), `evidence_viewer` (one of three specialized live scientific viewers), `observation` (click region, voxel, time interval), `numeric_measurement` (unit + tolerance), `single_choice` / `multi_choice` (only for pedagogically unambiguous observations), `confidence_reasoning` (cannot determine/insufficient evidence), `explanation` (text), `evidence_reveal` (guarded by release policy), `review_summary`.
- Prohibit arbitrary executable JavaScript or external embeds in first version. Sanitize rich text; whitelist asset domains; media is always fetched by authorized manifest.

**Step D: Tool permissions** — choose allowed tools and evidence layers from server-verified `CapabilityManifest`: zoom, pan, frame navigation; slice, ROI, dose difference, DVH; waveform, audio, spectrogram, segment brush; never enable unsupported controls.

**Step E: Define responses + scoring** — type-specific reference handling, scoring tolerance and rubric. Objective metrics are derived from source artifacts by server algorithms; ambiguous text is manual review. No LLM autograding for clinically sensitive questions in MVP.

**Step F: Preview / validation / publish** — role-simulated preview requests **the actual student endpoint** and must demonstrate absence of hidden answers. Preview initial/complete/error states, mobile restriction, keyboard and reduced motion.

## Builder UX layout

Desktop: three columns: left palette (220px), center ordered lesson canvas (min 55%), right properties inspector (320px). Sticky breadcrumbs, `Draft saved` state, Publish requires review. Viewer block can enter full-screen preview; exit returns to same builder block and scroll position.

For compact screens, collapse left palette and right inspector; builder itself can be desktop-only, but published lesson reader remains responsive. Don't create giant decorative cards that compromise 3D/scientific precision.

## Version / state model

```
DRAFT -> READY_FOR_REVIEW -> APPROVED -> PUBLISHED -> RETIRED
           |                  ^
           v                  |
     CHANGES_REQUESTED -------+
```

Editing published v1 creates v2 DRAFT. Immutable published v1 remains addressable for past attempts and grading reproducibility. Revoked/unlicensed source means content can be archived or disabled with explanatory state; do not silently substitute case data for live attempts.

Clinical content reviewer, author and publisher can be same person for local prototype **only if openly labeled unreviewed**; for public medical education require separate approval workflow and date in metadata. Source-specific permissions and license review before publication.

## Rubric builder

Rubric dimension: `id`, `weight`, `scorer` (`deterministic`, `manual`), `criterion`, `failure_feedback`, `success_feedback`, `required_artifacts`, `reference_artifact_id` (server-private), `tolerance`, `unit`, `evidence_policy`.

Validation:
- Weights total 100 or 1.0; no negative, NaN or floating precision ambiguity.
- Each objective criterion has a deterministic grading strategy + reference coverage + coordinates/units.
- If `manual` criterion, it cannot be marked fully graded before a reviewer acts.
- No rubric accepts a 'diagnosis' as an automatic truth from experimental AI output.
- Source annotations may contain annotator disagreement; represent uncertainty not majority as absolute truth.
- Dose predictions vs actual clinical safety distinction appears in teacher notes and student reveal.

Rubric templates:
- Surgical localization: localization 45, label 25, cited visual evidence 15 (manual), acknowledges visibility limits 15 (manual).
- Dose difference: coordinate/ROI 35, correct Gy 30, DVH interpretation 20 (manual), distinction prediction vs plan 15 (manual).
- Acoustic quality: identifies recording issue 40, affected channel/interval 30, appropriate quality response 20, explanation 10 (manual).

Weights are DESIGN STARTERS only, require domain-expert approval before external use.

## Preview security contract

Preview is never implemented by passing educator JWT to student component. Instead, use `POST /educator/drafts/:id/preview-session`, which generates a limited `student_preview` grant with redacted manifests. The server uses the same serializer and permission path as production student attempts. Educator properties inspector must not leak answers into preview via props/store or devtools.

## Publish pipeline and failure cases

`POST /educator/drafts/:id/validate` returns `errors`, `warnings`, `reviewRequired`, `capabilityCompatibility`.

Block publication for: inaccessible license, non-existent data, hash mismatch, missing label for auto grading, impossible coordinate frame, unsupported model, answer leak, absent clinical content approval for public content, inconsistent rubric, reviewer not authorized, unsanitized HTML, or wrong case/split pairing.

Publish snapshots draft + upstream dataset commit/version + reference artifacts + capability manifest version + rubric + release policy. Sign or hash immutable publication manifest for tamper evidence.

## E-07 Assignment builder

Create cohort, assign one immutable challenge version, specify due date/timezone and attempt/reveal policy. Future classroom role auth and LMS integration; no operational multi-user auth required for local hackathon demo, but enforce permission boundaries in the demo server.

## E-08 Grading queue

Tabs: `Needs review`, `Reviewed`, `Revision requested`, `Source invalidated`. For each attempt show student pseudonym, submitted observations, original research evidence, expected reference, evaluator output, editable qualitative feedback. Store reviewer ID/time and prior grade; rerubricing published version cannot rewrite old scientific reference automatically.

No grade passback to Moodle/Open edX in hackathon. Later, LTI 1.3 + LTI Advantage Assignment and Grade Services (AGS), Deep Linking, NRPS are proposed integration surfaces; cryptographic launch/auth must be implemented fully rather than mocked.

## MVP versus full roadmap

**Hackathon P0/P1:** one educator curates an existing eligible case, edits title/instructions and one typed question, chooses tool permissions, validates reference policy, previews as student, publishes local immutable version, runs a complete student attempt and views grading result. Prefer seed instructor-approved templates for each specialty if time is constrained.

**P2:** full block editor, sortable sections, rubric editor with multiple dimensions, assignment list, pseudonymous learners and reviewer queue.

**P3:** branching scenarios via React Flow with cycle checks and branch validation; cohort management, institution SSO, LMS/LTI, localization, collaborative editing, long-term review cycles.

## Acceptance suite for Luna

- Educator can choose a genuine source case and sees licence/case availability before editing.
- Builder refuses to publish an objective numeric question if reference units or geometry are absent.
- Reordering blocks via keyboard yields identical saved order to drag-and-drop.
- Student-preview endpoint never reveals answer keys before submission.
- v1 remains immutable after author edits v2; past results bind to v1.
- Source model label `computed` vs `expert_reference` distinct in author and student UI.
- Draft save is idempotent, optimistic UI reconciles server conflict, undo/redo only changes draft.
- Reviewer correction emits append-only audit event; prior grade preserved.
- Source access denied means explicit unavailable state, never mock source data.

## Reusable libraries

- dnd-kit: https://dndkit.com/react/guides/sensors/ — keyboard + pointer sortable blocks; don't conflate with scientific panel drag/resizing.
- React Flow (future branching): https://reactflow.dev/examples/interaction/validation and https://reactflow.dev/examples/interaction/prevent-cycles
- H5P Branching Scenario as authoring inspiration: https://h5p.org/branching-scenario
- 1EdTech LTI standards: https://standards.1edtech.org/lti/guides/implementation_guide/implementation-guide
- NHS clinical content editorial review: https://service-manual.nhs.uk/content/standard-for-creating-health-content
