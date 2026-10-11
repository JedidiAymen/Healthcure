# L3 deployment dossier (draft)

This is a planning document for the HackCure jury and the team. It describes the current research/education product and separates verified local controls from future institutional work. It is not legal advice, clinical validation, a deployment authorization, or evidence of a health outcome. Assumptions must be validated with domain experts, buyers, and qualified legal advisers before they are presented as facts.

**Evidence snapshot:** updated 2026-10-11 for `feat/experiments-run-workspace` at `1b12c9f`. The separate HackCure compliance/readiness snapshot and the latest entries in [`STATUS.md`](STATUS.md) and [`PROGRESS.md`](PROGRESS.md) identify verified evidence and current local gates. Hosted CI run [38099823316](https://github.com/JedidiAymen/Healthcure/actions/runs/38099823316) completed successfully for this commit, including lint, typecheck, frontend/browser checks, API contracts, OpenAPI check, production build, and offline Academy check. This dossier reflects the expanded local Docker rehearsal path, the latest source-mount preflight, and the current research/education release boundary. The user-provided HackCure proposal labels its additions as proposed unless marked existing; the accompanying gap assessment is a secondary editorial review of an older commit. The organizers' primary cahier PDF is not in this checkout, and its exact wording has not been independently checked here. Do not treat proposal ideas, assessment scores, or this planning document as organizer approval or proof of legal/clinical compliance.

## 1. Target workflow and users

- **Current problem framing:** researchers and educators need a traceable way to inspect a radiotherapy benchmark reference beside a published archived prediction, understand measured differences, and record a reasoned research review. This is a research/education problem; no reduction in clinical errors or patient outcomes has been measured.
- **Flagship user:** an operator-provisioned local DoseTwin research reviewer inspecting the same-case OpenKBP-Opt `pt_241` reference and archived `set_1` prediction.
- **Other users:** educators prepare source-attributed learning material; students investigate only assigned cases and receive a delayed debrief. SurgiVision and FistulaGuard remain independent research/teaching workspaces with separate source datasets.
- **Output:** an immutable, author-scoped research-review record containing the selected decision, required rationale, frozen evidence and source/audit hashes, with JSON and minimal FHIR R4 export.
- **Boundary:** the archived prediction is not MEDFORGE inference. The review is not clinical approval, treatment planning, or permission to deliver radiotherapy.

The measurable outcome for the proposed research/education pilot is **task performance**, not patient outcome: completion rate for the source-matched inspection and review task, time to identify a supplied research finding, time to produce/reopen a report, and errors in case/source selection. These are proposed measures; no user study or baseline has been run. Any future protocol must state participant role, sample size, task script, exclusions, and analysis before collecting results.

## 2. Field feasibility

| Topic | Current state | Needed before an institutional pilot |
|---|---|---|
| Runtime | Local Docker stack is designed for the demo PC and can operate after images/assets are prepared. Setup and profile instructions are in [`LOCAL_ACCESS_AND_PROFILES.md`](LOCAL_ACCESS_AND_PROFILES.md) and [`RUN_LOCAL.md`](../RUN_LOCAL.md). | Deploy only inside an institution-approved environment, with IT review, backups, monitoring, key management and support ownership. |
| Data | Local research assets are mounted/read from the local machine; `pt_241` is a separate case from `pt_201`. See [`DEMO_ASSETS.md`](DEMO_ASSETS.md) and [`DEMO_DATA_POLICY.md`](DEMO_DATA_POLICY.md). | Obtain institution-owned or explicitly licensed data and written governance approval. OpenKBP-Opt terms are not established for external redistribution or hosting. |
| Rigor | The `pt_201` DoseTwin summary metrics were cross-checked against the official evaluator (`openkbp-pt201-validation.json`). The `pt_241` comparison uses its matching reference and archived prediction, not an MEDFORGE model. | Reproduce source-level validation with institution-approved inputs and independent technical/domain review. The `pt_201` check does not validate the `pt_241` prediction or establish clinical utility. |
| Accounts and roles | Local profiles are operator-provisioned. Educator/admin can prepare general research records; `clinical_reviewer`/admin can record DoseTwin research reviews; students are scoped to assigned learning cases. | Institutional identity and access policy, least-privilege review, account lifecycle and separation-of-duties review. |
| Interoperability | A minimal FHIR R4 representation of the DoseTwin research review is exported and schema-validated. There is no live hospital-system connection. | Agree on profiles, terminology and exchange semantics with an institutional integration partner; test against a non-production endpoint. |
| Demo readiness | The `pt_241` source is installed and verified locally. `data/local.sqlite3` contains one matching imported artifact and saved report but no reviewer with sign-in credentials; no assigned Academy lesson is prepared. The separate HackCure Docker profile's database has no matching imported artifact, report, reviewer profile, or assigned Academy lesson. Read-only preflights were rerun on 2026-10-11; exact walkthrough and account setup are in [`HACKCURE_COMPLIANCE.md`](HACKCURE_COMPLIANCE.md) and [`LOCAL_ACCESS_AND_PROFILES.md`](LOCAL_ACCESS_AND_PROFILES.md). | Prepare the selected profile with the matching artifact/report and a private reviewer account; run the preflight; then test a clean-clone, offline cold start and restore on a second machine. No completed jury rehearsal or organizer acceptance is evidenced. |

**HackCure readiness at this snapshot:** The application/repository is substantial, but event readiness is **not complete**. The latest exact Docker preflight verifies loopback binding, the source manifest, and required read-only dataset bind mounts; its read-only database doctor still reports a missing prediction import, saved comparison report, reviewer profile, and optional assigned Academy lesson. The selected profile has not passed the authenticated reviewer rehearsal. Hosted CI for `1b12c9f` passed, but the current uncommitted work still needs its own verification and CI. No independent-machine restore, organizer track confirmation, dataset-rights clearance for external display, or jury rehearsal is evidenced. Keep these as release gates, not prose-only caveats.

## 3. Regulatory and privacy scope

- **Intended use:** research review and education. The app does not make individual clinical decisions. This statement is a product boundary, not a legal classification. Obtain advice on Tunisian requirements and EU MDR software classification before any clinical deployment or patient-care use.
- **Data held:** local account/profile data, learning submissions and grades, research-review records, reports and provenance. Research source assets use publisher/dataset identifiers; these should not be treated as clinical patient identities.
- **Local controls:** PBKDF2 password hashes and hashed session tokens; role-scoped routes; author-scoped research-review records; an append-only hash-chained audit log; learner data export and account erasure; TLS 1.3 at the Docker proxy; SQLCipher AES-256 for the default Docker profile database. The separate HackCure rehearsal overlay uses plain host-bind-mounted SQLite so its preflight can inspect the running app's database; keep that file on an encrypted, permission-restricted host disk.
- **Role boundary:** the local `clinical_reviewer` grant is assigned by an operator and gates DoseTwin research-review actions. It does **not** verify a medical license, specialty, clinical qualification, institutional identity, or authority to treat. Educator/admin retain general research preparation/write routes; the Clinical Reviewer role is limited to DoseTwin review and its authorized history/export routes. Review records are visible to their author and admins; admin oversight does not establish clinical authority. General research browsing is local-only and is not covered by complete account-based authorization.
- **Storage limit:** SQLCipher covers the application database only in the default Docker profile. It does not encrypt the source datasets, Docker key file, local CA, or every host artifact; the HackCure overlay database is plain SQLite. Use OS full-disk encryption on the demo machine and protect keys/backups separately.
- **Open governance work:** legal basis, retention periods, institutional controller/processor roles, data-subject process for all records, DPIA, and any INPDP declaration remain to be assessed before real-patient data or institutional deployment. **No GDPR/INPDP legal compliance is claimed.**
- **Official reference points reviewed 2026-10-11:** Tunisia's INPDP publishes [Organic Law No. 2004-63](https://www.inpdp.tn/ressources/loi_2004.pdf), its [procedure and forms page](https://www.inpdp.tn/Formulaires.html) (which describes prior declaration and additional authorization cases, including health/sensitive data and transfers), and [the legal-text index](https://www.inpdp.tn/Texte.html). For EU-facing processing or intended EU medical-device use, the primary texts to assess include [GDPR Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj) and [Medical Device Regulation (EU) 2017/745](https://eur-lex.europa.eu/eli/reg/2017/745/oj). Applicability depends on facts such as actors, processing, territory, and intended purpose; this dossier makes no legal classification. Obtain Tunisian counsel/INPDP guidance and an EU regulatory assessment where relevant before any pilot with identifiable health data or any medical-purpose claim.
- **Dataset limits:** OpenKBP has no dataset license established in this repository; OpenKBP-Opt archived clinical arrays have unresolved external-use terms and no published checkpoint hash. Endoscapes is CC BY-NC-SA for non-commercial scientific research; other source-specific terms and boundaries are recorded in the data policy. Do not publish or host restricted source data.

## 4. Security and deployment architecture

For the local Docker demo, a Caddy proxy terminates TLS 1.3; the API and broker are not published as public services. The default Docker profile uses SQLCipher AES-256 with a separately protected key. The HackCure rehearsal overlay is a separate profile with unencrypted host-bind-mounted SQLite for its read-only host preflight. Sensitive actions are recorded in a hash-chained append-only audit log. Student learning access is case/assignment-scoped; DoseTwin reviews are role-gated and author-scoped, with admin oversight. Research reads remain local-only and do not amount to comprehensive production RBAC.

The current deployment target is a single local demo machine, not a public URL, hospital network, or hosted service. The installed OpenKBP and Endoscapes assets remain subject to their recorded display/use restrictions. See [`README.md`](../README.md), [`DEMO_DATA_POLICY.md`](DEMO_DATA_POLICY.md), and the proof/verification summary in [`PROGRESS.md`](PROGRESS.md). A successful local TLS or SQLCipher check must not be presented as certification of the whole platform; the HackCure overlay database itself is not encrypted by SQLCipher.

### Threats and evidence boundary

| Threat | Current control/evidence | Remaining gate before institutional use |
|---|---|---|
| Accidental public exposure of research data or API | Local release cutline; Compose profile binds the proxy to loopback; the Docker preflight verifies no host-published service ports and required dataset bind mounts are read-only. | Independent security review of the complete deployment, firewall, browser cache, backup path, and host configuration. Never publish the local research profile. |
| Cross-role or cross-user access | Server-side role checks, assignment-scoped learner routes, author-scoped review history, and route-authorization tests are present. | Broader threat modeling and penetration testing for all research endpoints; institutional SSO, MFA, provisioning, revocation, and access review. |
| Credential/session theft or local-disk access | Password hashes and hashed session tokens; SQLCipher on the default Docker database; the HackCure overlay uses plain SQLite and requires OS-disk protection. | Key lifecycle, rotation, secrets handling, backup encryption, workstation hardening, and incident response have not been independently reviewed. |
| Malicious or corrupted source bundle | Hash/manifest validation and backup restore-check; malformed provenance is reported as a controlled failure. | Exercise corruption, recovery and restore on a second machine; independently review parser and archive attack surface. |
| Unsupported medical interpretation | Archived prediction, reference values, limitations and research-only disposition are labeled; no live dose inference is enabled. | Qualified domain review of wording and workflow; no medical-use claim until intended purpose and evidence are formally assessed. |
| Dataset rights or provenance mismatch | Source manifests and per-file hashes are checked; source collections remain separate and local. | Written rights review for each displayed/reproduced asset and event venue; rights clearance cannot be inferred from a successful hash check. |

This is a focused design-level threat register, not a completed security assessment. It does not cover every attack path or replace an institutional threat model.

## 5. Business model (hypotheses, not validated)

- **Possible paying entities:** academic radiotherapy departments, medical faculties, and research/education programmes seeking traceable benchmark-review and teaching workflows.
- **Possible offer:** an institutional research/education installation plus source curation, integration and expert-review services. Do not sell access to third-party assets whose terms do not allow it.
- **Cost drivers:** licensed/curated content, qualified reviewer time, institutional integration and ongoing security/operations; server cost is not yet measured.
- **Validation needed:** interview 3–5 potential institutional buyers and technical owners before quoting a price or claiming demand. Patient access is not a payer or target user.
- **Access barriers:** dataset rights, expert time, hospital IT approval, identity/governance integration, regulatory scope and support capacity.

### Planning estimate (not a quote or market-validated budget)

The current event build is a local, single-machine demonstration using an already available workstation; it has no measured hosted monthly bill, and a zero cloud invoice would not mean zero operating cost. A first institutional research/education pilot is provisionally estimated at **12–20 person-days over 3–6 months**, excluding model development and clinical validation:

| Work | Planning effort | Assumption |
|---|---:|---|
| Installation, data-rights inventory, and environment setup | 3–5 engineer-days | Institution supplies the workstation/container host and approved test data. |
| Identity, access, backup, monitoring, and security review | 4–7 engineer/IT-days | No EHR integration or public hosting; includes a restore drill and operational handoff. |
| Workflow and usability protocol/review | 3–5 clinician/researcher-days | Small formative research/education study; not a clinical efficacy trial. |
| Documentation, training, and support handoff | 2–3 product/operations-days | One pilot team and a bounded number of local users. |

These ranges are an internal scoping estimate, not a vendor price, customer quote, or validated staffing commitment. The recurring cost model for a hosted synthetic-only environment is not priced until a provider, region, retention policy, availability target, backup policy, and measured resource profile are selected. It must include compute, encrypted storage/backups, domain/TLS operations, monitoring, security updates, and support. Public hosting with the installed research assets remains prohibited by this release cutline. Validate effort with a named institution and record actual time before presenting a budget.

## 6. Roadmap

| Horizon | Milestones |
|---|---|
| 3 months | Have radiotherapy experts review the DoseTwin research-review semantics and starter lessons; measure case-open/review time and task errors with research/teaching users; complete data-rights and retention review; rehearse backup/restore and the local offline demo. |
| 6 months | If an institution supplies authorized data and governance approval, run a limited research/education pilot with predefined usability and reviewer-consistency measures. Test a minimal FHIR exchange with a non-production endpoint only after profiles are agreed. Consider any in-app model only after checkpoint, license, independent evaluation and domain-review gates pass. |

These are planning horizons, not commitments or evidence that a pilot is approved. Clinical deployment and patient-outcome claims are outside the current release.

## 7. Submission gate map (L1 / L2 / L3)

| Deliverable | Evidence now | Status and exit condition |
|---|---|---|
| L1 — technical repository | Public repository, README/local instructions, lockfile, pinned dependencies, generated contracts and CI workflow. Run `38099823316` for `1b12c9f` passed all configured checks. | **Partial until the latest follow-up commit passes and a clean-clone/release check is done.** Require a clean clone, all required checks, clean production build, and a reviewable tagged submission commit. |
| L2 — ready-to-use live MVP | Local DoseTwin research review and synthetic isolated fixture exist; Docker can cold-start on this host with saved images. | **Partial.** Restore the exact same-case import/report/reviewer state on the selected demo profile, perform an authenticated rehearsal, verify the local/offline backup on an independent machine, and obtain organizer agreement on the local delivery format. Do not make a public endpoint without explicit approval and a synthetic-only data/security plan. |
| L3 — deployment dossier | This draft now records target workflow, evidence boundary, threats, official regulatory reference points, pilot staffing estimate, and a 3/6-month plan. | **Draft; review required.** Obtain qualified Tunisian privacy/legal review, assess EU rules only if applicable, validate the buyer/staffing assumptions with a named institution, and approve data governance before any real-patient pilot. |
| Live defense | Six-minute script and technical answers in [`HACKCURE_COMPLIANCE.md`](HACKCURE_COMPLIANCE.md). | **Not rehearsed on a clean event machine.** The event operator must provision private credentials and matching database records, run the exact preflight, then rehearse the full workflow and fallback. |
