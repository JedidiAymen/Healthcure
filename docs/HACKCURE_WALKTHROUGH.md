# HackCure flagship walkthrough and readiness

Updated 2026-10-11. This is a repository-side rehearsal aid based on the user-provided *MEDFORGE HackCure Platform Enhancement Proposal* and the current feature branch. The proposal labels its additions as proposed at its reviewed 2026-10-10 baseline; its status table is not a current implementation audit or organizer approval. The participant cahier remains the source for official track requirements.

For a print-friendly operator sequence with explicit release gates, use the [`HackCure event-readiness checklist`](HACKCURE_EVENT_CHECKLIST.md). This walkthrough remains the detailed setup and evidence reference.

## Product story

The selected HackCure demonstration is a **DoseTwin research review** of the same OpenKBP-Opt `pt_241` reference and publisher-archived `set_1` prediction. The operator checks matched source identity, inspects ROI and voxel differences, DVHs and provenance, records a rationale-bound research disposition, then reopens and exports that record. The archived output is not MEDFORGE inference. A research disposition is not radiotherapy approval.

The home screen now presents this walkthrough before the research collection montage. Its action opens `pt_241` when the case appears in the active registry, otherwise it opens the case registry. The card states the boundary and that the full walkthrough depends on the active local database containing its comparison, saved report and reviewer account.

## Keep the two local rehearsal databases separate

The normal development app and the HackCure Docker profile use different SQLite databases. A green source-import check against one database does not mean the other is ready. On 2026-10-11, the default `data/local.sqlite3` had the authentic `pt_241` prediction and saved-report records but no credentialed reviewer profile. The HackCure Docker profile was prepared separately in `data/hackcure-docker/medforge.sqlite3`: its verified source pair, matching imported prediction, saved comparison report, and local reviewer credential now pass `npm run hackcure:preflight:docker`. The optional Academy lesson remains unpublished and unassigned. A rollback copy is kept under the ignored `data/hackcure-docker/backups/` directory. Event-profile passwords are in the mode-0600, Git-ignored `data/hackcure-docker/private-access/profile-credentials.md`; no password is in this repository's tracked files. The preflight checks credential presence and role only; it does not disclose or validate passwords.

| Local profile | Database | `pt_241` import/report | Reviewer | Academy lesson |
|---|---|---|---|---|
| Default development app | `data/local.sqlite3` | Present and source-matched | Not provisioned | Not published/assigned |
| HackCure Docker profile | `data/hackcure-docker/medforge.sqlite3` | Present and source-matched | Provisioned locally; password is in the private ignored note | Not published/assigned |

For this Docker profile, the username/password forms appear at `/educator` and `/academy`; DoseTwin shows a sign-in dialog when a protected import/report or reviewer action is selected. There is no standalone `/login` route. The prepared local profile uses the credentials in the private ignored note above. They do not work with another SQLite profile or another machine. A separate read-only inventory should be used when checking a profile; never print stored hashes or copy these passwords to Git.

### What is ready, and what still needs event-owner setup

The product flow and its API controls are implemented: source-pair validation, reviewer-only decision routes, rationale validation, immutable review records, author-scoped history, admin oversight, JSON/FHIR export, and audit linkage. Automated API coverage exercises anonymous/student/educator denial, reviewer and admin access, and cross-reviewer isolation. That is implementation evidence; it does not prepare a database or create a usable reviewer login.

| Gate for the selected Docker rehearsal | Current state | Who can close it |
|---|---|---|
| `pt_241` source manifest and archived `set_1` files | Present and checksum-verified by the Docker preflight | Ready on this host; recheck on the event machine |
| Loopback-only Compose publication and read-only scientific data mounts | Passed by the Docker preflight | Ready on this host; recheck after changing Compose or the host |
| Matching imported prediction and saved comparison report in `data/hackcure-docker/medforge.sqlite3` | Present; preflight matched the report to the installed `pt_241` source and archived prediction hashes | Ready on this host; sign in as the local educator and inspect the report in the running app |
| Usable `clinical_reviewer` login in that same Docker DB | Present; a separate local reviewer login is provisioned | Ready on this host; keep the password private and verify sign-in during rehearsal. The role does not establish medical qualifications |
| Academy learner path | Optional and absent | Only if Academy is part of the presentation: event operator publishes a source-bounded lesson, provisions a student, and assigns the lesson in that same DB |
| Second-machine, network-isolated rehearsal | Not verified | Event team: transfer the approved code/image/data bundle privately, restore on the actual presentation machine, disconnect venue internet, then rerun checks and rehearse |
| Organizer track acceptance and external-use permission for installed research data | Not established by repository checks | Team/organizers and the relevant rights holder; keep the demo local until cleared |

