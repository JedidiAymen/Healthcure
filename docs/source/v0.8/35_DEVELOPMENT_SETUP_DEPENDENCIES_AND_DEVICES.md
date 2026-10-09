# 35 — Developer setup, dependency plan and hardware gates

## Verified local reference environment
The included reference harness was **executed** with Python and package versions listed in `reference_impl/apps/api/requirements*.txt`:
- FastAPI 0.128.2, Pydantic 2.13.5, NumPy 2.3.5, Uvicorn 0.48.0, HTTPX 0.28.1 and pytest 9.0.2.
- Node v22.16.0 / npm 10.9.2 were observed, but **no** React/Vite/Cornerstone bundling was run in this v0.8 reference.
- These are reproducible *tested reference harness* pins; NOT the validated combined medical-model stack, and NOT a promise the app will use these exact versions after integration.

## Installation
See `reference_impl/README.md`. Local API must bind to `127.0.0.1` only because auth/RBAC are not implemented. The `MEDFORGE_OPENKBP_CASE_DIR` variable points to an existing, authorized local case folder; otherwise cases remains empty.

## Target application architecture (not implemented here)
```text
medforge/
  apps/web/                      # React 19, Vite, Tailwind 4, shadcn/ui
  apps/api/                      # FastAPI platform and schema generation
  packages/contracts/           # generated OpenAPI TypeScript + shared selection types
  workers/surgical/             # isolated pinned PyTorch/MMDetection runtime
  workers/dose/                 # pure data/metrics and OPTIONAL solver adapters
  workers/acoustic/             # signal processing, later model validation
  datasets/                     # metadata and license manifest only
  data/                         # gitignored local files, or mounted storage
  docs/                          # architecture, parity, QA, demos, provenance
```

## Frontend dependency approval matrix
| Family | Candidate | Can lock immediately? | Pass criterion |
|---|---|---|---|
| Core UI | React 19 + Vite + TypeScript + Tailwind 4 + shadcn/ui | Direction locked; **versions not runtime tested** | Vite build, TS check, CSS, responsive and keyboard navigation |
| Standard charts | Recharts via shadcn charts | Candidate | Correct units, tooltip/readout, no invented demo metrics |
| Volume view | Cornerstone3D or validated custom array renderer | Conditional | Render real OpenKBP array in 3 orthogonal orientations with correct source-index mapping |
| 3D anatomy | React Three Fiber | Conditional | Mesh axes, scaling and ROI selection pass real-data geometry tests |
| Signals | uPlot + WaveSurfer.js where appropriate | Conditional | 100k+ sample responsiveness; channel cursors and genuine audio alignment |
| Panels | React-Grid-Layout | Conditional | Resizable, keyboard fallback, no overlap/overflow |
| Educator blocks | dnd-kit | Conditional | Keyboard reorder, persisted blocks and stable identifiers |
| Gamification | Trophy UI / own XP ledger | Conditional | Accessible components, server-authoritative XP, duplicate prevention |
| Animation | Motion | Low priority | Reduced motion respected, no scientific values animated misleadingly |

Do **not** mix giant UI frameworks or force full OHIF into OpenKBP before a comparison spike. Decide exact library version after a clean install on the chosen Node toolchain and a minimal bundle test; commit lockfile and results to `TECH_LOCK.md`.

## Worker readiness matrix
- SurgLatentGraph needs a separate GPU/graph stack and model checkpoint validation. Pin upstream SHA in `17` before modifying source.
- CVS-AdaptNet's test script contains `.cuda()` calls; CPU support is **not** established.
- OpenKBP metrics can be CPU-first. Archived dose predictions may not be downloaded until separately acquired.
- OpenKBP-Opt original solver uses `GUROBI_LP`; don't claim optimization readiness without a working solver and license.
- PortPy carries Commons Clause restrictions; review exact permissible use and solver/data compatibility.
- FiSaV raw recording access remains unverified; feature-only data are not raw signals.

## Hardware inventory for Luna
Run and record `python --version`, `node --version`, RAM, available disk, CPU, OS, presence of NVIDIA driver/GPU and available VRAM. Set readiness accordingly. Offline jury demo must not require a large model download, a third-party token or a network API call.
