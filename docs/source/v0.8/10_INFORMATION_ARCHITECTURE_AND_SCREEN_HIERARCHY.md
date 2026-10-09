# MEDFORGE v0.5 — Information Architecture, Navigation, and Cross-Role Journeys

**Status: RECOMMENDED DESIGN / NOT ARCHITECTURE-LOCKED.** Date: 2026-10-09. Read `00_ARCHITECTURE_BASELINE.md` first. All three independently maintained engines (SurgiVision, DoseTwin, FistulaGuard) remain in scope. This is a UX contract for Luna XHigh, not proof that any page already exists.

## Principle: One recognizable product, three actual applications

A consistent shell surrounds modality-specific viewers. Do **not** use a generic chart dashboard for all modules. Sharing means consistent case identity, provenance, selection affordances, job status, report actions, focus behavior, and navigation, **not** pretending the data are clinically comparable.

## Global navigation shell

**Persistent top bar** (height target 56–64 CSS px): MEDFORGE identity, path/breadcrumb, active role-aware experience, command search, non-sensitive job status, user/settings. Do not display role switch as a permission bypass. **Primary left navigation** (expanded target width 224–256px; collapsed 56–64px): Dashboard, Case Library, SurgiVision, DoseTwin, FistulaGuard, Model Lab, Experiments, Reports. Specialty links retain last case context if permitted. Experience switching (Academy, Professional Studio, Educator) stays in a clear but secondary switcher and is authorization gated.

**Studio page scaffold**: top subheader (case name + source + availability + save/share/export); collapsible contextual left case list when relevant; dominant main viewer; tabbed or docked inspector right; task-dependent bottom panel; clear status/loading/error surface. Case selection and workspace layout are URL-backed or persisted, never reset just because a sidebar collapsed.

## Complete route map (proposed)

| Route | Screen | Primary CTA | Secondary navigation | Access |
|---|---|---|---|---|
| `/` | Product entry | Resume active workflow | Academy / Studio / Educator | Public overview or authenticated |
| `/studio` | Professional dashboard | Continue last case | Recent runs, specialties, dataset status | Authorized research/review |
| `/studio/cases` | Cross-module case explorer | Open case in specialty | Dataset, modality and access filters | Scoped |
| `/studio/surgivision` | Surgical specialty hub | Open case | Anatomy, CVS, models, datasets | Scoped |
| `/studio/surgivision/cases/:id` | Surgical workspace | Inspect evidence | Timeline, layers, references, model runs | Scoped |
| `/studio/dosetwin` | Radiotherapy specialty hub | Open case | Research plans, models, DVH | Scoped |
| `/studio/dosetwin/cases/:id` | Dose workspace | Inspect CT/dose | 3D, DVH, comparison, planning | Scoped |
| `/studio/fistulaguard` | Vascular-acoustic hub | Open recording | Signals, sensor metadata, validation | Scoped |
| `/studio/fistulaguard/cases/:id` | Signal workspace | Inspect signals | Spectrum, features, quality, ML | Scoped |
| `/studio/models` | Model catalog | Inspect model | Version, availability, compatibility | Scoped |
| `/studio/models/:id` | Model detail | Validate model with case | Requirements, checkpoints, limitations | Scoped |
| `/studio/experiments` | Experiment center | Create run | Recent runs, comparisons | Researcher |
| `/studio/experiments/:id` | Experiment inspector | Replay saved outputs | Logs, metric table, artifacts | Researcher |
| `/studio/reports` | Research reports | Review prior report | Export, audit trail | Scoped |
| `/academy` | Academy home | Continue mission | Path, achievements, departments | Student |
| `/academy/departments` | Department Atlas | Enter specialty path | Clinical context (educational only) | Student |
| `/academy/paths/:id` | Learning path | Begin next mission | Objectives, prerequisites | Student |
| `/academy/challenges/:id` | Restricted science challenge | Inspect and submit | Hints, allowed layers | Student |
| `/academy/attempts/:id/review` | Debrief | Review feedback | References after release; next challenge | Student |
| `/academy/progress` | Learning record | Resume weak skill | Achievements, attempts | Student |
| `/educator` | Educator home | Create activity | Courses, activity library, assignments | Educator |
| `/educator/cases` | Educational case catalog | Create from evidence | Draft/published | Educator |
| `/educator/builder/:id` | Structured block builder | Preview and validate | Source, rubric, permitted scientific tools | Educator |
| `/educator/assignments/:id` | Assignment management | Review attempts | Cohorts, grading, publish feedback | Educator |

No separate independent applications for Academy and Studio. Each screen shares auth, case IDs and artifact services. Route aliases must redirect; do not maintain duplicate UI trees.

## Professional journey

1. Land `/studio` -> inspect last case and module source readiness.
2. Enter a specialty or global library -> filter *available licensed* evidence.
3. Open case -> load manifest + restore last valid layout -> primary viewer fills available space.
4. Select scientific feature -> linked panels update from typed source of truth; save evidence selection.
5. Choose model/analysis -> validate model/data/environment -> queue or use genuine stored result.
6. Inspect scientific result and provenance -> compare compatible runs -> export auditable report.
7. Deep-link back to exact frame/voxel/time range from report or Experiment Center.

## Academy journey

1. `/academy` -> continue progress or select a specialty via atlas.
2. `/academy/paths/:id` -> learning objectives, expected time only if authored, prerequisites, start.
3. `/academy/challenges/:id` -> tutorial; restricted scientific viewer with authentic data and licensed material.
4. Inspect permitted layers or measurements; optional hints; enter answer with uncertainty option.
5. Explicit Submit -> server records immutable attempt -> reveals reference per educator policy.
6. Debrief explains observed evidence and limitations, provides rubric-based feedback, optional XP.
7. Continue path and progress; no public leaderboard by default.

## Educator journey

1. `/educator` -> pick course/assignment context.
2. Select a reusable research case -> inspect permissions and provenance; open builder.
3. Author ordered blocks with dnd-kit: instructions, scientific viewer, observation, numeric measurement, explanation, reference reveal.
4. Set allowed tools and prohibited reference artifacts; define rubric, acceptable uncertainty and thresholds.
5. Student preview uses real redacted payload and backend authorization, not frontend visual hiding.
6. Validate -> version/approve -> publish immutable artifact -> assign -> review submissions.
7. Feedback is visible per release rules; edits to published cases produce a new version.

## Global command actions

Command search can find accessible case IDs, modules, models and views. Search results must obey authorization. Suggested command palette actions: Open Case, Jump to Frame, Select Structure, Toggle Evidence, Open Analysis Run, Export Report, Restore Default Layout. Keyboard shortcuts must not intercept inputs, screen readers or browser defaults.

## Screen states to design for all routes

Initial skeleton; full success; partial data (e.g. no masks for this frame); empty dataset; insufficient permission; missing licensed asset; missing checkpoint/runtime; failed job; corrupted data or geometry; offline; stale cached result; slow or oversized volumetric data; draft vs published challenge. Each state shows cause, action, and provenance, not a generic blank chart.

## Acceptance criteria

- A scoped case ID opens in its proper module with correct dataset attribution; unauthorized cases cannot be discovered or opened.
- Back/forward navigation restores selected case and layout without discarding unsaved educator work.
- Switching role displays only granted capabilities; hiding UI does not grant backend access.
- A student challenge always obtains *redacted* evidence artifacts before answer release.
- Professional -> Academy -> Educator never mutates source scientific data or model results.
- Every specialty can return to its hub or report from a deep link.