The required machine-local profile and source gates now pass. Remaining gates are the human-authenticated rehearsal, optional Academy preparation if it is part of the presentation, organizer track acceptance, venue-specific source-use permission, and the second-machine/offline restore. Do not copy this database to another machine as a shortcut; provision or transfer it only through the team's approved private process.

### Operator setup sequence for the Docker rehearsal

The steps below are for rehearsing the prepared local profile. They do not create a research disposition for the reviewer or claim organizer/venue approval. The source/use basis recorded with the archived comparison is local research inspection only.

1. Start the already-built local stack and confirm source/network/database readiness:

   ```sh
   npm run hackcure:start:docker
   npm run hackcure:preflight:docker
   ```

   The profile preflight should pass the source, imported comparison, saved report, reviewer-role, and loopback checks. It does not prove that a human login, review, rights decision, or second-machine restore has been rehearsed.

2. Sign in as the educator using the local private credentials note. On a fresh event machine, provision separate accounts in that machine's selected Docker profile using [`LOCAL_ACCESS_AND_PROFILES.md`](LOCAL_ACCESS_AND_PROFILES.md#hackcure-docker-profile); never reuse this host's password or copy credentials into a public repository.

3. At `https://localhost:8443/studio/dosetwin/cases/openkbp%3Apt_241`, open **Compare a real dose prediction** and verify that `prediction-set_1.csv · OpenKBP-Opt archived set_1` is selected. Inspect the reference, archived prediction, signed difference, DVH and per-ROI deltas. The matching report is already saved in this host's private Docker profile. On a newly provisioned profile only, follow [`LOCAL_ACCESS_AND_PROFILES.md`](LOCAL_ACCESS_AND_PROFILES.md#hackcure-docker-profile) to import and save it after the operator confirms the local research-use basis. The archived output is not a MEDFORGE model result.

4. Sign out, sign in as the reviewer, and have the human reviewer complete the rationale-bound research review described in [Jury walkthrough order](#jury-walkthrough-order). Finally rerun `npm run hackcure:preflight:docker`; the imported comparison, matching report, and reviewer checks should pass. Academy remains optional for this flagship flow and is not ready as an assigned lesson in this profile.

For the currently prepared same-machine DoseTwin comparison in the default local profile, use `npm run doctor -- --hackcure-preflight` and the launcher documented in [`RUN_LOCAL.md`](../RUN_LOCAL.md); do not describe that separate profile as a ready Docker or second-machine rehearsal. The Docker and development databases are intentionally not copied between profiles.

## Proposal priorities against the current branch

The proposal's P0/P1 labels describe its older baseline. Current status on this branch is:

| Priority | Deliverable | Current evidence and remaining gate |
|---|---|---|
| P0 | Clinical Review Workspace | Implemented for an installed comparison: exact-case/artefact evidence, required rationale, immutable research dispositions, reviewer authorization, audit linkage, author-scoped history, JSON and FHIR R4 exports. The HackCure Docker database still needs its matching imported comparison/report and an operator-provisioned reviewer before the end-to-end event path is ready. |
| P0 | Explainability and limitations | Partial. DoseTwin exposes source identity, units, ROI/voxel deltas, DVHs, method and provenance. It has no live MEDFORGE prediction, model confidence or clinical validation. |
| P0 | Reproducible jury demo | Partial. A deterministic synthetic DoseTwin viewer and local Docker profile exist. A fresh same-host `--no-build --pull never` start and read-only source mounts were verified. This does not establish public-data rights, a second-machine restore or a complete reviewer-session rehearsal. |
| P0 | Security baseline | Partial. Reviewer API authorization and object scoping are implemented; the default Docker profile uses SQLCipher, while the separate HackCure rehearsal overlay deliberately uses unencrypted host-bind-mounted SQLite for its read-only host preflight. Its local proxy provides TLS 1.3 and review actions use hash-linked audit records. This is not production identity, external deployment security, or a qualified privacy/legal review. |
| P0 | CI/release repair | Hosted run `38101219989` for `cd7952d` failed at a DoseTwin browser-test click aimed too close to a voxel boundary. Production correctly selected the cell containing the browser's rounded pointer; the test target was moved to the center of its intended source cell, and the focused E2E passes locally on `439d4ff`. The new full hosted run and clean-clone/independent-machine reproducibility remain unverified. |
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
