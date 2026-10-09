# 03 — EXACT ROUTE BY ROUTE CHANGE SPECIFICATION

Reference source at audited commit: `src/App.tsx`, `src/pages/Pages.tsx` (~142 KB), `src/pages/DoseViewer.tsx` (~19 KB), `src/pages/SurgiViewer.tsx` (~32 KB), `src/pages/FistulaViewer.tsx` (~42 KB), `src/pages/LessonEditor.tsx` (~26 KB), `src/components/Shell.tsx` (~15 KB), `src/styles.css` (~21 KB). Split incrementally, keep routes and APIs stable.

## 1. Root `/` — first impression / choose role

**Current flaw:** multiple generic cards and verbose explanation before a clear action.

**Change:** clean Porcelain full-bleed intro, strong MEDFORGE brand treatment, three clear audience options (`Professional`, `Learn`, `Teach`) with authentic **textual** descriptions; feature one meaningful live-resource teaser if safe (`Explore an available research case`); dark medical viewport thumbnail island only if asset has display permission, else crisp abstract non-medical line illustration labelled illustration. One main CTA and two quieter alternatives. Footer has `Research and education only` disclaimer. No clinical imagery as fake proof.

**Keep:** existing working navigation and capability-aware source inventory. **Test:** role selection and case deep link, empty dataset state, 390px.

## 2. Global `src/components/Shell.tsx` — 3 role layouts, not one giant sidebar

**Current:** sidebar lists all studio tools and both education areas simultaneously; role switch is navigation rather than a real workspace visual change.

**Change:** persistent brand bar (60px) with centered context breadcrumb, global `⌘K`/`Ctrl+K` search, account and role, one prominent relevant CTA. A compact **role-specific** navigation set: Professional gets Cases / Analysis / Models / Experiments / Reports, Academy gets Continue / Learning Paths / Progress / Achievements, Educator gets Lessons / Assignments / Submissions / Learners. A clearly visible role switcher in brand header. Search preserves current query and source IDs. Modern minimal active cobalt marker, icon+label; keyboard full support. Data badges in inspector rather than all over sidebar.

**Keep:** `SessionProvider`, `LearningRoleGate`, query-cache clearing, current case search. Hide unauthorized nav links but server permission remains source of truth.

## 3. `/studio` — scientific home

**Change:** a curated workbench rather than status dashboard: row one `Resume work` if real saved state, row two three distinct research disciplines showing exactly source count and real operation available, row three recent trusted analysis runs. A large graphic preview belongs to actual data; otherwise use a domain illustration with `Illustration` label. Put readiness source/legal ledger behind details instead of six banners.

**Keep:** original source registry and readiness/citation. **Test:** 0,1,many cases, manual keyboard case open.

## 4. `/studio/cases` — case registry

**Change:** modern searchable data table, sticky filters and native pagination; domain filters as segmented controls; row structured `name / source / type / last action`. Add selected-case side preview and `Open analysis` primary action. Indicate surgery **frame** vs DoseTwin **case** vs FiSaV **recording**, never lump into fake patient visits. Avoid scrolling through 1,933 cards.

**Keep:** paging, source IDs and query-deep links, constraints and citation.

## 5. `/studio/dosetwin/cases/:caseId`

**Current crucial issue:** `SliceCanvas` uses `max-w-[190px]`. A medically meaningful image is being displayed as a thumbnail.

**New desktop composition:** `Case Navigator` (optional 208px) → large focus viewport (>=500px when available; preserve aspect, medical pixel fidelity) with two smaller orthogonal array planes via strip/toggle → `ROI + Measurements Inspector` (304px) → `DVH / Organ metrics / Source evidence` bottom dock (220–260px) or split inspector tab. Main controls: slice scrub/keyboard, linked voxel crosshair, zoom/pan, ROI overlay toggle, reference dose toggle and opacity, color scale legend with Gy units. Clicking any plane updates all indexes and selected ROI. Fullscreen focus workspace available.

**Scientific safeguards:** only index-space X/Y/Z titles, not anatomical axial/coronal/sagittal until reference orientation proven. Do not invent a clinical 3D head. Every source array reports CT/dose/mask and hash, benchmark/reference origin; current numerical method preserved. Keep 23 official evaluator comparison results for installed `pt_201`, all 10 ROI categories and 128³. If Cornerstone spike fails, upgrade existing `Canvas` geometry and pointer conversion; a huge native canvas is good.

