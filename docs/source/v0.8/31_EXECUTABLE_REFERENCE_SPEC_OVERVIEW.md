# 31 — Executable Architecture Reference v0.8 (PRE-LOCK)

## Purpose
Convert MEDFORGE v0.3–v0.7 into an executable **contract-first** reference. This is not a full application nor authorization to modify a user's repo. The stable product scope is **three scientific specialties + three user experiences + shared evidence layer**. Do not remove feature-parity inventory items due to missing dependencies.

## What the reference actually does
| Contract | Artifact | Verified scope |
|---|---|---|
| Database | `reference_impl/db/migrations/0001_init.sql` | SQLite migration parses; foreign keys enabled; 21 required tables exist |
| API | `reference_impl/apps/api/app/main.py` | Local GET modules/cases/viewer/model manifests, model readiness blocked, one synchronous case summary operation |
| Schema | `reference_impl/apps/api/app/schemas.py` | Strict Pydantic models, discriminated asset union |
| OpenAPI | `reference_impl/contracts/openapi-implemented.json` | Generated 3.1, 9 routes, 15 component schemas; no speculative routes disguised as implemented |
| Scientific adapter | `reference_impl/apps/api/app/openkbp.py` | OpenKBP sparse CSV load, exploratory summaries; inherited synthetic-unit validations from v0.7 |
| Selection | `reference_impl/packages/contracts/selection.ts` | Typed selection state; not yet React typechecked |
| QA | `reference_impl/apps/api/tests/test_contracts.py` | Synthetic case contract tests; no real source model executed |

## Scope hierarchy
1. **Frozen product direction:** SurgiVision/DoseTwin/FistulaGuard as independent workspaces; Academy/Educator/Professional perspectives; shared case, artifact, model, job, learning and report backbone.
2. **Implemented reference:** narrow runnable contract/test examples. Local-only; not publicly hosted.
3. **Advanced planned:** 3D viewer, worker queues, real model runs, study publishing, authentication, full research parity; explicitly **not implemented** by this reference.

## One major nonnegotiable: no fake clinical outputs
Synthetic fixtures used in unit tests are tagged `synthetic-test` at every level and not seeded into normal case searches. Real case registration requires setting the path explicitly and independently verifying origin/license. Current summary metrics are exploratory and MUST NOT be relabeled as validated clinical constraints.

## Source of truth
- Upstream pinned repository commits remain documented in `17_REPOSITORY_FEASIBILITY_AUDIT_2026_10_09.md`.
- Later documented decisions override older recommendations where they conflict, without deleting old design rationale.
- Scientific fidelity, licenses and security requirements override decorative UX decisions.
- Planned OpenAPI endpoints outside the current runnable subset are in `33_API_ENDPOINTS_ERRORS_AND_EXAMPLES.md`, clearly marked planned.
