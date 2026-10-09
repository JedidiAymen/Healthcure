# LUNA XHIGH — EXECUTE THE MEDFORGE COBALT/PORCELAIN UI REBUILD

**Priority:** HIGH. **Do not write another design brainstorm or change the selected palette.** User has selected design B. Produce code + screenshots + runnable checks. Work in `https://github.com/JedidiAymen/Healthcure`. Audited `main` SHA `8eee9902252767643e24cf6ae2da906186e7c371`; refresh branch, local data and dependency status before editing.

## Objective

Refactor MEDFORGE from a dense, dark-teal admin/dashboard-like interface into a compelling **component-first medical research and education product**. Create three coherent visual modes: Professional / Cobalt-on-Porcelain with genuinely dark scientific image islands; Academy / warm cream with honest Trophy-based XP, achievements and progression; Educator / porcelain visual no-code lesson builder. Preserve the entire existing backend, models, viewers, source checks, learning contract, numerical outcomes and scientific limitations.

The attached Markdown contract controls the work. Follow `01` design tokens, `02` component selection, `03` exact route blueprints, `04` QA and `05` release cutline. Use `AGENTS.md` as anti-slop guardrails. **Do not edit server-side research calculations, source licensing, role checks or learning security just to achieve visuals.** If necessary, make small typed API additions with a regression test, not a rewrite.

## Mandatory starting actions (do, don't merely describe)

1. `git status`, `git rev-parse HEAD`, confirm source commit and dependencies; create `feat/medforge-cobalt-ux` from updated HEAD; no direct changes to `main` unless user explicitly approves.
2. **Fix reproducibility:** repository lacks `package-lock.json` despite `npm ci` in instructions. Resolve pinned dependency tree, generate/commit lockfile, prove `npm ci` in clean checkout, add minimal GitHub Actions lint+typecheck+Vitest+API tests+build. Baseline current tests before changing UI. Do not claim a vendor package compatible without a passing local spike.
3. Record original app screenshots for Home, professional dashboard, DoseTwin, SurgiVision, FistulaGuard, Model Lab, Experiments, Academy, mission, Educator editor at desktop 1440×900 and phone 390×844. Use source data only in private local screenshots where rights permit; don't commit medical dataset screenshots publicly without clearance.
4. Build a `component-lab` route or temporary Storybook using **actual vendor components** wired to typed sandbox fixtures (labeled DEMO), not illustrated replacements. Each candidate has a license/version/bundle/performance/a11y verdict. Reject or defer anything that fails.

## Component-first reuse decisions

- **KEEP** React19/Vite8/TypeScript/Tailwind4/shadcn Base Nova + Base UI, TanStack Query, Recharts shadcn Chart, uPlot, dnd-kit, Motion. Existing viewers are source-correct starting points.
- **ADOPT via tested spike** selected Trophy UI `achievement-badge`, `achievement-grid`, `achievement-unlocked`, `points-levels-timeline`, optionally `points-chart`. Accept only components actually backed by existing Academy API state. XP and achievements require student opt-in. No synthetic streaks, leaderboards or competence ranks.
- **TRIAL only** shadcn Resizable/react-resizable-panels for scientific panel resize. Pointer-to-voxel and COCO box alignment must pass after resizing or revert to CSS grid.
- **TRIAL only** Cornerstone3D custom image/volume adapter for processed OpenKBP arrays; OHIF is interface reference, not a drop-in iframe. If metadata/orientation or coordinate parity fails, keep existing native canvas and enlarge it.
- **TRIAL only** React Flow UI free nodes for a meaningful executable workflow graph, not a fake decorative AI pipeline. A compact source→operation→artifact sequence is acceptable only when steps map to server capability/run records; otherwise show honest registry+run-detail UI. Do not import Next.js app or paywalled Pro templates.
- **TRIAL only** Video.js 10 React player & skin **only when permitted continuous surgical video is installed**. Endoscapes BBox201 contains sampled frames; current surgical mode must stay an image/frame annotation explorer. Do not fake video by animating independent keyframes. Keep current surgical canvas overlays until any new layer passes pixel parity.
- **KEEP** uPlot for FiSaV signals and Recharts for DVH and PSD; add ECharts only with demonstrated interactive spectrogram/heatmap advantage; no random chart library proliferation.
- **KEEP** educator dnd-kit and local learning backend; compose a real 3-zone builder with useful student preview, not a separate fake editor.

## Visual decisions are LOCKED

