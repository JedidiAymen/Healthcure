# 02 — REAL VENDOR COMPONENTS, ADOPTION CONTRACTS AND GATES

**Rule: copy/install only after checking the exact source, license, API and compatibility with the audited React 19 / Vite 8 / Tailwind 4 / Base UI project.** Vendor demos often use Next.js or a different shadcn primitive, so do not paste an entire template.

| Component family | Real source / integration | Scope | Decision | Acceptance trial |
|---|---|---|---|---|
| shadcn/ui + Base Nova/Base UI | https://ui.shadcn.com/ | all | KEEP and standardize installed components | installed Button/Select/Badge/Dialog etc maintain behavior/a11y; tokenized light role modes |
| Trophy UI | https://ui.trophy.so/docs/components | Academy | CONDITIONAL ADOPT 4-5 selected free components | only API-authorized XP, level thresholds, achievement grants shown; opt-in defaults honored |
| React Flow UI | https://reactflow.dev/ui | experiments/models; *optional* course DAG | CONDITIONAL TRIAL | actual node types/jobs/state exist; keyboard list fallback; no Next.js/premium imports |
| Cornerstone3D | https://www.cornerstonejs.org/docs/examples/ | DoseTwin | CONDITIONAL EXPERIMENT | custom OpenKBP loader maintains 128³ index parity, dose/ROI overlay and click coordinates; revert if not |
| OHIF | https://docs.ohif.org/ | reference only | REFERENCE | study panel/tool layouts; never iframe fake DICOM viewer |
| Video.js v10 | https://videojs.org/docs/framework/react/guides/architecture | SurgiVision video only | DEFER UNTIL REAL LICENSED VIDEO | player loads authorized time series, scrubbing aligns frame and annotations; preserve keyframe-only mode |
| react-konva | https://konvajs.org/docs/react/ | SurgiVision overlays | OPTIONAL TRIAL | COCO box/mask exact pixel geometry under pan/zoom/resize and no overlap regression |
| react-resizable-panels / shadcn Resizable | https://ui.shadcn.com/docs/components/resizable | scientific inspector/docks | CONDITIONAL TRIAL | pointer mapping, resize persistence, mobile drawer, keyboard resizing |
| uPlot | https://github.com/leeoniya/uPlot | FistulaGuard | KEEP | source-window correctness and axis labels; no patient-unaware downsampling |
| Recharts + shadcn Chart | https://ui.shadcn.com/docs/components/chart | DVH/PSD/learning charts | KEEP | real arrays; chart-legend scales, accessible table |
| Apache ECharts | https://echarts.apache.org/en/index.html | signal heatmap/advanced charts | OPTIONAL TRIAL | measured times and power heatmap accurate; demonstrate uplift before adding |
| dnd-kit | https://dndkit.com/ | Educator | KEEP | keyboard reorder, persists authored order, learner projection correct |
| Motion | https://motion.dev/ | Academy | KEEP SMALL | reduced motion respected; not on evidence plots |
| Playwright | https://playwright.dev/ | QA | ADD DEV-ONLY | screenshot diffs + actual app keyboard/coordinate tests |
| Storybook a11y | https://storybook.js.org/docs/writing-tests/accessibility-testing | component lab | OPTIONAL DEV-ONLY | no runtime footprint; choose only if compatible with locked toolchain |

## Trophy UI: exact desired components

The official component index lists `Achievement Badge`, `Achievement Grid`, `Achievement Unlocked`, `Points Levels Timeline`, `Points Chart`, plus many leaderboard and streak widgets. **Selected first-pass set**:

1. **Points Levels Timeline**: show evidence-backed *learning activity* progression, not clinical competence. Existing Academy API currently supports XP preferences; real level thresholds may require explicit new metadata; until defined, use `Progress` + path nodes and keep timeline gated.
2. **Achievement Badge/Grid**: show achievements only when server awards/attests to them and student opted in. Existing first-reviewed-evidence award can be shown; don't populate dozens of fantasy badges.
3. **Achievement Unlocked**: celebratory dialog only on a new persisted achievement; no animation on ordinary page load.
4. **Points Chart**: *optional* only if real history points are available. No fake trend or streak derivation.

**Do not** deploy leaderboards or streaks in hackathon release; they are unnecessary, risk bad incentives and may expose education data.

## React Flow: do not mistake a diagram for running AI

The official Workflow Editor is Next.js + Tailwind + shadcn + Zustand. MEDFORGE is Vite. Import low-level free React Flow nodes, adapt to Vite and existing API. State should show `blocked | unavailable | ready | running | succeeded | failed` based on persisted `/models` and `/runs` source, with timestamps, inputs and error text. A node diagram of nonexistent models is prohibited. A separate accessible ordered list is required for screen readers and phone.

## Cornerstone/OHIF: avoid scientific falsification

OpenKBP is a preprocessed 128³ array with voxel dimensions, not native DICOM orientation/UIDs. Cornerstone supports custom loaders but integration must not invent patient-space axes or physical coordinates. Run a **one-case spike** with medically accurate source-array projection: compare overlay, slice values, crosshair 3-way click mapping and all DVH metrics to current app. If mismatched or heavy, **retain existing canvas and enlarge it**. A viewer library upgrade is not a requirement for an excellent dose lab.

## Surgical video: respect source semantics

Endoscapes BBox201 is sampled keyframes. The existing 1,933 frames and COCO annotations are already valuable; **add a sophisticated keyframe browser, not a sham video timeline**. Video.js only when a legal, continuous, time-aligned video exists. If supported later, add source-grounded frame/phase/model synchronization. Distinguish source boxes from live predictions in all controls.

## Exact adoption evidence required per library

Fill `docs/ui/library-spikes.md` with: source URL; version/SHA; license of code+assets; installation command; React/Vite/Tailwind compatibility; SSR or Next-only requirements; test screenshot; keyboard and reduced-motion results; network/offline needs; initial+chunk bundle delta; science parity outcomes; final verdict `ADOPT | REJECT | DEFER`. Only successful vendor components get merged into production. Never bulk-install Trophy/ReactFlow libraries; use a selected few.
