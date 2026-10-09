# MEDFORGE v0.5 — Responsive, Accessibility, Errors, UX Acceptance

**Status:** Draft cross-cutting quality contract for Luna XHigh. High-stakes scientific context requires understandable errors, non-color-only signals and reliable focus behavior. This is NOT a claim of formal WCAG or medical-device certification.

## Responsive matrices

| Form factor | Academy | Professional Studio | Educator |
|---|---|---|---|
| 1440x900 desktop | Full mission with optional sidebar + viewer | 2–4 synchronized scientific panels if enough space | 3-pane editor: blocks, canvas, inspector |
| 1366x768 laptop (critical) | Mission main viewer and right/debrief tabs | Primary viewer 65–75% horizontal area with collapsible controls | 2-pane builder; inspector drawer |
| 1024x768 tablet | Single viewer + tabs, progress accessible | Single focused scientific view; secondary views in tabs | Reorderable list with persistent Preview |
| 390x844 mobile | Functional lesson read/respond; simplified supported viewer | Read-only case metadata, selected 2D image/audio view; advanced 3D work marked desktop-only | Preview/review, advanced block editing desktop-only |

No horizontal page overflow at widths above 320px in landing, library, missions, and major dialogs. Heavy scientific panes have explicit technical device constraints instead of broken content. A user can return to full desktop view without losing the draft.

## Accessible interactions

- All navigation, filter, submit, confirm, compare and report actions keyboard reachable; focus never hidden by sticky headers (WCAG 2.2 focus visibility).
- Use actual buttons for moving lesson blocks up/down; drag-and-drop is progressive enhancement. Keyboard dnd-kit sensors documented and tested.
- Provide keyboard-accessible pan/zoom/cursor controls and numeric coordinate/range inputs as alternatives where possible; do not rely on drag-only tissue or voxel selection for graded tasks.
- Professional chart can be inspected as table/export; scientific image labels have accessible textual listing. No reliance solely on hue to encode anatomical class or difference sign.
- `prefers-reduced-motion` disables celebratory bursts, animated parallax and nonessential panel movement. Plot data update and selection remain correct.
- Tools with destructive actions have confirmation, undo when feasible, and explicit ownership. No automatic reference reveal before student submission.
- All inputs have units, ranges, labels, errors and typed validation; decimal separators and local formatting can vary, scientific numeric storage remains standard.

## Interaction quality checklist

### Common application

- Routes deep-link successfully; forbidden items do not appear in search or yield data via direct URL.
- Nav keyboard focus, ARIA landmarks, breadcrumbs, case source badge, run readiness label, save status.
- Each view has correct loading, zero, empty, unauthorized, failed, offline, incompatible and success states.
- Dialog closing does not discard analysis jobs; preserve in progress route.

### SurgiVision

- Frame jump goes to real file and annotation with exact alignment after resize/zoom.
- Hiding `Reference` does not hide `Model`. Frame missing a mask clearly says so.
- Sparse frames never displayed as authentic continuous video.
- Reporter links to exact frame and research source.

### DoseTwin

- Crosshair is synchronized after slice scroll; zoom/pan does not change selected array index inadvertently.
- DVH curve and selected organ are linked and contain Gy/% axes with textual metrics.
- Wrong geometry, wrong case, unknown units disable comparison; no fake 3D physical alignment.
- Plot controls change display, not dose array or plan.

### FistulaGuard

- Selection range, sample indices, audio position and spectrogram link correctly.
- Quality checks explain threshold with origin, unit and input segment.
- Bad sample rate/missing channel block model but not raw inspection.
- FiSaV file access issue is shown honestly; synthetic placeholders not labeled real clinical evidence.

### Academy

- Server redacts reference answer and hidden labels until authorization; inspect actual network payload in E2E test.
- Student can choose uncertainty and explain, rather than forced certainty or a diagnosis.
- Repeating submission cannot double-award XP; grading run idempotent.
- After reveal, feedback distinguishes expert evidence from archived model and synthetic teaching examples.

### Educator

- Builder saves drafts and warns on stale edits; publish creates immutable version.
- Preview uses authentic student permissions, not CSS-hidden correct answers.
- Keyboard move/reorder; publish blocked if data license forbids sharing or reference unavailable.
- Rubric version attached to grade; change after publication requires new version.

## Validation target matrix

| Check | Method | Pass condition |
|---|---|---|
| Responsive | Playwright 1440x900,1366x768,1024x768,390x844 | No unintended overflow, CTA visible |
| Keyboard | Playwright + manual tab/shift-tab/escape | Logical tab/focus; drag fallback |
| Visual regression | Screenshot compare per role and modality | No panel loss/legend cropping |
| Contrast and ARIA | axe-core audits + manual charts | Correct labels, no critical accessibility violations |
| Reduced motion | Browser emulation | Academy transitions disabled; functionality intact |
| Scoped case permissions | API and end-to-end tests | Only authorized assets accessible |
| Answer leakage | Student API payload inspection | Correct rubric/reference absent pre-submit |
| Viewer sync | Unit & E2E simulated selections | All dependent panels same ID/coordinates |
| Scientific validity | Python independent tests | Equal baseline metrics within chosen tolerance |
| Memory/performance | Browser performance profiler on actual demo laptop | No sustained runaway canvas/volume allocations |

## UX anti-patterns explicitly forbidden

Fake '99% safe' badges, fabricated healthcare data, animated charts unrelated to calculation, red/green diagnostic traffic lights, unreviewed patient recommendations, tool buttons pretending missing models work, loss of provenance on export, grading from a student-provided secret answer, permanent leaderboard without opt-in, complex 3D hospital scene before actual science works.

Reference: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ ; https://service-manual.nhs.uk/design-system/design-principles