- Primary `#3955E6` (interactive active `#3552D7`), foreground `#161C2E`, professional shell `#F3F5FA`, white paper panels `#FFFFFF`, borders `#E0E5F0`, viewer-only dark `#101624`, muted `#667085`, academy canvas `#FFF8ED`, academy coral `#FF806C`, gold `#F3C961`.
- No site-wide dark theme; no teal accent; no gradients on scientific data; no excessive badge/card grid. Semantic tokens only; scientific heatmaps and categorical labels are **not** recolored to brand cobalt.
- Professional shell 60px top toolbar, 232px collapsible navigation, inspector 304px, bottom analysis dock ~240px; primary medical content gets >55% of useful workspace in default 1440px context, plus full-focus mode. Academy and Educator use their dedicated skins using shared typography/components.
- Typeface: Inter (UI/body), Plus Jakarta Sans (Academy display only), IBM Plex Mono (scientific metrics/IDs); verify OFL/license and bundle local WOFF2 subsets or use safe fallbacks. Body 14px for dense scientific UI, 16px for Academy/Editor. Interactive targets >=44px on Academy, >=40px on scientific touch surfaces.

## Ship these changes, not generic pages

- **Shell/Home**: light professional command bar; role entry; one prominent `Continue analysis` action; 3 source-grounded specialty launchers and global search; keep detailed readiness and source terms in a discoverable inspector.
- **DoseTwin**: replace `max-w-[190px]` CT image constraint. Primary large CT index-plane canvas, 2 smaller linked planes, crosshair and structures explorer, inspector, docked real DVH+table; focus and resize. Keep index-space semantics, 23 official metrics, source hashes and all 10 ROI values. Two-dose comparison disabled until real same-case dose artifact available.
- **SurgiVision**: authentic frame fills the workspace; scalable boxes/masks, class filters and named anatomy, split/video/frame navigator, expert CVS analysis info and provenance in inspector. Show separate model evidence panel with validation metrics and disabled inference when blocked. Video player only with actual licensed temporal source.
- **FistulaGuard**: measured uPlot waveform is dominant; sticky channel/time-range selector; synchronized PSD and spectrogram bottom dock; selected-window comparison in inspector. Preserve uncalibrated-unit disclosure, verified 59-record source metadata and input-hash evidence.
- **Model Lab/Experiments**: tabs or separated routes for Registry / Runnable analyses / Run history / Compare; real state machine, real labels and logs, blocked actions with precise reason and next step; selected React Flow UI components only where actual jobs support it. No fake success nodes.
- **Academy**: introductory journey page, a single obvious `Continue investigation` CTA, real assignments, vertical accessible progression, selected Trophy badges/timeline/chart only with authorized student data; approved game-like illustration treatment distinct from scientific imagery. Mission is a coherent stepper (Brief → Investigate → Evidence → Explain → Submit), embedding the same verified viewer, hiding answers until educator review. Mobile first.
- **Educator**: source/case picker → 3-zone drag-and-drop builder → live learner-safe preview → rubric → publication and permissions → assignments → submissions. Student answers must never appear in learner network payload before permitted reveal; preserve immutable publication, cohorts, idempotency and grade replay behavior.

## Exact code migration strategy

Edit `src/styles.css` **by creating semantic scoped token layers** rather than replace all CSS in one shot. Break up `src/pages/Pages.tsx` incrementally into `src/features/{home,studio,models,experiments,academy,educator}/` while preserving route exports. Refactor `src/pages/DoseViewer.tsx`, `SurgiViewer.tsx`, `FistulaViewer.tsx` into composed `ViewerShell`, `CaseNavigator`, `PrimaryViewport`, `InspectorPanel`, `AnalysisDock`, `EvidenceSourceFooter` and specialist components; test old/new parity. Keep FastAPI/Pydantic/SQL untouched unless unavoidable.

## Submission discipline

Small reviewable PRs with before/after Playwright screenshots: (0) lock/CI, (1) shell/tokens+real component lab, (2) DoseTwin, (3) SurgiVision/FistulaGuard, (4) Academy/Educator, (5) Model Lab/Experiments plus route QA. Review each against 1440×900, 1280×800, 768×1024, 390×844. Keyboard, resized viewport pointer accuracy, scientific values, source attribution, reduced motion, no overflow. Keep existing reported 30 API / 17 frontend tests (re-run; don't blindly repeat reports).

**Do not:** generate placeholder medical results, add a synthetic surgery video, invent AVF diagnosis, show mock AI prediction as real, replace labels/units, rewrite the backend, bulk-copy paid components, or claim vendor library compatibility without testing.

## Report at each PR

- Exact files changed and which vendor components were actually installed (with URLs, versions, licenses).
- Actual Healthcure screenshot paths and accessible text alternative.
- Measurements: viewport dimensions, bundle delta, lighthouse/perf where measured, test outputs, broken/open items.
- Scientific safeguards and data-gate effects; nothing hidden.

**Definition of done:** Users can navigate all 3 medical workspaces and real evidence, perform a permitted analysis, save a provenance record, build/publish an authorized lesson and complete a student investigation *in the new design*, with no regression or fake science. Deliver working code, not a new concept deck.
