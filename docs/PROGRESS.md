# Progress and handoff (2026-10-10)

Baseline branch `upgrade/hackcure-compliance`; its recorded Windows-demo results below are the integration baseline. UX-46 and subsequent follow-up notes are on `feat/experiments-run-workspace`.

## Follow-up on the current local integration (2026-10-10)

- UX-46 closes the offline Academy browser-coverage gap. In the production app shell, a synthetic-only learner submission survives offline reload, remains queued after an unauthenticated replay attempt, then submits once after sign-in with the original idempotency key. The production-preview browser test passes (1); frontend unit tests pass (68), the ordinary browser suite passes (20), and lint/typecheck/build pass. The workflow now builds before running this service-worker test and excludes it from the dev-server browser suite. No patient or research data is used by this fixture. Details: [`PR-UX-46`](ui/PR-UX-46-offline-submission-recovery.md).
- UX-45 adds an installed-source keyboard pass for global search, FiSaV, SurgiVision annotated frames and the Educator source picker. The focused `@source` browser test passed (1 test) for ArrowDown/Enter selection and Escape cancellation with selected-source and focus checks; it uses existing FiSaV and Endoscapes records. See [`PR-UX-45`](ui/PR-UX-45-source-selector-keyboard-access.md).
- UX-44 follows one authentic FiSaV lesson through Educator Studio, Student Academy and manual review in separate local browser sessions. The educator created a source-attributed lesson, accepted the displayed CC BY 4.0 terms, published and assigned it to the seeded local cohort. The student selected a measured PZT2 window, answered two questions and submitted; the educator reviewed the persisted source window and released an 88/100 manual grade with feedback; after signing in again, the student saw criterion scores, feedback and the educator reference. The `@source` browser E2E passed (1 test) against a fresh disposable database and authentic `fisav:pat001`. Mission, educator review and debrief captures at desktop/tablet/phone are local-only under `.local-review/UX-44-learning-loop/`; all checked without horizontal overflow. XP and achievements remained opt-in. See [`PR-UX-44`](ui/PR-UX-44-educator-student-review-loop.md).
- UX-43 verifies persisted Educator Studio block order end to end with a disposable educator profile and installed FiSaV source: keyboard-accessible move, pointer sorting, API save, page reload, reopening the saved draft, and learner preview response/UI. Learner preview preserves the two learner blocks in order and omits the educator Reveal block and rubric. Focused source E2E passed (1 test) and captured desktop/tablet/phone layouts without horizontal overflow; screenshots are local-only under `.local-review/UX-43-educator-order/`. It neither publishes the lesson nor changes product/API/data behavior. See [`PR-UX-43`](ui/PR-UX-43-educator-order-persistence.md).
- UX-42 gives Experiments separate Configure analysis and Run history views while preserving run deep links, source metrics, report persistence and local research boundaries. An isolated browser run against authentic installed `pt_201` completed the OpenKBP summary, verified returned source hashes, and saved an evidence report with the same run ID and input hashes. Configure and result/history views were captured at 1440×900, 1280×800, 768×1024 and 390×844 with no horizontal overflow. Focused route and real-source browser checks each passed; see [`PR-UX-42`](ui/PR-UX-42-experiments-run-workspace.md).
- The DoseTwin browser research-review gap listed below has since been closed on the current local integration. `npx playwright test tests/e2e/dosetwin-comparison-report.spec.ts --grep @source` passed (1 test, 15.4s) against an isolated local API profile and the authentic OpenKBP `pt_241` prediction. It verified educator sign-in, import and same-case comparison, voxel evidence, required rationale, persisted review provenance/source hash/audit hash, the research-only boundary, and the existing saved report. Desktop, tablet and phone captures are ignored under `.local-review/DOSETWIN-RESEARCH-REVIEW/`.
- The check requires `MEDFORGE_E2E_RESEARCH_USERNAME` and `MEDFORGE_E2E_RESEARCH_PASSWORD` for a locally provisioned educator; keep `@source` tests out of ordinary CI unless CI provisions the source data and isolated profile. `npm run lint`, `npm run typecheck`, and `git diff --check` all passed for this follow-up.

