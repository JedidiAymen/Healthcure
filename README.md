# MEDFORGE

**Explainable clinical research review and education**, built for HackCure 2026.

MEDFORGE helps clinicians and trainees inspect real medical research evidence, see exactly where every number comes from, and record a responsible human judgement. It is research and education software. It is not a medical device, does not diagnose, and makes no treatment decisions. See [`docs/CLAIMS_AND_LIMITS.md`](docs/CLAIMS_AND_LIMITS.md).

## The problem and the flagship workflow

Reviewing candidate radiotherapy dose distributions is information-intensive, and AI-generated candidates make it easy to trust a number without checking where it came from. **DoseTwin**, the flagship, gives a reviewer one traceable workflow:

1. Open a same-case benchmark reference dose and an archived AI prediction. The prediction is badged **ARCHIVED PREDICTION, not MEDFORGE inference**.
2. Inspect slices, dose differences, per-structure DVHs, and a voxel-level difference inspector (reference Gy, prediction Gy, signed difference).
3. Record a research decision: *Accept for further expert assessment*, *Request revision*, or *Reject research candidate*. A rationale is required. The server freezes the evidence with every source hash. Records are immutable, and the decision is logged in a hash-chained audit log.
4. Export the review as an auditable JSON report or a minimal FHIR R4 bundle, validated against the official R4 schema and tagged as test data.

Every decision is **for further expert review, not for patient treatment**.

**Additional source-backed research and education workspaces:**
- **SurgiVision:** expert-annotated laparoscopic frames, annotator-disagreement filters, side-by-side compare, and a CVS self-check lesson block.
- **FistulaGuard:** measured FiSaV fistula recordings, zero-phase filters, ECG beat analysis, and a simulated telemetry device with frame integrity checks.
- **Academy and Educator:** lessons, cohorts, grading, and delayed debriefs.

The modules are independent evidence domains. Their datasets come from unrelated people and are never combined into one patient story.

## Architecture

```
 browser ──HTTPS (TLS 1.3 only)──▶ proxy (Caddy, local CA) ─┬─▶ web  (static React build)
                                                            └─▶ api  (FastAPI: business logic, roles, audit)
                                                                  │   SQLite + SQLCipher (AES-256) in the medforge-state volume
                                                                  │   research datasets mounted read-only from ./data
                                                                  └─◀ mqtt (Mosquitto, private network) ◀─ sim-device (SIMULATED sensor)
 worker (inference, on demand, no network) ── reads datasets read-only, writes /artifacts
```

- **Frontend:** `src/` (React 19, Vite, TypeScript, Tailwind, shadcn/ui).
- **API:** `apps/api/app/` (FastAPI, Pydantic). The OpenAPI contract generates the TypeScript types (`npm run contracts:check`).
- **Inference:** runs in isolated workers (`workers/`), never inside the API process.
- **Database migrations:** in `db/migrations/`, applied at start-up. Records that must not change are protected by triggers.

## Quick start with Docker (recommended, runs offline)

Prerequisites: Docker Desktop (or Docker Engine with Compose v2) and Node.js 22 or newer (for the helper scripts).

```sh
npm ci                                                # once: frontend dependencies (web image uses the static build)
node scripts/docker-build.mjs                         # once, while online: key (git-ignored, back it up), web build, images
docker compose up -d                                  # proxy, web, api, mqtt; works with no network afterwards
docker compose logs api | grep -A3 "New local accounts"   # demo educator and student passwords, shown once
```

Then open <https://localhost:8443>. The certificate comes from a local CA; to trust it, import `docker/certs/medforge-local-root.crt` after running the TLS check below.

| Task | Command |
|---|---|
| Prove TLS 1.3, and that TLS 1.2 is refused | `node scripts/check-tls.mjs` |
| Prove the database is encrypted at rest | `node scripts/check-db-encryption.mjs` |
| Start the simulated sensor | `docker compose --profile device up -d sim-device` |
| Stop everything | `docker compose down` (data stays in the named volumes) |

