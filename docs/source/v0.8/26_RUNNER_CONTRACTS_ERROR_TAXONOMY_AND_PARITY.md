# 26 — Worker and capability contracts (v0.7)

## Problem
PyTorch/MMDetection CUDA, TensorFlow OpenKBP legacy code, OR-Tools/Gurobi, SciPy acoustics and React scientific viewers do not belong in one process. An adapter isolates each implementation and yields typed immutable artifacts.

## Capability registry
```json
{
  "id": "surgivision.cvs_adaptnet.infer",
  "module": "surgivision",
  "operation": "inference",
  "source": {"repository": "CAMMA-public/CVS-AdaptNet", "pinned_commit": "bb21ffbd781b6f943be0daaeeccf1567c21e691d"},
  "inputs": ["endoscapes.frame", "model.checkpoint"],
  "output_schema": "cvs-criteria-v1",
  "implementation_status": "source-available",
  "readiness": {"can_run": false, "missing": ["verified-checkpoint", "verified-runtime", "real-inference-test"]}
}
```
The example is documentation only. Readiness must be computed at runtime based on machine, case and permission.

## Standard readiness statuses
- `READY` — tested code, weights, compatible data and runtime are available now.
- `SOURCE_AVAILABLE` — implementation exists upstream but execution is not established.
- `REQUIRES_DATA` — dataset/asset not present.
- `REQUIRES_WEIGHTS` — model checkpoint missing or unverified.
- `REQUIRES_RUNTIME` — GPU, CUDA or dependency environment unsupported.
- `REQUIRES_SOLVER` — optimization backend/license missing.
- `LICENSE_REVIEW` — data redistribution/display not approved.
- `BLOCKED` — no legal/technical execution path at present.

Do not conflate `capability_exists` with `can_run`.

## Job API
```http
POST /api/v1/runs
Content-Type: application/json
Idempotency-Key: <opaque-client-key>

{
 "caseId":"openkbp:validation:pt_201", "toolId":"dosetwin.roi_metrics.v1",
 "artifactIds":["openkbp:pt_201:dose","openkbp:pt_201:Brainstem"],
 "parameters":{"roi":"Brainstem","histogramBinGy":0.1},
 "expectedDatasetVersion":"openkbp:2021"
}
```
The server validates module, case, immutable inputs, roles, artifact permissions, geometry, typed parameters and runtime readiness before enqueueing. Path traversal and arbitrary user-defined Python or shell commands are rejected.

`Run`: `queued -> running -> completed | failed | cancelled`. Failure can also occur from `queued`. Idempotency key prevents unintended repeated compute. Cancellation best-effort, preserve partial logs and never publish incomplete artifacts as completed.

`Artifact`: contains `id`, `sha256`, `mimeType`, `sizeBytes`, `producerRunId`, `sourceKind`, `licenseRecordId`, `units`, `geometry`, and file/stream access handle. Never put 128³ float arrays into ordinary JSON response.

## Error responses
- `ASSET_MISSING`: show source and acquisition steps.
- `INCOMPATIBLE_GEOMETRY`: case, origin, spacing/shape mismatched; offer no comparison.
- `MODEL_WEIGHTS_MISSING`: model card shows instructions and source link.
- `RUNTIME_UNAVAILABLE`: report concrete CUDA/CPU/solver requirements.
- `DATA_LICENSE_BLOCKED`: hide/restrict media but preserve documentation and attribution.
- `INVALID_UNITS`: reject scientific math instead of guessing units.
- `EVALUATION_LEAKAGE`: reject split when same subject/video contributes to train and test.
- `RESULT_STALE`: computed artifact hash does not match current input.
- `INSUFFICIENT_METADATA`: disable unsupported acoustic processing or physical coordinate display.

## Research adapter matrix
| Adapter | Environment | Core P0 | Later preserved |
|---|---|---|---|
| `openkbp-csv` | NumPy/SciPy | sparse array load, ROI metrics, DVH | archived comparisons, official benchmark replay |
| `surgical-coco` | Python/NumPy/pycocotools | original annotations | segmentation overlays, temporal labels |
| `cvs-adaptnet` | isolated PyTorch/CUDA | verify readiness, optional inference | testing/training variants |
| `surg-latent-graph` | isolated PyTorch/CUDA/DGL/MMDetection | inventory | detector/segmentation/CVS/temporal training and evaluation |
| `openkbp-opt` | isolated OR-Tools/Gurobi | source inventory | research optimization jobs |
| `portpy` | isolated scientific solver environment | source inventory | IMRT/VMAT research planning, import/export after licenses |
| `vascular-signal` | SciPy/NumPy | quality, FFT/PSD on real compatible inputs | classifier, group evaluation, multichannel correlations |

## Reproducibility
Pin upstream commit and environment lock. Hash raw datasets, model checkpoints and output artifacts. Record operations with parameters, random seeds, evaluation protocol, code revision and worker environment. Inferences/metrics aren't reproducible if a reference artifact silently changes.

## Parity implementation checklist
For every documented upstream model family, log: source file, source revision, task, required data, weights, runtime, supported input shape, expected output, MEDFORGE API endpoint, frontend viewer/panel, numerical comparison method, status, next action, owner. Update on every PR. No feature removal by omission.
