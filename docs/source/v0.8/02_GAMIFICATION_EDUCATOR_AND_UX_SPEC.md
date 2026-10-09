# MEDFORGE — student gamification, educator authoring and professional UX

**Status:** proposed product specification (not yet locked). **Date:** 2026-10-09. This file is intentionally detailed enough to become actionable for Luna XHigh after sign-off.

## Product principle

**Same research evidence, different journeys.** A student explores a constrained, guided version of the genuine scientific viewer with questions, sequential reveal and learning progress. A professional or medical educator gets authentic measurements and tools, without scores/XP/game effects. A researcher can activate advanced model and experiment controls. Authorization is SERVER-ENFORCED; mode switch is presentation-only.

The primary educational skill is critical evidence review: observation, uncertainty identification, comparison against an expert reference or validated numerical result and reflection. It is NOT learning to diagnose patients using unvalidated algorithms.

## Experience map and exact screens

### S-01 Academy Home `/academy`
- Header: resume current path, my progress, available specialties; no patient-identifying information or invented success percentages.
- Three specialty cards with genuine small example illustrations or institution-cleared dataset imagery.
- Hero CTA: `Continue lesson` or `Explore learning paths`, NOT `Start diagnosing`.
- Missions list: title, expected time (author-estimated, not a promise of clinical competence), difficulty, prerequisites, last attempt and status.
- Gamification: XP summary (only educational), skill mastery indications linked to rubric, achievement list, optional classroom leaderboard off by default.
- Empty state: first learning path accessible without account for local demo.
- Accessibility: meaningful keyboard navigation, readable text, reduced motion, no essential information delivered only via color.

### S-02 Learning Path `/academy/paths/:id`
- Course map as ordinary cards/stepper first; interactive node map with React Flow is optional later.
- Three paths: Surgical Evidence / Radiation Physics / Physiological Signals.
- Each path has prerequisites, learning outcomes, case source attribution and domain limitation notice.
- Per challenge: `not started`, `in progress`, `submitted`, `reviewed`.
- Completion gate: one configured rubric and explicit submission; don't gate on time spent on page.

### S-03 Challenge Intro `/academy/challenges/:id` phase `intro`
- Visible: mission narrative, learning objectives, task instructions, input modality, allowed tools, reference source and safety caveat.
- Hidden until submit: ground-truth annotations/answers and any configured AI outputs.
- Example: “Determine whether this frame contains enough visible information to evaluate this CVS criterion.” Not: “Approve this surgery.”
- CTA starts attempt with immutable challenge/version snapshot; can restart only according to instructor rule.

### S-04 Investigation `/academy/challenges/:id` phase `inspect`
- Reuse the SAME SurgiVision/DoseTwin/FistulaGuard scientific viewer components as Studio.
- Student-specific toolbar is scoped to `challenge.allowedTools` (e.g., magnify, marker, time selection, ROI selection, DVH view, audio play).
- Viewer provenance panel remains available where disclosure does not leak the answer; model and reference layers can be withheld until reveal.
- Evidence notebook to collect observed features, numeric readings, selected frames/voxels/timestamps and uncertainty notes.
- Scientific interactions produce grounded structured observations; coordinates are validated against source asset geometry.
- Persistent Attempt Draft: save progress, handle refresh, accessible keyboard alternative for graphical selection.

### S-05 Commit Answer `/academy/challenges/:id` phase `submit`
- Rubric-specific question formats: multiple choice, numeric answer with units+tolerance, localization (frame/ROI, voxel grid or time interval), ranking, short explanation, “insufficient evidence”.
- Require explanation where defined by rubric. Differentiate `I don't know` and `insufficient evidence`.
- Confirm before final submit; server validates challenge version, attempts limit and permitted fields; submission is idempotent.
- No model/reference data returned before commit.

### S-06 Reveal & Debrief `/academy/challenges/:id` phase `review`
- After submit show student's selection alongside curated reference, original data, and optional separately identified pretrained-model output.
- Each rubric dimension reports earned points and why: observation, calculation, reasoning/justification, appropriate uncertainty, evidence traceability.
- Where no objective ground truth exists, educator review is required; avoid pretending to grade free-text clinically with an unchecked LLM.
- Deep link `Open in Evidence Viewer` with submitted selection mirrored.
- Feedback focuses on explanation and review sources, not judging personal worth. Accessible reduced-motion celebration only for meaningful educational milestones.

### S-07 Results & Progress `/academy/progress`
- Show attempts, mastery-by-skill, completed pathways, rubric dimension over time and next recommended activity.
- Optional classroom standings use aliases/opt-in, not student medical/personal attributes. Private default.
- Export educational participation record, never `certified to practice medicine`.

### E-01 Educator Library `/educator/cases`
- Filter case source, modality, license, available annotations, suitable learning level and provenance completeness.
- Button `Use this evidence in a new challenge` opens immutable reference to approved source artifact; do not duplicate raw third-party media unless license permits.
- Edit/save/version/duplicate/archive; published challenges cannot silently change under a student's submitted attempt.

