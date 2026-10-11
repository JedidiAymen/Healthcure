# HackCure flagship walkthrough and readiness

Updated 2026-10-11. This is a repository-side rehearsal aid based on the user-provided *MEDFORGE HackCure Platform Enhancement Proposal* and the current feature branch. The proposal labels its additions as proposed at its reviewed 2026-10-10 baseline; its status table is not a current implementation audit or organizer approval. The participant cahier remains the source for official track requirements.

## Product story

The selected HackCure demonstration is a **DoseTwin research review** of the same OpenKBP-Opt `pt_241` reference and publisher-archived `set_1` prediction. The operator checks matched source identity, inspects ROI and voxel differences, DVHs and provenance, records a rationale-bound research disposition, then reopens and exports that record. The archived output is not MEDFORGE inference. A research disposition is not radiotherapy approval.

The home screen now presents this walkthrough before the research collection montage. Its action opens `pt_241` when the case appears in the active registry, otherwise it opens the case registry. The card states the boundary and that the full walkthrough depends on the active local database containing its comparison, saved report and reviewer account.

## Proposal priorities against the current branch

The proposal's P0/P1 labels describe its older baseline. Current status on this branch is:

| Priority | Deliverable | Current evidence and remaining gate |
|---|---|---|
| P0 | Clinical Review Workspace | Implemented for an installed comparison: exact-case/artefact evidence, required rationale, immutable research dispositions, reviewer authorization, audit linkage, author-scoped history, JSON and FHIR R4 exports. The HackCure Docker database still needs its matching imported comparison/report and an operator-provisioned reviewer before the end-to-end event path is ready. |
| P0 | Explainability and limitations | Partial. DoseTwin exposes source identity, units, ROI/voxel deltas, DVHs, method and provenance. It has no live MEDFORGE prediction, model confidence or clinical validation. |
| P0 | Reproducible jury demo | Partial. A deterministic synthetic DoseTwin viewer and local Docker profile exist. A fresh same-host `--no-build --pull never` start and read-only source mounts were verified. This does not establish public-data rights, a second-machine restore or a complete reviewer-session rehearsal. |
| P0 | Security baseline | Partial. Local profile includes API role/object checks, SQLCipher for the Docker database, TLS 1.3 at the local proxy and hash-linked audit records. This is not production identity, external deployment security, or a qualified privacy/legal review. |
| P0 | CI/release repair | Still open pending a new hosted run after the focused CVS learner-flow test correction. That one focused browser test passed locally; it is not evidence of green full CI or a submission release. |
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
