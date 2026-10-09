# 09 — Lock checklist, ADR candidates, future roadmap

**Important:** As of draft v0.4, the platform architecture is **not locked** and no MEDFORGE source code has been created by this planning package. SurgiVision, DoseTwin and FistulaGuard remain locked independent candidate modules in scope.

## Decisions already agreed (inherited)

- A single MEDFORGE product should preserve all original upstream-capability families over time, using honest staged implementation statuses.
- One monorepo and one React frontend with independent specialty viewers and domain-specific Python scientific engines.
- Student Academy uses structured gamification; Professional Studio is serious, scientifically precise and non-gamified.
- Educator Case Builder connects research evidence to guided learning, not screenshots-only quizzes.
- Shared evidence/case/artifact registry, model/experiment registry, provenance and reports.
- No false patient-level fusion between unrelated research datasets; no real-patient diagnosis or treatment recommendations in hackathon.

## Recommended but NOT LOCKED decisions

| ADR | Proposal | Rationale | Lock question / verification |
|---|---|---|---|
| ADR-01 | Hybrid specialty-first landing and case-first workspace | intelligible to students + specialist researchers | confirm primary navigation with 2-3 real users |
| ADR-02 | Department atlas, not a 3D hospital | high impact with low complexity; directly accessible | is decorative hospital environment desired? |
| ADR-03 | One FastAPI modular monolith + isolated research workers | avoid overengineering while isolating incompatible model deps | GPU availability and deployment target |
| ADR-04 | React/Vite/TypeScript/shadcn/Tailwind | aligns established stack and searchable library ecosystem | package version compatibility smoke tests |
| ADR-05 | Trophy UI for gamification presentation only | open-source, copy-and-own components | npm/build/a11y smoke test |
| ADR-06 | dnd-kit ordered educator blocks; React Flow later | faster and safer linear MVP | educator need for branching at launch |
| ADR-07 | OpenKBP preprocessed slices first, 3D mesh optional | avoids full DICOM runtime for CSV data | validate orientation, voxel-to-viewer transform |
| ADR-08 | uPlot + SciPy for actual acoustic signals | scalable scientific time series | real raw FiSaV access and channel schema |
| ADR-09 | DoseTwin as first deep numerical comparison demo | archived model outputs and measurable dose data | subset archive access, storage and parse test |
| ADR-10 | Local SQLite + directory artifacts MVP | reversible, maintainable and demo offline | multiuser/deployment requirements |
| ADR-11 | Published learning case versions immutable | auditable reference/score and education integrity | DB/version contract acceptance tests |
| ADR-12 | Student explicit submit then reveal | avoids immediate AI overreliance/answer leakage | tested redacted endpoint contract |
| ADR-13 | Optional, opt-in XP/achievements, no mandatory public board | educational integrity/privacy | educator/student preference tests |
| ADR-14 | Research-only professional capability at launch | current validation maturity | clinician intended task boundaries |

## External feasibility gates to close before architecture lock

1. Verify **Endoscapes** sample download, annotation schema/terms and legal showing in jury setting.
2. Verify **CVS-AdaptNet** published checkpoint download/CPU+GPU test, and actual runtime compatibility (test.py has hardcoded `.cuda()`).
3. Verify **SurgLatentGraph** selected models and their checkpoints; don't count unprovided checkpoints as available.
4. Verify OpenKBP core sample and **OpenKBP-Opt** reference/prediction archive availability, volume shape, units, orientation and simple DVH result.
5. Verify FiSaV **raw recordings actually downloadable**, access agreement, channel names/sample rates and license. If unavailable, explicitly mark genuine acoustic case unavailable instead of re-labeling synthetic signals as real.
6. Confirm team compute (NVIDIA GPU model/VRAM? CPU-only?), internet and free disk.
7. Pin tested frontend libraries and scientific Python requirements, identify worker isolation boundaries and license constraints.
8. Pick the **three actual jury demonstration cases** with source IDs, approved descriptions and source screenshots, not placeholders.
9. Verify visual/keyboard interaction on actual 1366x768 laptop; determine medical content reviewer available.

## Explicit product UX open questions

- Is MEDFORGE positioned principally as university training/research, or also clinical decision support? Recommendation: training/research only until independently validated.
- Do we need instructor-created graded assignments during hackathon, or only a guided case template? Recommendation: one real publish flow as differentiator.
- Should advanced research tools require a separate Research preset? Recommendation: yes, but no separate scientific engine.
- Do we need a hospital map? Recommendation: optional 2D department atlas; skip 3D exploration until core tools pass.
- Should students compete with leaderboards? Recommendation: opt-in course-scoped pseudonymous; not in P0.
- Can the university actually provide live domain expert review? If not, label educational content unreviewed and limit public release claims.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Projects look like unrelated pages | common case/evidence contract, interaction design, single lesson->review->professional workflow |
| Overambitious 37h build | vertical slices and honest progressive phases, freeze after S0 asset verification |
| Hardcoded legacy CUDA code | pinned isolated worker and explicit readiness check; precomputed real artifacts where permitted |
| Unavailable raw FiSaV data | treat as an explicit source blocker; don't fake model classification or claim three real modules ready |
| Mixed dose coordinates | geometry validator, explicit `ijk` and projection transforms, matched case checks |
| Scientifically misleading gamification | objective rubric, uncertainty options, domain review, explanation before points |
| Data/license violation | dataset registry, access controls, upstream attribution, no raw restricted data in public git |
| Clinical scope drift | research/education label and independent clinical validation gate |
| Agent drift / changes lost | architecture lock, source catalog, stage commits, PARITY.md and explicit acceptance tests |

## Release roadmap

**Release A (HackCure):** three medical workspaces with genuine source-supported evidence where accessible, dose numerical comparison, surgical label analysis, acoustic signal viewer, one educator case published and attempted by student, one traceable result report, attractive but restrained UI.

**Release B (Pilot):** full authoring/rubrics, professional model registry, selective trained models, experiment comparison and saved workspaces, learner analytic progress, optional scientific educator review.

**Release C (Research Platform):** full upstream code family training/evaluation in isolated pinned runtimes, PortPy and OpenKBP-Opt optimization, robust job workers, multiple research studies, institution SSO/LTI, sophisticated reproducibility and portability.

**Release D (Clinical exploration only if justified):** patient data governance, clinical partner, device regulations, formal validation, security review and appropriate approved workflows. Not currently committed.

## Gate to move from v0.4 DRAFT to v1.0 LOCKED

- [ ] User confirms product mission, user role boundaries, scope of hospital metaphor and preferred MVP.
- [ ] Actual data source and license gate completed per module (or blocked status explicitly accepted).
- [ ] At least one end-to-end representative science result independently validated (DoseTwin suitable candidate).
- [ ] Core API and learning schema field names versioned and reviewed.
- [ ] Technology stack pinned/tested, source commits cataloged.
- [ ] Module ownership, coding-agent instructions and PR merge order agreed.
- [ ] Each of W00–W08 and S0–S8 has assignee, acceptance test and explicit phase.
- [ ] Demo storyboard uses ONLY available scientific data/results.

Only after the user approves those decisions should the final Luna XHigh execution prompt say 'build all of this'.
