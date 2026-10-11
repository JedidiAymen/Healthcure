# HackCure flagship walkthrough and readiness

Updated 2026-10-11. This is a repository-side rehearsal aid based on the user-provided *MEDFORGE HackCure Platform Enhancement Proposal* and the current feature branch. The proposal labels its additions as proposed at its reviewed 2026-10-10 baseline; its status table is not a current implementation audit or organizer approval. The participant cahier remains the source for official track requirements.

## Product story

The selected HackCure demonstration is a **DoseTwin research review** of the same OpenKBP-Opt `pt_241` reference and publisher-archived `set_1` prediction. The operator checks matched source identity, inspects ROI and voxel differences, DVHs and provenance, records a rationale-bound research disposition, then reopens and exports that record. The archived output is not MEDFORGE inference. A research disposition is not radiotherapy approval.

The home screen now presents this walkthrough before the research collection montage. Its action opens `pt_241` when the case appears in the active registry, otherwise it opens the case registry. The card states the boundary and that the full walkthrough depends on the active local database containing its comparison, saved report and reviewer account.

## Keep the two local rehearsal databases separate

The normal development app and the HackCure Docker profile use different SQLite databases. A green source-import check against one database does not mean the other is ready. On 2026-10-11, the default `data/local.sqlite3` passed the authentic `pt_241` prediction-import and saved-report checks; the reviewer profile and optional Academy lesson were absent. The exact HackCure Docker preflight selected `data/hackcure-docker/medforge.sqlite3`: the source manifest and loopback configuration passed, while its imported prediction, saved report, reviewer profile and optional Academy lesson were absent. Both checks are read-only.

| Local profile | Database | `pt_241` import/report | Reviewer | Academy lesson |
|---|---|---|---|---|
| Default development app | `data/local.sqlite3` | Present and source-matched | Not provisioned | Not published/assigned |
| HackCure Docker profile | `data/hackcure-docker/medforge.sqlite3` | Missing | Not provisioned | Not published/assigned |

### What is ready, and what still needs event-owner setup

The product flow and its API controls are implemented: source-pair validation, reviewer-only decision routes, rationale validation, immutable review records, author-scoped history, admin oversight, JSON/FHIR export, and audit linkage. Automated API coverage exercises anonymous/student/educator denial, reviewer and admin access, and cross-reviewer isolation. That is implementation evidence; it does not prepare a database or create a usable reviewer login.

| Gate for the selected Docker rehearsal | Current state | Who can close it |
|---|---|---|
| `pt_241` source manifest and archived `set_1` files | Present and checksum-verified by the Docker preflight | Ready on this host; recheck on the event machine |
| Loopback-only Compose publication and read-only scientific data mounts | Passed by the Docker preflight | Ready on this host; recheck after changing Compose or the host |
| Matching imported prediction and saved comparison report in `data/hackcure-docker/medforge.sqlite3` | Missing; the default development DB has these records, but it is a different DB | Event operator: start the Docker profile, sign in with a privately provisioned educator/admin account, import the exact `pt_241` `prediction-set_1.csv`, then save its comparison report |
| Usable `clinical_reviewer` login in that same Docker DB | Missing | Event owner/operator: provision one interactively in the selected profile and keep its password private; the preflight intentionally reports presence only and never prints credentials |
| Academy learner path | Optional and absent | Only if Academy is part of the presentation: event operator publishes a source-bounded lesson, provisions a student, and assigns the lesson in that same DB |
| Second-machine, network-isolated rehearsal | Not verified | Event team: transfer the approved code/image/data bundle privately, restore on the actual presentation machine, disconnect venue internet, then rerun checks and rehearse |
| Organizer track acceptance and external-use permission for installed research data | Not established by repository checks | Team/organizers and the relevant rights holder; keep the demo local until cleared |

The current blocker is therefore event-profile state and rehearsal, not an absent reviewer feature. Do not copy the default development DB to the Docker profile as a shortcut: prepare and recheck the exact profile that will be presented.

Run `npm run doctor -- --hackcure-preflight` to inspect the database selected by `MEDFORGE_DB_PATH` (the default is `data/local.sqlite3`). Run `bash scripts/hackcure_docker_preflight.sh` to inspect the separate Docker database. For the currently prepared same-machine DoseTwin comparison, start the default local app as documented in [`RUN_LOCAL.md`](../RUN_LOCAL.md); do not describe that as a ready Docker or second-machine rehearsal. The reviewer step still needs a private, operator-provisioned account in whichever database is used for the review.

## Proposal priorities against the current branch

The proposal's P0/P1 labels describe its older baseline. Current status on this branch is:

