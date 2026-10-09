# 37 — Test matrix and evidence taxonomy

## Do not conflate these levels
| Level | Meaning | Current proof |
|---|---|---|
| `DOC` | Design/roadmap specified | v0.3–v0.8 Markdown |
| `SOURCE` | Public repo source/readme inspected | v0.6–v0.7 feasibility audit and pinned commits |
| `SCHEMA` | SQL and API models parsed/generated | `reference_impl/scripts/check_sql_schema.py`, generated OpenAPI |
| `SYNTHETIC_TEST` | Local synthetic fixtures passed actual tests | `reference_impl/apps/api/tests` |
| `REAL_DATA_PARSED` | Authenticated source case fully loaded locally | **Not independently established in this v0.8 harness** |
| `OFFICIAL_METRIC_MATCH` | Numerical output matches upstream benchmark evaluation | **Not verified** |
| `MODEL_EXECUTED` | Installed, pinned checkpoint executed with actual compatible input | **Not verified** |
| `UI_INTEGRATED` | Scientific viewer sync exercised in browser | **Not verified** |
| `USER_AUTHZ_TESTED` | Real access controls including grading secrets | **Not implemented** |
| `CLINICAL_VALIDATED` | Appropriate clinical validation/approval | **Not claimed** |

## Reference checks
```bash
cd reference_impl
python scripts/check_sql_schema.py
python -m pytest -q apps/api/tests/test_contracts.py
python scripts/export_openapi.py
# inherited v0.7 validator tests live at parent package path:
cd ..
python -m pytest -q tests/test_openkbp_case.py
```
In the reference test, case `test-synthetic-case` is auto-created in an isolated temporary directory, tagged `synthetic-test` throughout and never advertised as genuine research. Tests check read-only catalog, readiness, manifest geometry, deterministic dose-summary output, run idempotency, input validation and OpenAPI route generation.

## Mandatory real research gates for Luna
| Gate | How to establish | Claim permitted when green |
|---|---|---|
| OpenKBP source | Acquire `pt_201` from pinned official source, file hashes, source license documented | Real benchmark case loaded |
| OpenKBP numerical | Match benchmark-specific published evaluation semantics and selected expected metrics within justified tolerance | Reproduced research metric |
| Endoscapes | Obtain licensed original sample frames + COCO annotations, verify overlay numerically and visually | Genuine surgical annotation review |
| CVS checkpoint | Download authorized checkpoint, audit dependencies, execute pinned code on test case, record deterministic output | Live published-model inference |
| FiSaV/alternate signal | Obtain legal raw samples, verify channels and patient-level splits | Real vascular acoustic analysis |
| React 19 stack | Clean install, TS check, build, keyboard/responsiveness smoke and scientific linked-view tests | Integrated scientific UI |
| Educator/Academy | RBAC, server-side answer isolation, immutable lesson, grading+award idempotency | Working multi-role learning loop |
| Demo offline | Cold start on intended jury machine without external network | Reproducible local demo |

## CI design
- PR A: formatter/typecheck/schema/test; no raw media or checkpoints in Git.
- PR B: canonical backend OpenAPI generation, diff-based API contract checks, typed frontend generation.
- PR C: tiny real-source fixture hashes (not redistribution) and bounded numerical checks.
- PR D: browser smoke/screenshots for scientific selection and graceful blockers.
- PR E: role/security tests before public exposure.

Passing reference tests **never implies** a complete scientific pipeline has been validated.
