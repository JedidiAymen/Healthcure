# MEDFORGE — researched libraries, UI resources, and agent skills

**Status:** Candidate tech stack / to lock with team. **Research checked:** 2026-10-09. Public project links are for evaluation; no installation, benchmark or license audit has been performed. Luna should verify latest compatible versions, inspect lockfiles, pin explicit versions and run local compatibility tests before adopting any package.

## Decision summary

**Use a layered selection, NOT a single enormous component stack.** Default React + Vite + TypeScript + Tailwind v4 + shadcn UI. Medical visualizations are special-purpose viewers; do not shoehorn them into Recharts. Dragging panels is distinct from dragging lesson blocks. Student motion is distinct from clinical display.

### A. Foundational platform UI

| Resource | URL | Proposed use | Decision |
|---|---|---|---|
| shadcn/ui | https://ui.shadcn.com/ | Navigation, tabs, dialogs, forms, tables, accessible primitives | RECOMMENDED |
| shadcn Chart (Recharts v3 on Base path) | https://ui.shadcn.com/docs/components/base/chart | Academy progress, experiment metrics, simple DVHs | RECOMMENDED |
| TanStack Query | https://tanstack.com/query/latest/docs/framework/react | Server state, case fetch, retries, job polling | RECOMMENDED |
| Zustand | https://github.com/pmndrs/zustand | Local cross-panel scientific selection state | RECOMMENDED |
| Motion | https://motion.dev/ | Academy transitions, progress, UI microinteractions | RECOMMENDED, minimal professional use |
| GSAP | https://github.com/greensock/gsap | Optional landing-page choreography only | OPTIONAL; avoid combining with Motion on same components |
| NHS Design System | https://service-manual.nhs.uk/design-system/ | Clarity, error, clinical information hierarchy, a11y patterns | REFERENCE; no official NHS branding |
| Medplum | https://github.com/medplum/medplum | FHIR/hospital app UX patterns and React components | FUTURE / REFERENCE; no EHR requirement in MVP |

Why: a shadcn-based shell is easier to maintain than several fully themed kits. NHS supplies healthcare-oriented interaction/content guidance. Medplum is a full FHIR/EHR platform, so adopting its backend now would overexpand the scope.

### B. Gamification and educational interaction

| Resource | URL | Exact reuse | Recommendation / hazard |
|---|---|---|---|
| Trophy UI | https://github.com/SpartanDavie/trophy-ui | XP indicators, leaderboards, streak cards, achievements; shadcn registry components | PRIMARY visual kit; MIT; own our learning rules and database |
| Trophy UI newer org | https://github.com/trophyso/ui | Verify upstream canonical package/registry | Verify repo lineage and copy component-by-component |
| Questro | https://github.com/marquespq/questro | Gamification UI alternatives | OPTIONAL; do not adopt alongside Trophy by default |
| React Bits | https://github.com/DavidHDev/react-bits | Interactive Academy landing, celebration microinteraction | SELECTIVE; avoid heavy animated backgrounds |
| Magic UI | https://github.com/magicuidesign/magicui | Elegant accent transitions and hero elements | SELECTIVE; keep scientific workspaces quiet |
| React Flow | https://reactflow.dev/ | Future teaching pathway and evidence/experiment graph builder | PHASE 2; not required for linear MVP missions |
| H5P branching scenario | https://github.com/h5p/h5p-branching-scenario | Instructional reference for branching scenarios and structured scoring | REFERENCE; embedding full H5P authoring is unnecessary now |
| dnd-kit | https://dndkit.com/react/quickstart/ | Reordering mission steps, educator blocks and evidence cards | RECOMMENDED when Case Builder lands |
| tldraw | https://github.com/tldraw/tldraw | Freeform collaborative sketch canvas alternative | NOT MVP: production SDK requires license key; use only with license review |

**Gamification rules:** Reward accurate observations, evidence citations, appropriate uncertainty and revised understanding. Avoid scoring students solely for accepting a model or making a risky diagnosis. Scores require deterministic scoring rubrics and idempotent server actions. Professional Studio never shows XP/streak celebration UX. Accessible fallbacks and reduced-motion preferences are compulsory.

### C. Scientific charts and interaction

