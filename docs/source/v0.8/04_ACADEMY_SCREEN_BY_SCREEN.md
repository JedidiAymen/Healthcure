# 04 — MEDFORGE Student Academy: screen-by-screen product specification

**Status:** DRAFT FOR DISCUSSION, not architecture locked. **Date:** 2026-10-09. **Inherits:** 00–03 from v0.3. **Target implementer:** Luna XHigh.

## Invariants

1. Student Academy is a **guided consumer of the same scientific evidence engine** used by Professional Studio. Never fork the scientific data, calculations, or inference into gamified copies.
2. Three first-class specialties must remain available: SurgiVision (surgical anatomy and safety evidence), DoseTwin (dose and anatomy), and FistulaGuard (vascular-access sound/vibration research).
3. No diagnosis, treatment plan recommendation, clinical certification, or invented 'medical accuracy' achievement. This is research-based education, not clinical decision support.
4. No server response before submission may include a hidden reference label, answer key, unreleased expert mark, or evaluation rule that directly reveals the answer.
5. A published challenge is immutable. Students are pinned to the exact version that they started; instructors edit a new draft version.
6. Every evidence overlay is visibly classified as `raw`, `expert_reference`, `model_prediction`, `computed`, or `synthetic_teaching`. Missing/unknown provenance is an explicit blocking error.
7. Critical clinical content and rubrics require an authorized reviewer and a review date. Work with anonymized research material only, subject to licensing.
8. A mission can be completed without XP/streaks; scientific learning objectives and feedback are primary.

## Academy navigation architecture

- `/academy`: homepage with Resume mission, 3 department cards, assigned activities, latest earned *educational* badge and progress.
- `/academy/paths`: complete learning catalog; filter module, difficulty, duration, topic, assessment type, availability of real asset.
- `/academy/paths/:pathId`: syllabus with `not_started | available | in_progress | completed | requires_review | unavailable`, prerequisites, learning outcomes and detailed dataset provenance.
- `/academy/challenges/:challengeId`: challenge player. Routes preserve `?attempt={id}` on refresh; actual state from API, not URL.
- `/academy/progress`: history of evidence skills, rubric dimensions, instructor feedback, attempts, accessible export.
- `/academy/achievements`: cosmetic activity achievements; no claims of clinician competence.
- `/academy/assignments`: assigned and submitted activities with due-date policy (no timer by default).
- `/academy/settings`: reduced motion, audio playback prefs, accessibility options, visual themes.

## S-01 Academy home

**Desktop layout:** 72px collapsible left rail (Academy, Paths, Assignments, Progress), top header (current role and active course), central 2-column hero (Resume + current pathway), bottom specialty selection cards, recent feedback.

**Actions:** `Continue latest attempt` resolves server state; `Explore specialty` filters paths; `View feedback` opens a graded attempt; `Open assignment` starts only after admission/eligibility checks.

**States:** never enrolled -> clear browse CTA; enrolled no progress -> recommended introductory case; attempt incomplete -> Resume; case asset unavailable -> explanation and alternative; offline -> read-only cached non-sensitive content, no fake completed results.

**Responsive:** tablet stacks cards; mobile allows browse, text questions, and review, but 3D/detailed scientific annotation exercises display 'requires desktop' when precise interaction is essential.

## S-02 Specialty & learning path

Path object `PathVersion`: slug, title, department, learning outcomes, difficulty, estimated duration, author/reviewer, curriculum metadata, ordered challenge version refs, prerequisite rules, evaluation policy. `estimatedDuration` is editorial content, not asserted live ETA.

Three illustrated departments, not a fake real-hospital patient episode:

- Surgery Lab: recognize what a laparoscopic frame does/does not show, segment/identify structures, distinguish expert reference from model output; CVS requires multi-evidence review.
- Radiation Physics Lab: interpret anatomical 3D spatial distributions, dose units, DVH, reference-vs-model comparison. Predicted dose is not a deliverable plan.
- Biomedical Signal Lab: select recording channel/time interval, spectral features, artifact/noise QC; research labels are not a clinical diagnosis.

**Interaction:** selecting a lesson shows case type, available scientific actions, skills trained and what its data source is. Must not show expert labels as decoration in path cards before assessment.

## S-03 Mission introduction

Display: problem statement, learning outcomes, available interactions, attribution and data license note, whether source asset is complete video/sampled frames/archived dose/research recording, accessible instruction, review method, default non-timed setting, 'Start Investigation'.

**System:** `POST /academy/challenges/:id/attempts` pins `challengeVersion`, creates random attempt ID and returns `StudentAttemptManifest` stripped of hidden answer artifacts. Idempotency key avoids duplicate starts on slow clicks.

## S-04 Investigation player

**Layout:** scientific viewer 65-75% of available content width; question/observations panel 25-35%; top mini-progress and task title; bottom filmstrip/voxel navigation/signal brush appropriate to modality. Side panel collapses. Keyboard focus returns to affected viewport after changing tools. Reset view is always available.

**Reuse, not fork:** renders `SurgiVisionViewer`, `DoseTwinViewer`, or `FistulaGuardViewer` with `viewerMode='guided'` and a server-issued `CapabilityGrant` containing allowed tools, time/case bounds, annotation restrictions and allowed data assets.

**Allowed observation inputs** (typed by modality):
- Surgery: selectable frame ID, bbox/polygon/reference-point annotation in frame-pixel or normalized coordinates; label and evidence confidence; 'insufficient evidence'.
- Dose: dose plan ID, voxel index triplet and validated frame metadata, ROI identifier, numeric Gy, DVH selected statistic, optional uncertainty text.
- Acoustic: channel ID, segment start/end samples or seconds with sample rate, observed clipping/noise/missing-data condition, signal feature metric with units.

