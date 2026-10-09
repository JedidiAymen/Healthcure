# 04 — EXECUTION/QA: SMALL PRs, NO REGRESSION, REAL PRODUCT SCREENSHOTS

## Audit baseline before changes

At audited SHA `8eee990`, repo has 277 tree entries, React 19 / Vite 8 / Tailwind 4, no committed `package-lock.json` or `.github/workflows`. `README.md` requires `npm ci`, therefore fresh setup is inconsistent. The repository documents local 17 frontend and 30 API passing tests and 1,933 Endoscapes frames / 59 FiSaV recordings / OpenKBP pt_201; those files are **not committed** and these tests are **not independently executed by this design audit**. Before opening PR run `git status`, `git rev-parse HEAD`, baseline tests and a local `doctor` output. Save baseline results privately.

## Ordered PR sequence

| PR | Scope | Files expected | Must prove |
|---|---|---|---|
| UX-00 | **Bootstrap / lockfile / CI** | `package-lock.json`, `.github/workflows/ui-and-api.yml`, `README.md`, `RUN_LOCAL.md` | fresh `npm ci` on clean clone; lint, typecheck, Vitest, API tests, build; no private data required |
| UX-01 | **B tokens / role shell / genuine component lab** | `src/styles.css`, `src/components/Shell.tsx`, scoped theme CSS, component playground, `docs/ui/library-spikes.md` | 1440/390 screenshots; correct role navigation; keyboard/focus; installed vendor component demos and license notes |
| UX-02 | **DoseTwin** | `src/pages/DoseViewer.tsx`, `src/features/dose/*`, relevant tests | 500px+ main image when sufficient width; same 128³ voxel transforms, DVH values, ROI selection; smoke+23 official metrics on configured data |
| UX-03 | **Surgery + signal** | `SurgiViewer.tsx`, `FistulaViewer.tsx`, components, tests | 2 real surgery frames overlays+mask hit regions; 2 FiSaV records waveforms+PSD+time+hash; report persistence |
| UX-04 | **Academy + Educator** | `src/features/academy/*`, `LessonEditor.tsx`, `StudentLearningPath.tsx`, `src/features/educator/*` | Trophy widgets only for server-backed awards; learner mission actual viewer; source-safe educator publish, grade/review and no-answer leak |
| UX-05 | **Models/Experiments/Reports + polish** | models/experiment/report routes, optional React Flow, rest QA | source-bound job states; blocked reasons; real outcomes; all route screenshot diff and 390px no overflow |

Parallel work may proceed after UX-01 tokens. UX-02 can start alongside Academy feature development if the shared shell is stable. Every PR remains reviewable; do not lump app rewrite into one commit.

## Functional regression tests (non-negotiable)

1. **Backend 30-test suite** reported in repo: execute it, record actual count and result; add regressions for changed flows. No dropped/disabled tests.
2. **Frontend 17-test suite** reported in repo: execute it; pass all input preference parsers and surgical/dose/signal evidence tests. No test mocks counted as genuine research verification.
3. **OpenKBP:** on permitted installed `pt_201`, `python scripts/crosscheck_openkbp_pt201.py` still yields 23 source-metric parity checks; selected source arrays, ROI voxel, DVH must remain identical within evaluator tolerance; no clinical orientation made up.
4. **Endoscapes:** all installed source manifests verify; 1,933 frame counts and source COCO overlay correctness. Geometry test zoom=1 / zoom=2 / resized pane / mobile; selected source pixel bbox unchanged.
5. **FiSaV:** 59 recordings (if provisioned locally), same absolute window sample count and channel, original timestamps, matching source SHA; bounded PSD/spectrogram and selected comparison delta; no negative/unknown physical units made up.
6. **Learning:** student can't access private educator rubric/reveal pre-grade; unauthorized case/frame/channel denied; submission idempotency and grade retry still work; publication blocked when source rights unresolved.
7. **Security:** session split between roles, no cross-account cached answers; `127.0.0.1` host remains default until broader research-route authorization is actually implemented.
8. **Vendor adoption:** no new dependency without license and clean install proof; no fake source data in production app or snapshot PR screenshots.

## Browser visual acceptance

Required actual running Healthcure screenshots at desktop `1440×900`, laptop `1280×800`, tablet `768×1024`, phone `390×844`. Per role cover Home, DoseTwin, SurgiVision, FistulaGuard, models, experiments, academy path/mission, educator builder, reports. Screenshot must be source-backed and private if assets legally constrained. Capture DOM console errors, network failed requests, focus states, overlay taps, page overflow, reader accessible table. No horizontal document overflow; internal charts may scroll with explicit affordances where necessary.

### Professional acceptance

- Main source viewer larger than navigation and badges (if aspect permits). No 190px CT hero on desktop. Viewer shows focus mode, snapshot source provenance, selected coordinate/time, operations.
- Resize any resizable pane 3 times; numeric source cell/selection does not drift. After switching cases, stale viewer data is not displayed.
- Dose color overlay legend shows real dose scale, no pseudo-heatmaps; waveform PSD shows `unit unspecified` as necessary.

### Academy acceptance

- At least one **real permitted** educator→student→manual-grade→released-feedback run. Do not assume OpenKBP publishing is allowed; prefer authorized Endoscapes/FiSaV.
- Trophy badge only for a real server grant and opt-in enabled; `Achievement Unlocked` only once per new server award; when opted out, no XP display or grants.
- Keyboard and voice/screen-reader path through full mission; mobile 390×844 not cut off; progress path shows actual next action.

### Educator acceptance

- Drag via pointer *and* keyboard; order persists across refresh; student preview redacted; no accidental published revision update; app explains legal-source blockers inline.

## Performance guardrails

- Lazy-load specialized components; avoid frontpage loading Cornerstone, ReactFlow, surgical mask decoders or all 59 source signals. Import tests and visual-sandbox components only dev-side.
- Record entry bundle + route lazy chunks **before and after**. Reject obviously disproportionate bundle increase for a decorative element. Avoid full-res global source image fetch; use viewport selection and bounded API windows.
- `prefers-reduced-motion` honored. No animation on scientific curves or source overlays. No global CSS from vendor package unexpectedly overriding established components.

## Files produced by every PR

`docs/ui/PR-UX-XX.md`: why change, before/after screenshots (where permitted), vendor name+URL+version+license, actual commands/tests/results, screenshots at 4 viewports, checksums/semantics unchanged, new data-rights issues, open blockers. Mark `PASS/PARTIAL/BLOCKED` with cause. Never claim a browser review based on HTTP smoke alone.

## Stop conditions

If a library breaks source coordinate fidelity, leaks hidden answers, requires commercial terms unavailable, creates unreliable CORS/deployment, or materially balloons the UI bundle for no user benefit, **stop that specific adoption** and reuse existing proven components. Do not abandon the entire product and do not fake results to keep a pretty screenshot.