| Resource | URL | Fit | Decision |
|---|---|---|---|
| shadcn Chart + Recharts | https://ui.shadcn.com/docs/components/base/chart | Results summaries, learning progress, small metric plots, standard DVHs | PRIMARY dashboard chart layer |
| Apache ECharts | https://echarts.apache.org/en/index.html | Heatmaps, multi-axis charts, brushing, complex comparative views | OPTIONAL scientific visualization layer |
| Plotly.js | https://plotly.com/javascript/ | Scientific heatmaps, contours, 3D plots, detailed chart interactions | RECOMMENDED for specialty charts if needed; lazy-load bundles |
| Plotly React wrapper | https://github.com/plotly/react-plotly.js | React integration | Use customized bundle; beware size |
| uPlot | https://github.com/leeoniya/uPlot | Dense synchronized physiological waveforms | PRIMARY FistulaGuard time-series engine |
| wavesurfer.js | https://github.com/katspaugh/wavesurfer.js | Audio playback, waveform timeline, regions and spectrogram plugin | PRIMARY FistulaGuard audio component |
| visx | https://github.com/airbnb/visx | Custom, bespoke specialized plots | OPTIONAL if requirements exceed Recharts |

**Do not use one chart package for everything.** Comparison tables/academy progress use Recharts. Vascular signal charts use uPlot; WaveSurfer for playable audio. Spectrogram can use WaveSurfer plugin or a server-computed spectrogram shown in Plotly/ECharts. Dose volume histograms are numeric curves with verified units and conventions, not generic health-stat charts. Plotly can be heavy: chunk/lazy load, tree-shake where possible, measure bundle.

### D. Drag-and-drop, layout, and builders (distinct use cases)

| Resource | URL | Use | Priority |
|---|---|---|---|
| React-Grid-Layout v2 | https://github.com/react-grid-layout/react-grid-layout | Drag/resize user scientific panels, saved layouts by module and breakpoint | P1/P2 |
| dnd-kit | https://dndkit.com/react/quickstart/ | Sort, nest and reorder mission/lesson content in Educator Builder | P2 |
| React Flow | https://reactflow.dev/ | Connect algorithm steps or branching missions as nodes/edges | P3 optional |

Do not render a 2D CT/dose medical viewer inside a constantly resizing grid without debouncing, ResizeObserver handling and viewport reflow checks. Expose static Focus/Compare/Analysis presets before user-built layouts. Editing mode needs a distinct toggle to avoid accidental drag while zooming scientific data. Persist schema-versioned layouts; provide Reset Layout.

### E. Medical, 3D and annotation visualization

| Resource | URL | Use | Caveat |
|---|---|---|---|
| Cornerstone3D | https://github.com/cornerstonejs/cornerstone3D | Real medical imaging volume/stack viewports, crosshairs and segmentation | Best when formats/metadata support a valid volume loader |
| OHIF Viewer 3.11 | https://docs.ohif.org/3.11/ | Radiation-dose, structures, professional viewer UX and extension design | DO NOT embed full OHIF merely for OpenKBP CSV; integration is substantial |
| React Three Fiber | https://github.com/pmndrs/react-three-fiber | DoseTwin organ meshes/3D focus, anatomical scene controls | Only with verified CT geometry |
| Drei | https://github.com/pmndrs/drei | 3D camera/helpers | Lightweight, selective |
| react-konva | https://github.com/konvajs/react-konva | Surgical frame boxes, editable overlays, clicks and zoom | Ensure pixel-accurate video canvas registration |
| Native HTML5 video | https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video | Surgical playback with typed timestamp mapping | Not every research dataset ships continuous video |

A full medical DICOM viewer is not a substitute for reading OpenKBP sparse-CSV arrays. Choose: (A) verified lightweight preprocessed 3D grids and meshes for MVP, or (B) real DICOM/volume adapter with Cornerstone for longer term. Never invent patient-world transforms.

### F. Python scientific packages