Datasets are read from `./data` on the host, which is mounted read-only. If a dataset is missing, its module shows "requires setup" instead of fake data.

## Local development install (Windows, macOS, Linux)

Requirements: Python 3.13 and Node.js 22.

```sh
python -m venv apps/api/.venv                      # Windows: py -3.13 -m venv apps/api/.venv
apps/api/.venv/bin/python -m pip install -r apps/api/requirements-test.txt
                                                   # Windows: apps\api\.venv\Scripts\python.exe -m pip install ...
npm ci
npm start                                          # API on 127.0.0.1:8000, web on 127.0.0.1:5173 (any OS)
node scripts/py.mjs scripts/seed_demo.py           # demo accounts, cohort and DRAFT starter lessons
```

`npm start` runs `scripts/dev.mjs`. It finds the venv on any OS and stops both services together. A detached watchdog stops them if the launcher is force-killed.

## Data acquisition

Each script downloads from the official source, verifies SHA-256 checksums, and writes to the git-ignored `data/` folder. Run any script with `--help` first. Check each licence before display; [`docs/DEMO_DATA_POLICY.md`](docs/DEMO_DATA_POLICY.md) says what may be shown where.

| Dataset | Script | Licence |
|---|---|---|
| OpenKBP `pt_201` (DoseTwin) | `scripts/acquire_openkbp_pt201.py` | No dataset licence; personal hackathon use only; lessons unpublishable |
| Endoscapes (SurgiVision) | `scripts/acquire_endoscapes_bbox201.py --split all`, `scripts/acquire_endoscapes_full_release.py` | CC BY-NC-SA 4.0 |
| Appendix300 clip (SurgiVision) | `scripts/acquire_appendix300_sample.py` (needs `ffprobe`) | CC BY 4.0 |
| FiSaV recordings and patient sheet (FistulaGuard) | `scripts/acquire_fisav_sample.py --all-recordings`, `scripts/acquire_fisav_patient_sheet.py` | CC BY 4.0 |

## Tests and checks

| Check | Command |
|---|---|
| API tests | `node scripts/py.mjs -m pytest -q apps/api/tests` (or the venv Python directly) |
| Frontend unit tests | `npm run test` |
| Lint and types | `npm run lint`, `npm run typecheck` |
| API contract drift | `npm run contracts:check` |
| Production build | `npm run build` |
| Browser tests (source-independent, as in CI) | `npm run test:e2e:ci` |
| Overclaim check | `node scripts/py.mjs scripts/check_claims.py` |

CI (`.github/workflows/ui-and-api.yml`) runs these on Ubuntu with Python 3.13 and Node 22.

## Security and privacy notes

- **In transit:** TLS 1.3 only, at the proxy. The API and broker are never published to the host.
- **At rest:** the app database is AES-256 encrypted with SQLCipher inside Docker. Research datasets, the key file and the local CA are **not** covered by this; use OS disk encryption on the demo PC.
- **Access:** local accounts use PBKDF2 password hashes and hashed, expiring session tokens. General research writes require an educator or admin; DoseTwin review routes require a separately provisioned Clinical Reviewer or admin. This local designation does not verify a medical credential or qualification. Students only see assigned learning cases.
- **Non-repudiation:** a hash-chained, append-only audit log; `/api/v1/audit/verify` checks the chain.
- **Privacy by design:** datasets carry pseudonymous source IDs only, and derived labels keep the minimum fields.
- **No legal compliance claim:** GDPR and INPDP obligations are documented, not claimed solved.

For the locally selected `pt_241` walkthrough and account preparation, see [`RUN_LOCAL.md`](RUN_LOCAL.md) and [`docs/LOCAL_ACCESS_AND_PROFILES.md`](docs/LOCAL_ACCESS_AND_PROFILES.md). Read [`docs/DEMO_ASSETS.md`](docs/DEMO_ASSETS.md) for the installed sources and their hashes.