| Priority | Deliverable | Current evidence and remaining gate |
|---|---|---|
| P0 | Clinical Review Workspace | Implemented for an installed comparison: exact-case/artefact evidence, required rationale, immutable research dispositions, reviewer authorization, audit linkage, author-scoped history, JSON and FHIR R4 exports. The HackCure Docker database still needs its matching imported comparison/report and an operator-provisioned reviewer before the end-to-end event path is ready. |
| P0 | Explainability and limitations | Partial. DoseTwin exposes source identity, units, ROI/voxel deltas, DVHs, method and provenance. It has no live MEDFORGE prediction, model confidence or clinical validation. |
| P0 | Reproducible jury demo | Partial. A deterministic synthetic DoseTwin viewer and local Docker profile exist. A fresh same-host `--no-build --pull never` start and read-only source mounts were verified. This does not establish public-data rights, a second-machine restore or a complete reviewer-session rehearsal. |
| P0 | Security baseline | Partial. Reviewer API authorization and object scoping are implemented; the default Docker profile uses SQLCipher, while the separate HackCure rehearsal overlay deliberately uses unencrypted host-bind-mounted SQLite for its read-only host preflight. Its local proxy provides TLS 1.3 and review actions use hash-linked audit records. This is not production identity, external deployment security, or a qualified privacy/legal review. |
| P0 | CI/release repair | Hosted run `38100993035` for `56c8c17` is pending. Its predecessor `38100708890` failed because a mobile smoke test still expected a heading removed from the current home page; that focused check now passes locally after updating the assertion. Clean-clone and independent-machine reproducibility are unverified. |
| P1 | FHIR-oriented export | Minimal FHIR R4 research-review export exists and was validated against the official R4 JSON schema. No hospital profile, live SIH endpoint or exchange has been tested. |
| P1 | Source-bound guided scenario | The DoseTwin review interface provides the evidence-to-disposition journey. Its complete demonstration still depends on the local comparison/report/reviewer setup above. |
| P1 | Docker and offline fallback | Partial. Local Compose and saved-image cold start were verified on this host. A second-machine restore and fully network-isolated rehearsal remain unverified. |
| P1 | Technical and workflow evaluation | Partial. Numerical parity against the official DoseTwin evaluator is recorded; actual app captures exist. A measured participant task study and full cold-machine reproducibility result are not established. |
| P1 | Deployment/viability dossier | A local dossier exists with workflow, security boundary, costs and roadmap. It is a planning artifact, not an externally reviewed regulatory, legal or buyer validation. |

## Track 2 and Track 3 wording

The proposal itself says Track 3 should be claimed only with working, defensible AI; otherwise it recommends describing platform utility under Track 2. MEDFORGE must not turn that recommendation into an organizer-approved track classification. Current product evidence supports a local research-and-education review demonstration only:

- **Track 2:** Academy submissions can queue and replay after reconnection, but this is learner workflow resilience. MEDFORGE does not provide synchronous/asynchronous patient care, clinical triage, a care pathway, or zero-latency clinical action. Do not call the research reviewer workflow triage.
- **Track 3:** `pt_241` uses a publisher-archived prediction. No runnable MEDFORGE dose-inference model or clinical assistive output is enabled, and no clinical model-bias evaluation exists for the flagship. Do not claim an SADM, clinical decision support, or a physician-signature substitute.
- **Submission language:** say “DoseTwin source-backed research review and medical education, with a publisher-archived comparison.” Confirm the official track fit with the organizers if a track label is required. The supervisor's recorded guidance that the cahier is not a literal feature checklist does not itself establish track eligibility.

## Jury walkthrough order

1. From the home screen, open the HackCure flagship card and enter `pt_241` in the active local profile.
2. Confirm source case and archived output identity; inspect linked dose, ROI, DVH and numeric difference evidence.
3. Explain that output is archived publisher data, describe the numerical method and limitations, and make no live-inference or treatment-safety claim.
4. If the event database has a provisioned reviewer and saved comparison/report, record a disposition with a rationale, reopen its history, and show JSON/FHIR export as a research artifact. Otherwise state that this final event setup gate is still open.
5. Close with the explicit Track 2/3 boundary above and the local-only data/deployment boundary.

## Review evidence

- The actual local home route was reviewed at desktop (1440×900), tablet (768×1024), and mobile (390×844). The walkthrough heading was visible at all three sizes; each route returned HTTP 200, had no horizontal overflow, and produced no browser page errors. Captures are local and ignored by Git: `.local-review/hackcure-home/home-desktop.png`, `home-tablet.png`, and `home-mobile.png`.
- Hosted CI run [38099412671](https://github.com/JedidiAymen/Healthcure/actions/runs/38099412671) completed successfully on commit `ad15239`. It passed install, lint, typecheck, frontend unit tests, browser shell tests, API contract tests, OpenAPI contract check, production build, and the offline Academy production-shell browser check. This does not verify a clean clone, independent machine, release tag, or jury rehearsal.
