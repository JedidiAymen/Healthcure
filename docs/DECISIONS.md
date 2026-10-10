# Decisions

Each significant decision on branch `upgrade/hackcure-compliance`, with its reason. All are dated 2026-10-10 unless stated otherwise. Statements about tests refer to runs recorded in `docs/PROGRESS.md`.

| # | Decision | Reason | Alternatives rejected |
|---|---|---|---|
| D1 | The flagship is the DoseTwin guided research review, following the teammate's enhancement proposal | The teammate's agent runs the same plan, so a single plan avoids diverging implementations. DoseTwin is the most complete end-to-end scientific workflow. | FistulaGuard flagship (scored higher on legality and fit, but would diverge from the team plan) |
| D2 | All three modules stay usable and are linked educationally, never through a combined patient story | The datasets come from unrelated people, so joining them would fabricate data | One synthetic patient spanning all modules |
| D3 | Local-only deployment in Docker on the demo PC; no public site | OpenKBP has no dataset licence and Endoscapes is non-commercial | Hosted synthetic instance (dropped by the product owner) |
| D4 | Research review decisions are "Accept for further expert assessment", "Request revision" or "Reject research candidate", with a required rationale | Matches the teammate plan. Makes the "not for treatment" boundary explicit. | Accept or reject only |
| D5 | Reviews are immutable; a revision supersedes, it never edits | Non-repudiation and a revision trail | Editable reviews |
| D6 | DoseTwin research-review decisions use a dedicated operator-provisioned `clinical_reviewer` role; admin remains an override. This local designation does not verify a medical credential or qualification. | The newer platform enhancement proposal calls for distinct research review, educator and learner workflows; server-side role checks and audit evidence are required. | Original educator/admin-only review policy (superseded by the newer proposal); any claim of verified clinical authority |
| D7 | Hash-chained, append-only audit log written in the action's own transaction | Tamper evidence even if the triggers are bypassed. No forked chain under concurrent writers. | A separate audit service; logging after commit |
| D8 | SQLCipher (AES-256) for the app database inside Docker only; datasets are not encrypted by it | The SQLCipher wheel is Linux-only. Datasets are read-only public research files, and OS disk encryption covers them. | Application-level column encryption; encrypting dataset files |
| D9 | TLS 1.3 only, at a Caddy proxy with a local CA; the API is never published | The cahier asks for TLS 1.3. A single entry point. | Self-signed certificate on uvicorn |
| D10 | The FiSaV risk index is deferred; its protocol stays frozen at v1.1, not run | The stenosis label's criterion is undocumented, and the teammate plan requires a verified outcome definition and clinicians first | Running and shipping a risk score now ("confidence theater") |
| D11 | Protocol v1.1 amendment (beat windows scale with RR) | v1.0 silently excluded fast heart rates. Decided label-blind, before any metric. | Keeping v1.0 and excluding patients |
| D12 | Minimal FHIR R4 export (Patient with pseudonymous ID only, Observation, DiagnosticReport, Provenance), tagged educational and HTEST, validated against the official R4 JSON schema | Shows the integration path without claiming hospital integration | HL7 v2; FHIR for learning data |
| D13 | New migrations are numbered from 0100 | Avoids collisions with parallel 00xx migrations on the shared branch | Renumbering on every merge |
| D14 | Generated contract files are LF via `.gitattributes` | `contracts:check` compares bytes, and Windows checkouts were CRLF | Per-OS CI |
| D15 | A banned-phrase checker runs in CI | Prevents overclaims (diagnosis, validated, compliant) in UI and docs | Manual review only |
| D16 | Hardware is a **simulated** device publishing over MQTT with frame integrity checks, clearly labelled simulated | The cahier's telemetry row (MQTT, frame integrity). The product owner confirmed simulation is acceptable. | Physical hardware (not available); no telemetry |
| D17 | Router split and frontend split stay cut | Active collaborator churn on those files; no blocking need | Splitting now |
| D18 | Two upstream browser tests (DoseTwin case picker, SurgiVision tablet picker) are left to the teammate | They fail on upstream `main` as well, and the teammate owns those modules | Quarantining them on this branch |

## Deliberately not built

- A stenosis classifier shown to users. Reason: D10.
- CVS-AdaptNet execution. Reason: no checkpoint with a verified hash, and no confirmed terms.
- Any model from the PCD brain tumour or XpeRay repositories. Reasons: no weights, no licence, and in XpeRay a token exposed in its history and hallucinated outputs.
- A public demo site. Reason: D3.
- Educator account administration UI. Reason: the CLI and `seed_demo.py` cover local accounts.
