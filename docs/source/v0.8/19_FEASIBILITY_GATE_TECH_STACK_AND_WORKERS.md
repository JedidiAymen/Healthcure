# 19 — Runtime, frontend compatibility and worker isolation gates

## Gate IDs
| ID | Gate | How to check | Green | Fallback |
|---|---|---|---|---|
| FG-01 | OpenKBP full case acquired | run supplied validation script and verify CT/dose/mask indices and spacing | valid arrays, correct shape and numeric dose/ROI outputs | sample data acquisition instructions, no unverified DVH demo |
| FG-02 | Radiotherapy viewer geometry | compare known voxel indices/2D slices with reference, click mapping | no axis reversal, aligned ROI/dose, units explicit | 2D voxel-grid viewer (no 3D clinical orientation claims) |
| FG-03 | Endoscapes data acquired | parse official COCO, select 3 annotated frames | overlays exactly align, split preserved | source-info shell if blocked |
| FG-04 | CVS-AdaptNet inference | downloaded checkpoint hash, test.py patched/isolated for device portability, compare known result | real reproducible model output, no invented metric | reference annotation mode, model status UNAVAILABLE |
| FG-05 | OpenKBP-Opt predictions | download subset/archive, map patient/version to matching geometry, compare arrays | actual two-dose comparison | single genuine dose + DVH; no two-model comparison |
| FG-06 | FiSaV raw | verify DOI/repository, permissions, sample rates, labels; physically parse session | multichannel waveform and PSD on real data | truthful unavailable source state; no AVF classifier |
| FG-07 | React 19 stack | install exact packages, `npm ls`, `npm run build`, Playwright browser smoke | npm peer checks, no runtime errors on 1366x768 laptop | defer Cornerstone/3D, use basic 2D viewer |
| FG-08 | Workstation compute | `nvidia-smi`, `free -h`, `df -h`, OS/CPU; inference test | suitable model runtime for selected checkpoint | reference-only CPU-safe workflow |
| FG-09 | Rights/provenance | signed license manifest and approved demo paths | sources and distribution clearance recorded | do not publish restricted assets |
| FG-10 | End-to-end student mission | case load -> scientific interaction -> submit -> rubric -> reveal | stored auditable result, no answer leakage | ship educator-created ungraded case with explicit constraints |

## React 19 smoke test package guidance
- Bootstrap React 19 + Vite + TypeScript + Tailwind v4 + shadcn (pin versions AFTER build test).
- Prioritize `@dnd-kit/react` (modern documented API; do not mix legacy `@dnd-kit/core` examples), Recharts, a light 2D canvas viewer, and tested Trophy UI copied components.
- Conditionally add `uplot` for dense sampled waveforms; if acoustic is actual audio add `wavesurfer.js` with Regions/Spectrogram plugin. Remember raw vibration/force is not inherently calibrated audio.
- `@cornerstonejs/core` is optional until the `OpenKBP -> custom loader -> viewport` spike passes. Official Vite setup may need CommonJS/plugin and worker configuration when DICOM loaders are used; avoid installing DICOM-specific packages unless actually needed.
- React Three Fiber is optional for 3D mesh inspection; don't make it a prerequisite for correct axial slice navigation.
- React-Grid-Layout is optional after the fixed scientific workspace works; always have a fixed default layout and keyboard-safe alternatives.
- Use a single shared selection store keyed to `(module,caseId,activeArtifact,voxel|frame|tRange)` and don't allow cross-case stale state.

## Isolated runtimes
- `api-core`: FastAPI, Pydantic, SQLite; never load model weights or run untrusted optimization directly in request thread.
- `worker-dose-cpu`: numpy/scipy and CSV loaders; dose metric evaluation and preprocessing.
- `worker-surgery-cuda`: pinned PyTorch/MMDetection stack with trusted weights, GPU requirements, tested; Python 3.10 for CVS AdaptNet according to README.
- `worker-planning-solver`: separate OR-Tools/Gurobi/PortPy environment; explicit license and resource budget.
- `worker-acoustic-cpu`: numpy/scipy/scikit-learn, recorded preprocessing and patient-group CV; no clinical validation claim.

## Operational readiness logic
Readiness is not single global flag. Compute per `(module,operation,model_version,dataset/case,worker environment)` as a set of missing prerequisites. Values: `ready`, `reference-only`, `awaiting-data`, `missing-checkpoint`, `missing-runtime`, `incompatible-input`, `license-blocked`, `failed-health-check`. Only `ready` permits running model jobs. `reference-only` may open previously saved real source artifacts but never initiate live prediction.

## Browser smoke acceptance
Build and test at desktop widths 1366 and 1440, tablet 768, mobile 390. Verify keyboard focus and scientific viewer controls. For each module, load -> select -> switch tab -> come back, ensure restored coordinate/timepoint from case, no overlay misalignment, stale charts, or leaks of student answer payload. Put library version + lockfile SHA in final release note; no untested 'React 19 compatible' claim.

## Official references
- https://www.cornerstonejs.org/docs/getting-started/vue-angular-react-etc/
- https://www.cornerstonejs.org/docs/how-to-guides/custom-imageLoader/
- https://dndkit.com/react/quickstart/
- https://dndkit.com/react/guides/sensors/
- https://github.com/trophyso/ui
- https://github.com/katspaugh/wavesurfer.js