**Comparison tab:** render unavailable `Requires a second compatible dose artifact` rather than two fake DVHs. **3D tab:** disabled `Only when geometry/mesh and render verified`, may provide lawful ROI 3D mesh preview if physically honest.

**Preservation checklist:** same case ID, CT value, selected voxel, dose, ROI mask values, DVH and method; overlay alpha; source hash; experiment → report; guided Academy mode locks forbidden inputs.

## 6. `/studio/surgivision/cases/:caseId`

**New desktop composition:** large actual surgical frame as 70% visual surface; frame navigator and dataset split/video/frame chooser as collapsible left; top overlay toggle chips for source boxes / source RLE masks / expert CVS label summary; right inspector for one selected annotation, category, exact source bbox, label provenance; lower evidence / CVS source labels / model evidence tabs.

**Critical distinction:** keyframes are sampled images. No play button, progress video timeline, or timestamps implying full video. If a continuous legally permitted source is later installed, Video.js with real native playback and source-bound timestamp+annotation sync **conditionally** enables video mode. `react-konva` optional only if it reproduces pixel-perfect COCO masks.

**Model panel:** full 409-frame CVS-AdaptNet validation evidence may be displayed as a research statistic with method/split and caveats, but selected-frame inference CTA stays disabled while checkpoint-independent integrity/license gate unresolved. No fabricated confidence or surgical clearance labels.

**Keep:** 1,933 Endoscapes frames, train/val/test and source images+hashes, bbox + RLE mask positions, 3 CVS label-mean values, export/source reviews, privacy restrictions in lessons. **Test:** source 4_26200 and 13_46850 in desktop/mobile; zoom and pan preserve hitboxes.

## 7. `/studio/fistulaguard/cases/:caseId`

**New:** measured waveform full-width hero (uPlot; readable axis label + captured channel/time); move channel, 5/10/20 second duration, exact numeric start and selection to fixed sticky top strip; PSD + spectrogram tabs in lower full-width region; inspector shows physiological metadata, computed features, uncertainty/units, same-record comparison and saved artifacts. Real timebase preserved, never fabricated 10k samples/second normalization for exact original timestamps. Data values table behind `View source values` toggle.

**Keep:** all 59 checksum-backed CSV recordings (on owning machine), ECG & raw PZT1–4, proper Welch PSD, channel stable color, same-window source consistency, selected interval/bounds, 'physical unit unspecified' labels, no unsupported stenosis diagnosis. **Test:** 2 different records, source hash changes, 5/10/20 s, sample boundary, save/reopen comparison.

## 8. `/studio/models` — model registry not disabled card gallery

**New:** search & filters for `Model name`, `Specialty`, `Operations`, `Available vs blocked`, `License`; table/list rows compact; right detail drawer shows source revision, allowed operations, model inputs, outputs, real validated metrics and errors. Primary CTA says `Run validated operation` only when model is genuinely runnable and access permitted. Other CTAs say `View validation evidence` or `Why unavailable?`. Avoid 7 giant model cards with the same lock icon.

**Keep:** every model source and parity status. **Test:** blocked gate renders actual blockers from API, not hardcoded UI assertion.

## 9. `/studio/experiments` — legitimate experimentation

**New:** `Run history` and `Configure analysis` views; source case picker → actual supported operation → inputs → confirm → real run ID status. If React Flow nodes are adopted, they mirror this server-executable path and show only real stages. Show complete per-run provenance, result/table/plots, errors. Side-by-side comparisons only when valid compatible outputs exist. No fake background task execution or random success animation.

**Keep:** OpenKBP source-backed summary job, saved reports and FiSaV comparison artifacts; no separate AI model claims.

## 10. `/studio/reports` — evidence library

**New:** filterable research evidence list, nested details drawer; previews of source case, operation, hashes/metrics, method, limitations, export JSON and actual registered assets. A clear warning before distributing legally constrained data. Scannable report header rather than all cards.

**Keep:** report persistence, JSON exports, re-open exact selected state; no patient identity synthetic joins.

## 11. `/academy` — should *feel* like learning and play

**New:** warm cream Academy shell independent of research palette. Strong chapter header (SVG/illustration explicitly not medical data), `Continue investigation` main CTA, a **vertical journey map** with three specialty branches (separate progress by source, not one fake patient). Trophy UI achievements, level timeline, points chart only when backed by actual consented user activity; use locked/unlocked/completed states, small contextual reward animation, no cartoon confetti constantly. Real activity feed (not empty generic cards).

