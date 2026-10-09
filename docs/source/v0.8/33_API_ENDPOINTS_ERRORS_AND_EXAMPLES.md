# 33 — API contracts: implemented vs planned

**Only endpoints included in `reference_impl/contracts/openapi-implemented.json` exist in the reference harness.** The rest below are Luna's requirements, not fake existing endpoints.

## Implemented (local harness)
| Method + route | Result | Caveat |
|---|---|---|
| `GET /healthz` | Local reference ready; `public_deployment_ready=false` | Not a production readiness signal |
| `GET /api/v1/modules` | All 3 modules with accurate readiness | Scientific models remain blocked |
| `GET /api/v1/cases` | Installed case or `[]` | Never fabricates cases |
| `GET /api/v1/cases/{case_id}` | Case metadata or 404 | No auth; local only |
| `GET /api/v1/cases/{case_id}/viewer-manifest` | Dose artifact grid/spacing/source limitations | Does not serve data payload |
| `GET /api/v1/models` | Source model catalog + unverified status | No model execution |
| `POST /api/v1/models/{id}/validate` | `executable=false`, blockers | Deliberately fail-safe |
| `POST /api/v1/runs` | Actual local OpenKBP summary from installed CSV | Synchronous, exploratory; no GPU |
| `GET /api/v1/runs/{id}` | Stored run, hashes, calculations | Not authenticated |

The machine-readable OpenAPI file is generated from tested FastAPI code. Do not manually claim additional endpoints under `implemented`.

## Planned endpoints (authorization and handlers required)
| Route | Permission | Function |
|---|---|---|
| `GET /api/v1/datasets` | authenticated + dataset scope | Dataset listing/version/license |
| `GET /api/v1/assets/{id}` | dataset/case access | Authorized metadata and signed or proxied payload |
| `POST /api/v1/experiments` | researcher | Create immutable experiment spec |
| `POST /api/v1/experiments/{id}/runs` | researcher + compute quota | Submit genuine asynchronous job |
| `GET /api/v1/runs/{id}/events` | run owner/editor | SSE state updates |
| `POST /api/v1/runs/{id}/cancel` | run owner/admin | Request cancellation |
| `POST /api/v1/comparisons` | accessible compatible runs | Comparison artifact |
| `POST /api/v1/lessons` | educator | Draft lesson |
| `POST /api/v1/lessons/{id}/versions/{v}/publish` | authorized educator | Freeze validated version |
| `GET /api/v1/assignments/{id}/student-manifest` | enrolled student | **No secrets or reference labels** |
| `POST /api/v1/attempts/{id}/submit` | attempt owner | Idempotent submission |
| `POST /api/v1/attempts/{id}/grade` | server/authorized educator | Apply rubric, append grade event |
| `POST /api/v1/attempts/{id}/reveal` | authorized by reveal policy | Release permitted reference content |
| `POST /api/v1/reports` | case/run scope | Generate traceable report |

## Typed errors and HTTP mapping
| Code | Status | When | User-facing action |
|---|---:|---|---|
| `CASE_NOT_INSTALLED` | 404 | Uninstalled case | Choose installed case or configure authorized data |
| `MODEL_UNKNOWN` | 404 | Unknown model ID | Inspect model catalog |
| `MISSING_CHECKPOINT` | 409 | Weights unavailable | Verify published checkpoint and hash |
| `RUNTIME_UNAVAILABLE` | 409 | CUDA/library/solver missing | Configure appropriate isolated worker |
| `INCOMPATIBLE_INPUT` | 422 | Wrong modality, shape, sample rate | Select compatible data |
| `INVALID_RESEARCH_DATA` | 422 | Malformed sparse CSV or missing ROI | Validate and re-acquire from source |
| `LICENSE_RESTRICTED` | 403 | Not permitted use | Request authorized access |
| `NOT_AUTHORIZED` | 403 | Missing role/case access | Request permissions |
| `STUDY_ANSWER_HIDDEN` | 403 | Attempt to access grading secret | Submit before allowed reveal |
| `RUN_ALREADY_FINAL` | 409 | Mutating immutable result | Create a new run |
| `JOB_FAILED` | 500 | Scientific worker exception | Inspect logged failure, do not invent output |

## Example reference request
```bash
# Only after installing an authorized local OpenKBP case and running the API:
curl -s http://127.0.0.1:8000/api/v1/cases
curl -s http://127.0.0.1:8000/api/v1/models
curl -s -X POST http://127.0.0.1:8000/api/v1/runs \
  -H 'Content-Type: application/json' \
  -d '{"case_id":"openkbp:pt_201","operation_id":"openkbp.case_summary"}'
```
Do not make new routes return synthetic clinical predictions just to improve demo flow.