| Domain | Preferred tools | What Luna should use them for |
|---|---|---|
| Common | FastAPI, Pydantic, NumPy, SciPy | Typed API, deterministic scientific processing |
| Surgical | Existing MMDetection / SurgLatentGraph / CVS-AdaptNet adapters | Actual model operations only if checkpoints/deps verified |
| Dose | OpenKBP code, NumPy, SciPy, scikit-image optional | CT/dose reconstruction, geometry checks, DVH, mesh generation |
| Acoustic | SciPy.signal, soundfile optional, scikit-learn | Signal features, PSD, filters, patient-grouped evaluation |
| Reproducibility | MLflow (optional) | Long-form training experiments and run metrics |
| Tests | pytest, Vitest, Playwright | Scientific values, API, and real UI flows |

No neural network output may be faked. Older research runtimes remain isolated in locked Python environments/containers. No automatic running of untrusted checkpoints.

### G. Agent coding skills for Luna XHigh

| Skill / instruction | Link | When to invoke | Status |
|---|---|---|---|
| Official shadcn skill | https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/SKILL.md | UI composition, registry use, semantic tokens | RECOMMENDED |
| Vercel React best practices | https://github.com/vercel-labs/agent-skills | Bundle splitting, data fetching, rendering performance | RECOMMENDED |
| Vercel web-design-guidelines | https://github.com/vercel-labs/agent-skills | Accessibility/responsive/visual QA | RECOMMENDED |
| UI/UX Pro Max | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | Theme generation and UX evaluation | OPTIONAL; do not override MEDFORGE design tokens |
| Magic UI skill/reference | https://github.com/magicuidesign/magicui/tree/main/skills | Motion design and component suggestions | OPTIONAL academy-only |
| Cornerstone agents/skills examples | https://github.com/cornerstonejs/cornerstone3D/tree/main/.agents/skills | Viewer patterns and source investigation | REFERENCE; verify current tree |

**Skill security:** Agent skill files are executable instructions to an agent, not inherently trustworthy packages. Inspect their contents, trust only reviewed/pinned revisions, and never grant a skill implicit authority to run install scripts or overwrite the product architecture. Do not install every skill at once. For Luna, maintain a LOCAL `AGENTS.md` / `.agents/skills/medforge/` project contract that overrules external design aesthetics on scientific and safety questions. Installation instructions depend on the agent environment; no skill has been installed by this document.

## What belongs where: product-by-product selection matrix

| Product screen | UI and chart toolkit |
|---|---|
| Studio home/case library | shadcn + TanStack Query + accessible table/search/filter |
| SurgiVision playback | HTML5 video or frame explorer + react-konva overlay + shadcn inspector |
| SurgiVision model metrics | Recharts/Plotly depending metric and scale |
| DoseTwin CT crosshairs | verified custom grid renderer or Cornerstone3D adapter |
| DoseTwin 3D anatomy | R3F + Drei from verified organ mesh artifacts |
| DoseTwin DVH / comparison | Recharts for modest curves; Plotly when brush/export demanded |
| FistulaGuard signals | uPlot + synchronized selection state |
| FistulaGuard audio | WaveSurfer + region/spectrogram plugins where compatible |
| Academy paths | shadcn + Trophy UI + Motion + optional carefully selected React Bits |
| Educator Builder | dnd-kit; React Flow only for later branching workflows |
| Resizable science workspace | React-Grid-Layout when base presets pass QA |
| Hospital workflows/integration | NHS patterns + Medplum/FHIR inspiration; full patient EHR deferred |

## Concrete adoption tests before lock

- React 19 + Vite/Tailwind v4 package compatibility and TypeScript build.
- Chart label/axes correctness, accessible tabular alternative and PDF/PNG export fidelity.
- Recharts v3 and shadcn chart variant alignment; do not mix Radix/Base UI chart examples blindly.
- uPlot 100k+ demo points with sync and resampling tested on typical laptop.
- WaveSurfer + browser audio codec and units tested on a permitted real research sample.
- Cornerstone/R3F geometry orientation tests on known 3D phantom case.
- React-Grid-Layout resizing a 3D canvas while retaining pointer controls.
- Trophy component local integration, design token consistency, keyboard and reduced-motion.
- Separate artifact licensing review and third-party safety/license checks before redistribution.

## Ranked implementation recommendation

