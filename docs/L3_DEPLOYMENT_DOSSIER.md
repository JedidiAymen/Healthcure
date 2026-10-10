# L3 deployment dossier (draft)

This is a planning document for the HackCure jury and the team. It describes the current research/education product and separates verified local controls from future institutional work. It is not legal advice, clinical validation, a deployment authorization, or evidence of a health outcome. Assumptions must be validated with domain experts, buyers, and qualified legal advisers before they are presented as facts.

## 1. Target workflow and users

- **Current problem framing:** researchers and educators need a traceable way to inspect a radiotherapy benchmark reference beside a published archived prediction, understand measured differences, and record a reasoned research review. This is a research/education problem; no reduction in clinical errors or patient outcomes has been measured.
- **Flagship user:** an operator-provisioned local DoseTwin research reviewer inspecting the same-case OpenKBP-Opt `pt_241` reference and archived `set_1` prediction.
- **Other users:** educators prepare source-attributed learning material; students investigate only assigned cases and receive a delayed debrief. SurgiVision and FistulaGuard remain independent research/teaching workspaces with separate source datasets.
- **Output:** an immutable, author-scoped research-review record containing the selected decision, required rationale, frozen evidence and source/audit hashes, with JSON and minimal FHIR R4 export.
- **Boundary:** the archived prediction is not MEDFORGE inference. The review is not clinical approval, treatment planning, or permission to deliver radiotherapy.

## 2. Field feasibility

| Topic | Current state | Needed before an institutional pilot |
|---|---|---|
| Runtime | Local Docker stack is designed for the demo PC and can operate after images/assets are prepared. Setup and profile instructions are in [`LOCAL_ACCESS_AND_PROFILES.md`](LOCAL_ACCESS_AND_PROFILES.md) and [`RUN_LOCAL.md`](../RUN_LOCAL.md). | Deploy only inside an institution-approved environment, with IT review, backups, monitoring, key management and support ownership. |
| Data | Local research assets are mounted/read from the local machine; `pt_241` is a separate case from `pt_201`. See [`DEMO_ASSETS.md`](DEMO_ASSETS.md) and [`DEMO_DATA_POLICY.md`](DEMO_DATA_POLICY.md). | Obtain institution-owned or explicitly licensed data and written governance approval. OpenKBP-Opt terms are not established for external redistribution or hosting. |
| Rigor | The `pt_201` DoseTwin summary metrics were cross-checked against the official evaluator (`openkbp-pt201-validation.json`). The `pt_241` comparison uses its matching reference and archived prediction, not an MEDFORGE model. | Reproduce source-level validation with institution-approved inputs and independent technical/domain review. The `pt_201` check does not validate the `pt_241` prediction or establish clinical utility. |
| Accounts and roles | Local profiles are operator-provisioned. Educator/admin can prepare general research records; `clinical_reviewer`/admin can record DoseTwin research reviews; students are scoped to assigned learning cases. | Institutional identity and access policy, least-privilege review, account lifecycle and separation-of-duties review. |
| Interoperability | A minimal FHIR R4 representation of the DoseTwin research review is exported and schema-validated. There is no live hospital-system connection. | Agree on profiles, terminology and exchange semantics with an institutional integration partner; test against a non-production endpoint. |

## 3. Regulatory and privacy scope

- **Intended use:** research review and education. The app does not make individual clinical decisions. This statement is a product boundary, not a legal classification. Obtain advice on Tunisian requirements and EU MDR software classification before any clinical deployment or patient-care use.
- **Data held:** local account/profile data, learning submissions and grades, research-review records, reports and provenance. Research source assets use publisher/dataset identifiers; these should not be treated as clinical patient identities.
- **Local controls:** PBKDF2 password hashes and hashed session tokens; role-scoped routes; author-scoped research-review records; an append-only hash-chained audit log; learner data export and account erasure; TLS 1.3 at the Docker proxy; SQLCipher AES-256 for the Docker application database.
- **Role boundary:** the local `clinical_reviewer` grant is assigned by an operator and gates DoseTwin research-review actions. It does **not** verify a medical license, specialty, clinical qualification, institutional identity, or authority to treat. Educator/admin retain general research preparation/write routes; the Clinical Reviewer role is limited to DoseTwin review and its authorized history/export routes. Review records are visible to their author and admins; admin oversight does not establish clinical authority. General research browsing is local-only and is not covered by complete account-based authorization.
- **Storage limit:** SQLCipher covers the application database in the Docker deployment. It does not encrypt the source datasets, Docker key file, local CA, or every host artifact. Use OS full-disk encryption on the demo machine and protect keys/backups separately.
- **Open governance work:** legal basis, retention periods, institutional controller/processor roles, data-subject process for all records, DPIA, and any INPDP declaration remain to be assessed before real-patient data or institutional deployment. **No GDPR/INPDP legal compliance is claimed.**
- **Dataset limits:** OpenKBP has no dataset license established in this repository; OpenKBP-Opt archived clinical arrays have unresolved external-use terms and no published checkpoint hash. Endoscapes is CC BY-NC-SA for non-commercial scientific research; other source-specific terms and boundaries are recorded in the data policy. Do not publish or host restricted source data.

## 4. Security and deployment architecture

For the local Docker demo, a Caddy proxy terminates TLS 1.3; the API and broker are not published as public services. The application database uses SQLCipher AES-256 with a separately protected key. Sensitive actions are recorded in a hash-chained append-only audit log. Student learning access is case/assignment-scoped; DoseTwin reviews are role-gated and author-scoped, with admin oversight. Research reads remain local-only and do not amount to comprehensive production RBAC.

The current deployment target is a single local demo machine, not a public URL, hospital network, or hosted service. The installed OpenKBP and Endoscapes assets remain subject to their recorded display/use restrictions. See [`README.md`](../README.md), [`DEMO_DATA_POLICY.md`](DEMO_DATA_POLICY.md), and the proof/verification summary in [`PROGRESS.md`](PROGRESS.md). A successful local TLS or encryption check must not be presented as certification of the whole platform.

## 5. Business model (hypotheses, not validated)

- **Possible paying entities:** academic radiotherapy departments, medical faculties, and research/education programmes seeking traceable benchmark-review and teaching workflows.
- **Possible offer:** an institutional research/education installation plus source curation, integration and expert-review services. Do not sell access to third-party assets whose terms do not allow it.
- **Cost drivers:** licensed/curated content, qualified reviewer time, institutional integration and ongoing security/operations; server cost is not yet measured.
- **Validation needed:** interview 3–5 potential institutional buyers and technical owners before quoting a price or claiming demand. Patient access is not a payer or target user.
- **Access barriers:** dataset rights, expert time, hospital IT approval, identity/governance integration, regulatory scope and support capacity.

## 6. Roadmap

| Horizon | Milestones |
|---|---|
| 3 months | Have radiotherapy experts review the DoseTwin research-review semantics and starter lessons; measure case-open/review time and task errors with research/teaching users; complete data-rights and retention review; rehearse backup/restore and the local offline demo. |
| 6 months | If an institution supplies authorized data and governance approval, run a limited research/education pilot with predefined usability and reviewer-consistency measures. Test a minimal FHIR exchange with a non-production endpoint only after profiles are agreed. Consider any in-app model only after checkpoint, license, independent evaluation and domain-review gates pass. |

These are planning horizons, not commitments or evidence that a pilot is approved. Clinical deployment and patient-outcome claims are outside the current release.