### E-02 Builder `/educator/builder/:draftId`
- Steps: `Select evidence` > `Specify objectives` > `Arrange blocks` > `Choose tools to expose` > `Author answer/rubric` > `Preview Student/Instructor` > `Publish`.
- Drag-and-drop blocks using dnd-kit: Text instruction, Evidence viewer, Observation prompt, Numeric/MCQ, Localization, Hint, Explanation, Reflection, Rubric, Final debrief.
- Keyboard-accessible reorder alternative `Move up/down` always available. Do not use DnD as sole editing pathway.
- Author can mark `revealAfterSubmit: true` for model/reference layers, limit hint usage, choose repeat policy and assign points.
- Auto-preflight: required artifacts exist, references allowed for redisplay, fields/units match, no hidden answer leak, module compatibility, rubric coverages sum, challenge-level metadata complete.
- Branching logic/React Flow belongs later; first version uses a deterministic linear step sequence.

### E-03 Assignment & Review `/educator/assignments/:id`
- Publish to student cohort or share approved local link.
- View attempts by cohort/pseudonymous ID, submissions, rubric dimension analytics, common uncertainties and corrections.
- Comments support instructor review; no automatic 'diagnostic accuracy' conclusions for ambiguous cases.
- Option to revise explanations, creating a new immutable published version for future attempts.

### P-01 Professional Home `/studio`
- No badges/XP/streaks. Resume workspaces and cases; filter by specialty, research asset, run state.
- Task-first CTAs: `Open case`, `Review prediction`, `Compare runs`, `Inspect model`, `Generate report`.
- Modules are separate clinical specialties; not artificially one hospital patient episode.

### P-02 to P-04 Specialty Workspace
- Shared layout shell: left case selection, central large viewer, right inspector, lower scientific timeline/analysis panel.
- SurgiVision selected frame synchronizes original image, boxes, masks, CVS outputs and optional timeline.
- DoseTwin selected voxel/structure synchronizes CT planes, 3D mesh selection, dose overlay, DVH and structure metrics.
- FistulaGuard selected channel/time interval synchronizes audio playback, waveform, spectrogram and feature data.
- Modes: Focus, Compare, Analysis, Research. Remember layout by module; user resizes panels with edit-layout toggle.
- Every result has `provenance/origin`; unknown origin blocks clinical-style reports.

## Proposed specific learning missions

### M1 Surgical: `Cystic anatomy evidence`
Input: licensed Endoscapes frames with expert boxes/masks where available.
1. Student visually identifies a supported structure; can zoom frame without annotations.
2. Student selects region or chooses a label; may state evidence insufficient.
3. Student submits; see matching ground-truth annotations and disagreement discussion.
4. Optional model layer is shown ONLY if actual model output exists and is attributed.
5. Rubric: identified structure (40%), supporting observation (30%), uncertainty awareness (20%), evidence reference (10%). These are PROPOSED illustrative weights; must be instructor-reviewed before lock.
Guardrail: CVS cannot be declared achieved for whole surgery based on one isolated frame.

### M2 Dose: `Find and quantify disagreement`
Input: one verified OpenKBP-Opt matched research case and two archived dose grids.
1. Student selects two existing predictions, verifies dose units, examines overlays and chooses structure.
2. Student finds largest within-ROI absolute dose-difference voxel and navigates there.
3. Student enters measured discrepancy with appropriate units and explains relevance to analysis scope.
4. Rubric: correct spatial selection and tolerance, DVH/metric reading, interpretation distinguishes model disagreement from predictive uncertainty and clinical acceptability.
Guardrail: no claim either archived dose grid is a medically deliverable plan.

### M3 Acoustic: `Trust this signal?`
Input: permitted FiSaV research acoustic channel or explicitly synthetic signal with source visibly tagged.
1. Student listens/inspects real waveform and spectrogram with documented sampling metadata.
2. Inject educator-approved synthetic noise into a derivative copy (if a base recording is available) and compare measured quality gates.
3. Student selects correct explanation and whether further scientific evaluation is reasonable.
4. Rubric: recognizes clipping/noise/missing channel, compares features and does not overdiagnose disease.
Guardrail: synthetic corruption labels always visible, no phone-based diagnosis claims.

## Gamification domain contracts

```ts
interface LearningChallenge {
  id: string;
  version: number;
  module: 'surgivision'|'dosetwin'|'fistulaguard';
  evidenceCaseId: string;
  sourceArtifactIds: string[];
  permittedToolIds: string[];
  hiddenUntilSubmission: ('reference'|'model_output')[];
  steps: ChallengeStep[]; // tagged question/instruction/viewer union
  rubric: RubricVersion;
  attemptPolicy: { maxAttempts?: number; allowRetry: boolean; revealPolicy: 'after_submit'|'educator_release' };
}
interface EvidenceObservation {
  artifactId: string;
  kind: 'frame_region'|'voxel_coordinate'|'time_interval'|'numeric_metric'|'comment';
  // actual type-specific geometry/units validated server-side
  value: unknown;
}
interface ChallengeAttempt {
  id: string; challengeId: string; challengeVersion: number;
  learnerId: string; startedAt: string;
  state: 'started'|'draft'|'submitted'|'reviewed';
  observations: EvidenceObservation[];
  responses: Record<string, unknown>;
}
interface RubricScore {
  rubricId: string; attemptId: string;
  dimensions: { key: string; awarded: number; possible: number; feedback: string }[];
  status: 'automatically_scored'|'educator_review_required'|'reviewed';
}
```

