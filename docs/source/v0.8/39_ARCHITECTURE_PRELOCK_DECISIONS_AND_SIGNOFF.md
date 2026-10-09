# 39 — Architecture lock decision record (v0.8 PRE-LOCK)

## Stable and recommended to freeze
| ADR | Decision | Why |
|---|---|---|
| ADR-001 | One MEDFORGE platform with three independent scientific specialties | No medically false patient linkage |
| ADR-002 | Separate Professional Studio, Academy and Educator Studio on shared evidence | One scientific truth with user-specific workflows |
| ADR-003 | Modular FastAPI API + dependency-isolated scientific workers | Legacy CUDA/solver/runtime conflicts |
| ADR-004 | One canonical Pydantic/OpenAPI contract to generate TS client types | Prevent API/UI drift |
| ADR-005 | Typed artifacts: surgical frames, dose volumes, acoustic signals | Geometry/units preserved |
| ADR-006 | File/object assets separate from relational metadata | Large binaries do not belong in DB |
| ADR-007 | Authentic data + provenance, no fabricated results | Medical research credibility |
| ADR-008 | Original upstream research tasks preserved in parity registry | Honor full-feature request while staging integration |
| ADR-009 | Research viewer-first and linked selections | Best user comprehension of data |
| ADR-010 | SQLite local prototype, scale to Postgres/object storage only when necessary | Fast reliable hackathon delivery |

## Not yet lockable
| Gate | Current evidence | Required evidence |
|---|---|---|
| G-01 Real DoseTwin | Official OpenKBP case files inspected, synthetic parser tests passed | Full downloaded source case, official metric cross-check, viewer render |
| G-02 SurgiVision models | Repo code/weight URLs inspected | Pinned weights downloaded, executed and verified on target hardware |
| G-03 FiSaV signal | Publication exists; raw access unverified | Legal raw recording source, channel metadata, usable labels |
| G-04 Frontend integration | Libraries identified, Node observed | Exact package version lockfile + real React19/Vite build and viewer performance test |
| G-05 Web security | SQL role data model planned | Authentication, RBAC, secret rubrics/grade endpoints and adversarial tests |
| G-06 Clinical claims | Project intentionally educational/research | No clinical claims; no medical-device certification asserted |
| G-07 Offline demo | Offline fallback plan specified | Run on jury laptop cold start without network |

## Decisions still requiring user review
- MEDFORGE as product name (working name rather than legally cleared trademark).
- Visual branding final colors and whether Academy features a lightweight Department Atlas.
- Exact hackathon MVP cutline if a real vascular dataset cannot be legally acquired.
- Whether optional MLflow/Postgres/MinIO are needed before first demo (recommended **no**).
- Whether to prioritize actual CVS inference over Academy workflow if limited GPU/time (recommended validated case/lesson first).

## Gate policy
**Product architecture can be provisionally frozen after user approval; scientific demo claims are locked per executed evidence.** Do not label the entire system `v1.0 locked` just because reference tests pass. Keep capability flags honest.

## Acceptance signoff record
- Design owner: user approval **pending**.
- Runtime verification: **partial** (reference Python schema/API tests only).
- External Git repository implementation permission: **not granted** by this draft.