## Check results

| Check | Command | Result |
|---|---|---|
| API tests | `apps/api/.venv/Scripts/python.exe -m pytest -q apps/api/tests` | 139 passed, 1 skipped |
| Frontend unit tests | `npm run test` | 67 passed (20 files) |
| Lint, typecheck, contracts, build | `npm run lint`, `npm run typecheck`, `npm run contracts:check`, `npm run build` | all exit 0 |
| Overclaim check | `python scripts/check_claims.py` | No unsupported claims found |
| Browser tests | `npx playwright test --grep-invert @source --workers=2` | 17 passed, 2 failed (see below) |
| TLS | `node scripts/check-tls.mjs` | PASS TLS 1.3 negotiated; PASS TLS 1.2 refused (curl exit 35) |
| Encryption at rest | `node scripts/check-db-encryption.mjs` | PASS no plain SQLite header; PASS unreadable without key; PASS `storage_encryption=sqlcipher-aes-256` |
| Read-only datasets | `touch /datasets/write-test` inside api container | refused: Read-only file system |
| Simulated telemetry | `docker compose --profile device up -d sim-device`, then GET `/api/v1/telemetry/devices` via proxy | connected; 156 frames, 0 CRC failures, 2 missing frames (simulator injects a 1% drop rate) |
| Degraded mode | `docker compose stop api` | web `/` 200, `/sw.js` 200, `/api/v1/modules` 502 (treated as offline by the queue); 200 again after `docker compose start api` |

## Known failures and gaps

- The 2 failing browser tests (DoseTwin case picker, SurgiVision sidebar at tablet width) also fail on upstream `main` at `2e64fbd`. They were not introduced by this branch.
- Upstream `main` moved to `64bc4d6` (4 commits: Model Lab registry, case registry preview, chart docs, Academy paths). **Not merged into this branch yet.** Merge it, regenerate contracts (`npm run contracts:check`), and rerun the suite.
- In Docker, SurgiVision shows "requires setup": the Endoscapes download is partial (about 3.4 GB on disk) and `MEDFORGE_ENDOSCAPES_ROOT` is not set in compose. Resume `scripts/acquire_endoscapes_full_release.py`.
- The offline queue now has a production-shell browser E2E. The API suite passes in an isolated Python 3.12 validation environment: 143 passed, 2 skipped. The attached Python 3.14 environment remains without SciPy; CI uses Python 3.13 and installs the locked API requirements.
- The original Windows handoff did not include a browser e2e for the DoseTwin research-review panel; the current local integration now has the source-backed check described above (API behavior remains covered by `test_research_review.py`).
- Telemetry and research reads are anonymous on the local stack, like the existing research reads; students are scoped by middleware, and writes require educator or admin.
- Not done: grading prefill to 3 steps (compliance row 20), Playwright step-count tests, French UI, model card, `docs/EXTRA_FEATURES.md`, FiSaV risk index (protocol frozen at v1.1, not run).

## What this branch added since `bfd131e`

- DoseTwin research review: voxel inspector, immutable decisions with frozen evidence and hashes, audit log entry, JSON and FHIR R4 export (validated against the official schema).
- Provenance badges (SOURCE_BENCHMARK, ARCHIVED_PREDICTION, RULE_BASED_METHOD, IN_APP_MODEL_INFERENCE).
- Simulated MQTT device (Mosquitto plus `workers/sim-device`), framed with CRC32 and integrity counters, clearly labelled as simulated.
- FistulaGuard signal quality checks.
- Account data export and erasure (pseudonymisation).
- Offline mode: IndexedDB drafts, queued idempotent submit with replay, offline banner, app-shell service worker.
- Docker: prebuilt web dist, pip retries, `scripts/docker-build.mjs`, `scripts/check-db-encryption.mjs`.
- Docs: README rewrite, DECISIONS, L3 dossier, defense sheet, data inventory, demo data policy.
