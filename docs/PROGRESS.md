# Progress and handoff (2026-10-10)

Branch `upgrade/hackcure-compliance`. All numbers below come from runs on 2026-10-10 on the Windows demo PC.

## Follow-up on the current local integration (2026-10-10)

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
- The offline queue is covered by unit tests and the server-side degraded check above. No browser e2e of the offline mission flow yet.
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
