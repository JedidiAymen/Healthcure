# 06 — HOW LUNA USES OFFICIAL SKILLS AND COMPONENT SOURCE MATERIAL

This is not a suggestion to blindly install everything. Start with the installed components and official vendor documentation. External agent skills are useful only if supported by Luna's runtime and project. Record installation/diff and verify actual output.

## Core skills / guidelines

| Skill or reference | Exact source | When to invoke | Evidence expected |
|---|---|---|---|
| shadcn agent skill | https://ui.shadcn.com/docs/skills | before adding/modifying shadcn/Base UI components; `npx skills add shadcn/ui` if permitted | `shadcn info --json`, inspect `components.json`, search registry, `add --dry-run` or `--diff`, confirm Base compatibility |
| Vercel web-interface / React guidance | https://github.com/vercel-labs/agent-skills | code reviews for responsive, accessibility, performance | list of actual reviewed findings, Lighthouse where available; no generic untested conclusions |
| Video.js agent skill | https://videojs.org/docs/framework/react/guides/build-with-ai | **only if** licensed continuous surgical video and time alignment available | `npx @videojs/cli agents init --framework react` prints version-matched options; validate v10 imports, media+skin, no v8 APIs |
| Cornerstone3D documentation | https://www.cornerstonejs.org/docs/tutorials/basic-stack/ and https://www.cornerstonejs.org/docs/concepts/cornerstone-core/imageloader/ | OpenKBP adapter experiment | pixel-index and physical-coordinate restrictions written down; side-by-side parity tests |
| React Flow UI official docs/templates | https://reactflow.dev/ui/templates/workflow-editor | real workflow graph spike only | Vite imports and license reviewed; graph nodes correspond to supported backend operations |
| Trophy UI source component docs | https://ui.trophy.so/docs/components | Academy skill level/achievement widgets | sample vendor component installed in sandbox + actual opt-in API mapping |
| Playwright visual snapshot docs | https://playwright.dev/docs/test-snapshots | each PR browser QA | before/after screenshot and stable CI environment with focus/error assertions |
| Storybook accessibility | https://storybook.js.org/docs/writing-tests/accessibility-testing | if time permits, component lab | computed accessible labels/keyboard interactions; dev-only bundle |

## Precise agent tool workflow

1. Read repo `package.json`, `components.json`, `src/styles.css`, `src/components/ui/`, and project source contracts; detect existing Base Nova/Radix conflict *before* adding registry components.
2. Check local `node_modules` and exact lockfile; install shadcn skill only if relevant agent supports it. Use shadcn CLI `info --json`, registry `search` and `view`, `add --dry-run`, then inspect **actual changed files** and dependencies.
3. For Trophy install only selected widgets, inspect source files and whether a third-party Trophy SaaS service is *required* by that widget. MEDFORGE should map existing API data directly without mandatory hosted telemetry or new data contract.
4. For React Flow, use current `@xyflow/react` imports per versioned documentation, not deprecated `reactflow` defaults. Do not clone Next.js editor wholesale.
5. For medical viewers, do source parity first, aesthetic after. Build a test matrix for CT index planes and COCO source image masks; no whole-media implied from sampled frames.
6. Code using semantic CSS tokens and existing shadcn primitives. Show real screenshots, not vendor marketing screenshots.
7. Test library independently and selectively merge. If it fails, record reason as `REJECT/DEFER`; do not keep broken dependencies around.

## Copyable component implementation requests to send Luna sequentially

**Trophy mini-task:** 'Inspect Trophy UI free MIT components, install only Achievement Badge, Achievement Grid and Achievement Unlocked in a dev component lab. Wire them to current API `academy/progress` and opt-in preferences. Do not create extra XP or fake achievements. Show screenshots of opt-in disabled, empty achievements and genuine earned achievement. Document bundle delta and license.'

**Dose viewer mini-task:** 'Redesign existing `DoseViewer.tsx` to a 500px+ hero viewport at desktop using semantic B theme, real `pt_201` from local loader. Two linked plane thumbnails, ROI inspector, docked cumulative DVH and table; keep existing source-array indexing and 23 official metrics. Prove click/pointer alignment at zoom levels and 4 screen sizes. Trial shadcn Resizable; revert if it breaks geometry. Do not imply patient orientation.'

**SurgiVision mini-task:** 'Render real Endoscapes BBox201 frame with original-pixel COCO boxes+RLE; add a source-frame inspector and searchable split browser, and separate CVS source labels from model prediction evidence. Do not create video controls without actual continuous footage. Capture comparison screenshots for frame `4_26200` and `13_46850` on owning dataset machine.'

**Model mini-task:** 'Use free React Flow UI building blocks in a sandbox only if steps map to executable backend analysis jobs. Render readiness, blocked input, job status and result provenance from current API. Include keyboard-accessible list view. If not enough executable steps exist, keep a beautiful list/detail model UI and defer flow graph.'

**Educator mini-task:** 'Recompose LessonEditor into 3-pane builder, preserve dnd-kit current typed block order, server lesson revisions, hidden learner answers/rubric, authorized source publishing, submission replay. Show author, learner-preview and grade-review screenshots including blockers.'

## Evidence controls

Do not reproduce vendor stock photographs, marketplace previews or screenshot imagery as MEDFORGE scientific data. Credit any icon/illustration asset licensed for use. Do not share source patient research data in a public PR screenshot, GitHub CI artifact or docs without rights approval. Keep local screenshot reports out of public tree if they expose controlled data.