**Essential now:** React + Vite + shadcn; TanStack Query/Zustand; Recharts; WaveSurfer/uPlot; selected scientific viewer; reproducible FastAPI science; semantic healthcare design patterns. **Add if time:** Trophy UI mission progress, Motion, limited draggable educator cards. **Later:** Reorderable/resizable full dashboard layouts, React Flow workflow authoring, full OHIF/DICOM integration, Medplum/FHIR clinical integration, elaborate 3D academy worlds.

## Citation/source ledger

- Trophy UI https://github.com/SpartanDavie/trophy-ui
- shadcn chart https://ui.shadcn.com/docs/components/base/chart
- OHIF 3.11 https://docs.ohif.org/3.11/
- Cornerstone https://github.com/cornerstonejs/cornerstone3D
- ECharts https://echarts.apache.org/en/index.html
- Plotly https://plotly.com/javascript/
- uPlot https://github.com/leeoniya/uPlot
- WaveSurfer https://github.com/katspaugh/wavesurfer.js
- React Grid Layout https://github.com/react-grid-layout/react-grid-layout
- dnd-kit https://dndkit.com/react/quickstart/
- React Flow https://reactflow.dev/
- R3F https://github.com/pmndrs/react-three-fiber
- react-konva https://github.com/konvajs/react-konva
- NHS Design System https://service-manual.nhs.uk/design-system/
- Medplum https://github.com/medplum/medplum
- Agent skills https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/SKILL.md and https://github.com/vercel-labs/agent-skills
- UI UX Pro Max https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- tldraw license https://tldraw.dev/pricing

---

## v0.4 research addendum — verified education-system primitives (2026-10-09)

This addendum supplements the existing v0.3 recommendations. **Updated official Trophy UI source:** https://github.com/trophyso/ui and https://ui.trophy.so/docs ; the earlier `SpartanDavie/trophy-ui` URL is not the preferred canonical source. Trophy UI components are reusable React/shadcn display primitives and can be fed by our own authorized grading/XP backend; a Trophy SaaS account is **not required to render those components**. Documentation indicates React 18+, Tailwind v4 and shadcn setup: https://github.com/trophyso/ui/blob/main/README.md .

**dnd-kit (linear Builder P1/P2):** the current React sensor guide explicitly supports pointer and keyboard defaults, so drag-reorder must preserve KeyboardSensor when customizing sensors: https://dndkit.com/react/guides/sensors/ . Implement `Move up/down` buttons as a direct alternative to drag.

**React Flow (branching P3):** official docs show save/restore and validation; not part of P0. Use a typed acyclic graph validator if branching is implemented later: https://reactflow.dev/examples/interaction/save-and-restore ; https://reactflow.dev/examples/interaction/validation ; https://reactflow.dev/examples/interaction/prevent-cycles .

**H5P (reference, not import as engine):** Branching Scenario demonstrates branching content and feedback; embedding it would not inherently provide our special medical viewer contracts, provenance or hidden-answer policy: https://h5p.org/branching-scenario . Avoid a second separate authoring runtime for MVP.

**LMS integration P3:** 1EdTech LTI Advantage supports Assignment and Grade Services, Deep Linking and Names/Role Provisioning; plan this as a future authenticated adapter, not a quick grade-push endpoint: https://www.1edtech.org/standards/lti/suggested-lti-advantage-requirements-rfps and https://standards.1edtech.org/lti/guides/implementation_guide/implementation-guide . Open edX documents LTI as a stable learning-content extension: https://github.com/openedx/openedx-platform/blob/master/docs/concepts/extension_points.rst .

**Healthcare/EHR inspiration, not MVP dependency:** Medplum is an open-source FHIR-based headless EHR with React components, but MEDFORGE presently uses unrelated published research datasets; do NOT install an EHR stack for a simulated hospital shell: https://www.medplum.com/docs .

**Clinical content governance:** NHS health content standards call for documented clinical approval, review cycles, accessibility and publisher transparency. Use those as editorial process inspiration, not NHS branding/approval claims: https://service-manual.nhs.uk/content/standard-for-creating-health-content .

**Current recommended slice:** shadcn + Motion + Trophy presentation; dnd-kit only when ordered blocks require it; React Flow/H5P/LTI/FHIR deferred until corresponding product needs are verified.