**Autosave:** debounce non-sensitive draft observation to `PATCH .../attempts/:id` with optimistic UI and recoverable errors; store authoritative timestamps server-side. Do not send the answer key to the browser.

**Scientific UX:** separate display-only overlays from physical calculations; brush/window changes recalculate relevant features; every calculated quantity has name, unit, and artifact provenance.

## S-05 Commit answer

`Review your observations` modal with selected evidence artifact(s), confidence or `cannot determine` option, numerical unit check, and irreversible submission warning when one attempt allowed.

`POST /academy/attempts/:id/submit`: uses `If-Match: version` or server attempt revision and `Idempotency-Key`; server validates required questions, allowed tools, valid coordinates/time intervals, artifact authorization and immutable challenge version. Locks submitted answers atomically. Return accepted state and permitted next step, NOT reference solution if release policy is pending.

Possible transitions: `draft -> submitted -> auto_graded | needs_instructor_review -> released`. A `released` attempt cannot be reverted to `draft`.

## S-06 Reveal & debrief

After permitted reveal, show three tabs, consistently ordered:

1. **Your observation:** submitted coordinates/metrics/explanation captured verbatim.
2. **Reference evidence:** source annotation/verified metric **with source, version and coverage**. If no reliable reference, mark 'not automatically gradable'.
3. **Model evidence (optional):** *actual, named* model checkpoint/run and outputs; distinguish it from expert reference. If missing, indicate unavailable instead of drawing a convincing fake overlay.

Show `Supported`, `Needs review`, `Insufficient reference` labels; do not overstate correctness from a single image or one waveform. Instructor messages appear in separate reviewed feedback.

## S-07 Results, XP and progress

- **Scientific result**: rubric dimension breakdown, explanatory feedback and reviewer state; may be incomplete pending manual review.
- **Cosmetic game state**: optional XP, path completion, achievements. XP is only derived from confirmed unique events (`attempt.graded`, `assignment.reviewed`), not clicks or refreshes.
- **Progress chart**: based on completed rubric-assessed tasks; avoid health-like success percentages.
- **Achievements**: `First Investigation`, `Signal Quality Detective`, `Geometry Guardian`, `Evidence Skeptic`. Labels describe activities, not qualification.
- **Leaderboard**: OFF by default, optional within a consented course cohort, pseudonymous names; never public patient-related data or rank by patient outcomes.
- **Streaks**: optional and removable; no loss of learning access if broken.
- **Review**: score awaiting human review clearly marked; corrections carry version and audit entry, XP reconciled without double-awarding.

## Three prototype missions with exact outputs

| Mission | Data requirement | Student scientific task | Reference | Grading treatment | Demonstration moment |
|---|---|---|---|---|---|
| M-SURG-001, `Locate the evidence` | licensed Endoscapes frame with available bbox/mask | click or draw region; choose anatomy class; state when unseen | expert bbox/mask at same frame | IoU/point-distance + separately reviewed reasoning; cannot infer whole-procedure CVS | toggle raw/reference/real AI output only after answer |
| M-DOSE-001, `Inspect two models` | same case's aligned reference + two OpenKBP-Opt predictions with verified dose unit | select ROI, pick absolute-dose-difference location and read numerical DVH | independently computed within-ROI differences | coordinate tolerance defined in voxel or mm; numeric Gy tolerance; explanation requires review | selecting discrepancy flies to corresponding CT slice and organ |
| M-ACOUSTIC-001, `Quality gate` | genuine permitted signal or **clearly marked synthetic-only** signal | select channel/time, identify clipped/noisy section and inspect FFT | engineered perturbation metadata + reproducible signal QC method | objective QC flags + explanation review; no medical stenosis diagnosis grading | changing channel changes waveform and spectrogram |

## Interaction and accessibility requirements

- Keyboard-only navigation: select dataset, start challenge, navigate viewer using provided shortcuts, submit and review without requiring drag gestures; alternative coordinates/numeric inputs when needed.
- Audio has waveform caption/description and play controls; mute is default for Academy home; no autoplay.
- Color-independent legends and text labels for surgical structure/dose/signal warnings; scientific dose colorbars always display Gy or verified unit.
- No flashing feedback; respects reduced motion and no pressure countdown by default.
- Every unavailable model/data has honest disabled/help state and optional alternative task.

## Student E2E tests (minimum)

1. Hidden reference ID **and content** not in pre-submit JSON, WebSocket/SSE, HTML source or unprotected asset URLs; guessed artifact ID yields 403.
2. Refresh/resume preserves attempt version, selected data and draft, without revealing answer.
3. Double click `Submit`/network retries -> exactly one submitted attempt/grade/XP event.
4. Surg frame annotation stored in correct frame coordinate space after zoom/pan.
5. Dose annotation uses correct voxel/case/plan and units; no cross-case mismatch.
6. Audio brush stores correct interval given channel sample rate; altered sample rate rejected.
7. Results are source-attributed; missing prediction shows unavailable.
8. Ambiguous written explanation flagged for human review, no unsupported automatic clinical grade.
9. User with student role cannot call advanced training/optimization endpoints.
10. Keyboard/reduced-motion path can complete all three test missions.

## Adoption references

- Trophy shadcn-based *presentation components only*: https://ui.trophy.so/docs — use a local backend for actual XP authority.
- H5P Branching Scenario design reference: https://h5p.org/branching-scenario — NOT the preferred runtime for high-resolution scientific viewers.
- NHS health content standards: https://service-manual.nhs.uk/content/standard-for-creating-health-content — content review, accessible user needs, versioning.
- 1EdTech LTI Advantage long-term integration: https://www.1edtech.org/standards/lti/suggested-lti-advantage-requirements-rfps