Backend must enforce rubric and view-layer permissions, not rely on concealed frontend CSS. Avoid a single `score: 100` with no documented rubric. Any XP aggregation is a derived projection of server-confirmed immutable grading events.

## Event and data integrity

```text
attempt.created -> observation.saved -> answer.submitted -> rubric.evaluated
                                      -> reveal.authorized -> progress.updated
                                      -> optional achievement.unlocked
```

Replay prevention/idempotency: deduplicate `answer.submitted` by `(attemptId, requestKey)`; only one `rubric.evaluated` per rubric version/submission; no awarding XP for page reload or repeated events. Scores should be reconcilable by replaying confirmed assessment events. Logging must redact personal and sensitive clinical details.

## Suggested visible badges (student-only)

- **Evidence Explorer** — completed first authentic research-case investigation.
- **Signal Quality Detective** — correctly identified corrupted/missing acoustic evidence.
- **Geometry Guardian** — validated CT/dose alignment and units in a curated exercise.
- **Critical Thinker** — appropriately recognized insufficient evidence in an educator-reviewed exercise.

These indicate educational activity—not medical competence, diagnosis skill, certification or professional qualification. Show instructor-approved skill mastery separately from cosmetic XP.

## Shared UX/system chart specification

| Screen | Chart | Valid source | Interaction | Library |
|---|---|---|---|---|
| Academy Home | Path progress/learning activity | challenge events | filter course, drill into attempt | Recharts/shadcn |
| Academy Progress | Rubric dimension history | graded attempts | select skill/course | Recharts |
| Educator Analytics | submission counts, rubric distribution | assigned cohort attempts | filter class, drill down | Recharts |
| SurgiVision | per-criterion timelines, per-class metrics | published annotations or actual runs | click frame + overlay | Recharts / custom timeline |
| DoseTwin | DVH, dose-difference distribution | numerical data from verified grids | click ROI, select plan | Recharts/Plotly |
| FistulaGuard | multi-channel signals | actual recorded samples + metadata | brush synchronized interval | uPlot |
| FistulaGuard | spectrum/spectrogram | SciPy or verified WaveSurfer computation | select frequency or time | Plotly/WaveSurfer |
| Model Lab | experiment metric trends | completed run registry | compare compatible runs only | Recharts |

## Visual and interaction guidelines

- **Professional**: dense, neutral, high-contrast, labels+units, inspectability before delight. Layout not 'cards everywhere'. Surgical imagery and dose overlays dominate.
- **Academy**: friendlier color temperature, mission card hierarchy, progress reveal and restrained animations. No distracting gamification over medical evidence.
- **Shared scientific controls**: top provenance chip and layer legend; focus mode; full-screen; keyboard hotkeys with discoverability; `Reset view`; `Show reference` after authorized submission; error states.
- **Motion**: 150–250ms panel changes as design hypothesis; respect `prefers-reduced-motion`, avoid flashing or noisy continuously animated scientific overlays.
- **Colors**: separate scientific colormap from brand token; e.g. dose legend always indicates Gy, anatomy mask legend always indicates class, student success color never used to imply clinical safety.
- **Responsive**: desktop for precision, tablet simplified; phone supports library/learning text, not fake-equivalent 3D workstation.

## User-story acceptance tests

1. Student cannot query reference label via API before authorized reveal.
2. Student submits wrong scientific value with correct unit: receives validated rubric explanation, not generic 'AI says wrong'.
3. Educator creates three real challenges from different modules without uploading private patient records.
4. Educator publishes v1, edits draft v2; past attempts still resolve v1.
5. Repeated submission or refresh never duplicates XP/achievements.
6. Student in reduced-motion mode can complete all tasks and view feedback.
7. Instructor can score ambiguous explanation without claiming fully automatic medical grading.
8. Professional opens same case and sees source evidence and research tools with no XP UI.
9. Switching between Academy and Studio does not bypass backend role checks.
10. Missing research asset yields explicit documented blocked state, never a synthetic disguised sample.

## Libraries and references

Trophy https://github.com/SpartanDavie/trophy-ui; shadcn https://ui.shadcn.com/; Motion https://motion.dev/; React Bits https://github.com/DavidHDev/react-bits; dnd-kit https://dndkit.com/react/quickstart/; React Flow https://reactflow.dev/; NHS https://service-manual.nhs.uk/design-system/; H5P branching https://github.com/h5p/h5p-branching-scenario