**Mobile:** one highly legible column with next mission, chapter track and bottom Academy navigation; no sprawling node graph. Distinguish `Not assigned`, `Available`, `In progress`, `Submitted`, `Reviewed`.

**Keep:** opt-in XP and achievements OFF by default, server-managed learning paths/cohort filtering, actual assignments, grading and debrief.

## 12. `/academy/paths/:pathId` — specialty learning path

**New:** chapter poster + simple linear chronological investigation route with exactly one primary action per lesson; accessible list under visual path. A lesson shows source discipline, objective, state, due date only if set, progress tied to assignments not fictitious competencies. Trophy achievement CTA optional when genuinely awarded.

**Test:** unassigned user sees no fake unlocked missions; screen reader can navigate path; phone at 390x844 no overflow.

## 13. `/academy/missions/:missionId` — actual playable investigation

**New:** five-step mission stepper `Brief → Explore Evidence → Observe → Explain → Submit`; one critical task per step, compact panel for selected data source/provenance. The same surgery/dose/signal viewer is embedded in guided mode with permitted tools only. The evidence they select travels back to assessment and rubric as typed server-validated coordinates/time/channel. Show reasoning prompts; don't reduce science to decorative quiz cards. Before educator review, never reveal hidden answer key/privileged rubric/source annotations where prohibited. After release, debrief and earned status update.

**Keep:** backend role checks and immutable published versions, saving, idempotent submit, manual grade and delayed reveal. **Do not** automatically publish an OpenKBP lesson while dataset display rights are blocked.

## 14. `/academy/progress` — progress is learning activity, not clinical competence

**New:** next action, saved drafts, submission status, validated latest-graded rubric history with exact data table, Trophy achievements when enabled; no clinical aptitude label. Filter by available course only. No charts with fabricated month data.

**Test:** empty state; populated educator-reviewed grade; keyboard selector + chart & table; opt-in preferences isolate accounts.

## 15. `/educator` — teaching workspace

**New:** light Porcelain teaching landing: `Create case lesson`, `Assignments awaiting review`, `Draft lessons`, `Active groups`. One workflow-first CTA. No giant fake hero metrics; use current real owned cohorts, drafts and submissions.

## 16. `/educator/cases/:lessonId/edit` — visual Case Builder

**New:** left block palette 208px (`Explain`, `Evidence`, `Question`, `Observation`, `Measure`, `Reveal`), center ~600px+ sortable authored cards with inline editing and validated step sequence, right 300px learner-safe live preview and rubric/context inspector in tabs. A sticky top `Saved/Draft` status, preview and publish with precise legal/permission blockers. dnd-kit keyboard+pointer, move up/down accessible, current optimistic revision and inline errors. Student preview intentionally hides rubric answers/reveal blocks. Source selection previews actual permitted source/credit.

**Keep:** existing dnd-kit code, source/right permission attestation, rubric total 100, immutable published versions; no extra editor library unless needed.

## 17. `/educator/assignments` and `/educator/submissions`

**Change:** teaching tables, status & due date, cohort filters, searchable learner attempts; submission opens side-by-side selected scientific evidence and manual rubric criteria. Do not automate or infer grading from unverified AI. Save receipts and previous corrections remain readable.

## Scope source files

- `src/styles.css`: add semantic role tokens + replace page styles piecemeal; do not nuke global CSS before tests.
- `src/components/Shell.tsx`: role shell and context search; keep auth and query semantics.
- `src/pages/Pages.tsx`: decompose route exports incrementally (`src/features/home`, `studio`, `cases`, `models`, `experiments`, `reports`, `academy`, `educator`).
- `src/pages/DoseViewer.tsx`: viewer-first composition; retain `src/lib/dose-visualization.ts` and tests.
- `src/pages/SurgiViewer.tsx`: larger source imagery; retain original COCO mask math and `src/lib/surgical-evidence.ts`.
- `src/pages/FistulaViewer.tsx`: uPlot hero/docks; retain `src/lib/signal-evidence.ts`.
- `src/pages/LessonEditor.tsx`: role specific builder; retain backend `apps/api/app/learning.py`.
- `src/lib/api.ts`: use typed generated API schema, no parallel hand-written transport model unless unavoidable.
