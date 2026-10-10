# HackCure compliance audit and current demo plan

**Evidence basis and limits:** this audit uses the user-provided `MEDFORGE_HackCure_Platform_Enhancement_Proposal (1).md`, which explicitly labels its additions as proposed unless marked existing, and `MEDFORGE_HackCure_Cahier_des_Charges_Gap_Assessment (1).docx`, an editorial assessment of an earlier repository snapshot. The assessment quotes and summarizes sections of the organizers' *Cahier des Charges HackCure Participant*, but that primary-source PDF is not present in this checkout. Its scores, priorities, Track recommendation and proposed features are not organizer decisions or automatic implementation approvals. The matrix below follows the requirement descriptions transcribed in the supplied assessment and is checked against the current repository; it is not a primary-source legal/compliance determination.

- **Current checkout:** `feat/experiments-run-workspace`, reviewed at commit `7a754d8` (2026-10-10). The branch-by-branch reconciliation later in this file is a historical snapshot, not current status.
- **Current product decision:** DoseTwin is the flagship for a local research-review demonstration using OpenKBP-Opt `pt_241` and its matching archived `set_1` prediction. This is not MEDFORGE inference, treatment approval, or a clinical workflow. See [`FLAGSHIP_DECISION.md`](FLAGSHIP_DECISION.md), [`DEMO_ASSETS.md`](DEMO_ASSETS.md), and [`STATUS.md`](STATUS.md).
- **Deployment and data boundary:** local demo machine only. OpenKBP data and the archived prediction remain local; do not push, host, or redistribute them. The review is for further expert assessment, never patient treatment.
- **Role boundary:** an operator may provision a local `clinical_reviewer` account for DoseTwin review records. This does not verify medical qualification. Educator/admin accounts prepare general research records; student access is limited to assigned learning cases. See [`LOCAL_ACCESS_AND_PROFILES.md`](LOCAL_ACCESS_AND_PROFILES.md).
- **Evidence basis:** current implementation and verification are summarized in [`PROGRESS.md`](PROGRESS.md) and [`STATUS.md`](STATUS.md). Legal, institutional, and field-validation requirements remain open even where local software controls exist.

**Current implementation snapshot:**

| Area | State |
|---|---|
| DoseTwin flagship | Source-backed `pt_241` reference/archived-prediction comparison, voxel/ROI inspection, immutable reviewer decisions, author-scoped review records, and JSON/FHIR R4 exports are implemented. The output is archived, not our inference; checkpoint hash is unpublished and external-use terms are unresolved. |
| SurgiVision | Source-specific video, sampled annotations, and evidence views are implemented; results remain attached to their matching source and procedure. |
| FistulaGuard | Measured FiSaV signal inspection and quality tools are implemented. The FiSaV risk-index model/evaluation is deferred and must not be shown as a live prediction. |
| Academy/Educator | Source-backed assignments, learner evidence, manual grading/debrief, opt-in private gamification, and offline queued submission/recovery are implemented. |
| Security/package | Local Docker stack, TLS 1.3 proxy, SQLCipher application database, hash-chained audit, role checks, and Academy offline shell are implemented; verification records are in [`PROGRESS.md`](PROGRESS.md) and [`STATUS.md`](STATUS.md). Research files and local keys still need host disk protection. |
| Deployment | Local-only demo. A hosted/public instance is not approved for the installed research data. |

Since UX-49/50, Home presents the three product workspaces first, Academy identifies the learner's actual in-progress assignment/case and stages its investigation, Educator explains the existing lesson blocks and authored order, and Model Lab filters the existing model registry by supported operation and terms. These are navigation and inspection improvements; they do not add clinical inference, new scientific results, or deployment readiness. UX-50's Academy authenticated screenshot remains unrecorded because a local student sign-in is needed; see [`PR-UX-50`](ui/PR-UX-50-guided-learning-and-scientific-inspection.md).

**Datasets:**

| Source | State and use boundary |
|---|---|
| OpenKBP `pt_201` | Installed locally for source-backed DoseTwin inspection; no dataset license was established. Keep local. |
| OpenKBP-Opt `pt_241` | Matching reference and archived `set_1` prediction installed locally. Never compare against `pt_201`; prediction is not MEDFORGE inference; external-use terms remain unresolved. |
| FiSaV | 59 CC BY 4.0 source recordings installed. No risk-model result is in the demo; the separate patient sheet is not part of the current installed demo source set. |
| Endoscapes | Full sampled-frame release and BBox201 annotations installed; CC BY-NC-SA terms apply. Keep the demo local and non-commercial. |
| Appendix300 / CholecT50 / Cholec80 | Appendix300 is documented in [`DEMO_ASSETS.md`](DEMO_ASSETS.md); local CholecT50/Cholec80 source availability is recorded in [`STATUS.md`](STATUS.md) and its source manifests. Keep each clip and label attached to its matching source. |

**Status words used below:** "met", "partial", "missing", "not applicable" (N/A), and "intentionally out of scope". This is a software/evidence snapshot, not a legal or clinical compliance determination. Rehearsal gaps remain open even where an implementation exists.

---

## 1. Compliance matrix

Each requirement described in the supplied gap assessment has a row, including items the assessment says were absent from its short summary. The organizers' primary PDF was not supplied in this checkout, so exact wording and completeness have not been independently checked against it. Paths in "Evidence" are relative to the repo root.

| # | Requirement (PDF section) | Status | Evidence | Gap | Fix | Hours | Demo impact |
|---|---|---|---|---|---|---|---|
| 1 | Solve a precisely qualified medical problem (§1) | partial | `README.md`, `FLAGSHIP_DECISION.md`, and the L3 dossier | The product story is a research comparison workflow; there is no measured clinical outcome or validated patient-care problem. | Present review literacy/usability as the research objective; do not claim clinical impact. | Future pilot | High: jury framing |
| 2 | Fit a tangible clinical value chain: collect, analyse, restitute, field impact (§2) | partial | Collect: independent research datasets. Analyse: source-derived comparison/signal tools. Restitute: viewers, research-review records, and education workflows. | No clinical care-path or field-impact outcome is implemented or measured. | Explain current evidence-to-review/learning path and propose pilot measures only as future work. | Future pilot | High |
| 3 | Track choice and its priority (§3) | partial | Current decision is research/education and local DoseTwin review (`FLAGSHIP_DECISION.md`). | No clinical Track 2/3 service, live assistive model, or field deployment is claimed. | Pitch only the verified research/education scope; confirm judging fit with organizers if needed. | — | High |
| 4 | Track 2: asynchronous and synchronous care paths, strict tolerance of degraded rural networks (§3) | partial | Academy drafts and queued idempotent submissions replay after reconnect (`docs/ui/PR-UX-46-offline-submission-recovery.md`; `docs/PROGRESS.md`). | Offline recovery is implemented for learner submissions; there is no live synchronous care session and no clinical-care workflow. | Demonstrate the learner queue only if useful; describe its bounded scope. | Rehearsal | Medium |
| 5 | Track 2 priority: zero latency on the critical triage action (§3) | N/A to the flagship | There is no triage action. Local DoseTwin review records are research dispositions, not clinical actions. | Do not call a research review “triage” or claim clinical zero-latency. | — | Low |
| 6 | Track 3: assistive positioning (SADM), never replacing the physician's legal signature (§3, §6) | partial | DoseTwin shows a source-published archived prediction; CVS-AdaptNet remains gated. The DoseTwin review UI says the decision is for further expert assessment, not radiotherapy delivery. | No enabled MEDFORGE inference model or clinical recommendation exists in this flagship. | Frame the flagship as evidence inspection and human research review; do not claim SADM or clinical decision support. | — | High |
| 7 | Track 3 priority: explainability and bias control (§3, §6) | partial | DoseTwin exposes matched-case voxel/ROI differences, DVHs, metrics and source hashes. | No MEDFORGE model confidence, model attribution or clinical bias evaluation is claimed; the flagship contains no MEDFORGE prediction. | Explain the comparison and its provenance; do not add confidence or risk scores without a validated model. | — | High |
| 8 | Comply with INPDP (Tunisia) and GDPR; health data highly sensitive (§4) | partial | Local-only processing; account export/erasure, role scoping, audit and SQLCipher application DB are described in `README.md` and `PROGRESS.md`. | No legal compliance is claimed; legal basis, retention, DPIA and any INPDP declaration need qualified review before real-patient use. Research files and local secrets require host disk protection. | Keep the demo on the local machine; seek institutional/legal review before any clinical pilot. | Ongoing | Medium |
| 9 | Privacy by design (§4) | partial | Student access is assignment-scoped; source labels are delayed until review; gamification is private and opt-in; account export/erasure pseudonymizes retained learning/audit records (`apps/api/app/account_privacy.py`). | Educator screens still use provisioned display names; retention/legal basis remain institution-specific and unresolved. | Minimise account data; validate retention and pseudonymous display needs with an institution before deployment. | Ongoing | Medium |
| 10 | Encryption in transit, TLS 1.3 (§5) | met for the local Docker proxy | `PROGRESS.md` records `scripts/check-tls.mjs`: TLS 1.3 negotiated and TLS 1.2 refused. | This does not make the local app an institution-ready or public service. | Demo via the local Docker proxy only; do not expose API or broker ports. | — | Medium |
| 11 | Encryption at rest, AES-256 (§5) | partial | The Docker application DB uses SQLCipher AES-256; `PROGRESS.md` records the in-container encryption check. | Research datasets, key file and local CA are not encrypted by SQLCipher and depend on host disk protection. | Use OS full-disk encryption and protect the key separately; do not claim all local data is encrypted. | Ongoing | Medium |
| 12 | Anonymise or pseudonymise patient identities (§5) | met for research-source identifiers; partial for accounts | Research assets use publisher/source IDs. Account exports and erased-account retention use stable pseudonymous learner codes. | Active educator/cohort workflows can display provisioned names; no pseudonymous-only educator mode is claimed. | Keep demo account names synthetic and assess pseudonymous educator display before an institutional pilot. | Ongoing | Low |
| 13 | Prevent medical data leaks; non-repudiation of access (§5) | partial | General research writes require educator/admin; DoseTwin review decisions require the operator-designated `clinical_reviewer` role/admin. `grade_events` and review decisions are append-only, publication records are immutable, and sensitive actions write to the hash-chained audit log. | General research reads are open on loopback; this local role does not verify credentials or establish clinical authority. | Broader authorization and audit coverage if deployment scope expands | 4-5 | Medium; strong defense answer |
| 14 | Strict separation of layers: frontend, business logic, inference, database (§5) | partial | Frontend `src/`, logic `apps/api/app/`, inference in isolated workers (`workers/cvs-adaptnet`, `workers/fisav-stenosis`), DB migrations `db/migrations/` | SQLite is embedded in the API process. Separation is logical, not separate services. The backend route file is monolithic (router split deferred). | Docker services: `web`, `api`, `worker`, and a `db` volume. If the jury insists on a separate DB server, Postgres is the larger option (not recommended in time). | in 15 | Medium |
| 15 | Degraded mode and offline cache (§5) | partial | Academy app shell and queued, idempotent submission recovery are implemented and have a production-shell browser check (`PR-UX-46`). | Scientific source browsing and review writes are not represented as offline-capable; no offline care delivery is claimed. | Describe the tested Academy recovery boundary accurately. | Broader offline scope is out of flagship | High |
| 16 | Structured JSON exchange formats (§5) | met | Pydantic contract `contracts/openapi-implemented.json`, generated TS types `packages/contracts/generated-api.ts`, `npm run contracts:check`, JSON evidence exports (reports, comparisons, participation record) | None | None | 0 | Low (show the OpenAPI page) |
| 17 | Compatible with HL7 and FHIR paradigms for clinical records (§5) | partial | DoseTwin research-review evidence has a minimal FHIR R4 export validated against the official R4 schema (`docs/PROGRESS.md`, `PR-UX-48`). | This is not a validated hospital profile or live HL7/FHIR integration. | Demonstrate the export as an exchange-shaped research artifact only; hospital integration remains future work. | Future | Low to medium |
| 18 | Future integration with the hospital information system (§5) | partial | OpenAPI contract and minimal FHIR R4 research-review export; L3 describes a future partner integration. | No live SIH endpoint, agreed clinical profile, or hospital integration has been tested. | Treat integration as a future gated pilot step. | Future | Low |
| 19 | Clean navigation that limits cognitive load (§5) | partial | shadcn components, keyboard paths, responsive reviews (`docs/STATUS.md`) | Studio pages are dense, with lots of provenance text | Demo path through few screens; collapse provenance by default | 2 | Medium |
| 20 | Validate an alert or a prescription in at most 3 steps (§5) | N/A to approved flagship | No alert or prescription is generated. A DoseTwin research review requires role access, a decision and rationale; it is not clinical validation. | No clinical alert or triage workflow exists or is claimed. | Do not describe the research review as prescription or alert approval. | — | Low |
| 21 | Telemetry and IoT: MQTT or secure BLE, frame integrity (§5) | partial / not a clinical sensor system | The optional simulated device uses MQTT and checks frame integrity; FiSaV recordings are files, not live sensor streams. | Simulation does not establish secure BLE, live hardware integration, or clinical telemetry. | Label the device simulation explicitly. | — | Low |
| 22 | XAI: measurable confidence index on every algorithmic decision (§6) | N/A to current flagship; no MEDFORGE prediction | The comparison uses a source-published archived prediction and benchmark reference, not a MEDFORGE algorithmic decision. The FiSaV risk index is deferred. | There is no model confidence index to show. | State that no confidence score is available; do not fabricate one. | — | High |
| 23 | XAI: contextual explanation (regions of interest, triggering parameters) (§6) | partial for evidence inspection | DoseTwin exposes voxel/ROI differences, DVHs, metrics and source limitations; FistulaGuard offers descriptive measured-signal tools. | No explanation of a MEDFORGE model decision exists because the flagship has no MEDFORGE inference. | Show measured comparisons and provenance, not model attribution. | — | Medium |
| 24 | Black-box models forbidden (§6) | met for current demo boundary | No MEDFORGE prediction model is presented; gated model operations remain unavailable until their source/checkpoint/terms gates pass. The DoseTwin comparison uses an archived source output. | Preserve the no-inference claim; identify the archived output and its limits. | — | Positive defense point |
| 25 | Human in the loop: explicit validate or reject by the clinician (§6) | partial | A locally designated Clinical Reviewer records one of three immutable DoseTwin research decisions with required rationale; records include source evidence and audit hashes (`PR-UX-48`). | The designation is operator-provisioned and does not verify clinical credentials. The decision is not treatment approval. | Call it a human research review, not clinician validation. | — | High |
| 26 | UI states the consultative nature of the recommendation unambiguously (§6) | met for research boundary | DoseTwin identifies the benchmark/archive comparison and states that the review does not approve radiotherapy delivery. | No treatment recommendation or MEDFORGE prediction is made. | Preserve this boundary; do not introduce “consultative model output” language. | — | High |
| 27 | Quality warning: full mastery of generated code and third-party APIs; explain pipelines, libraries and internals (§6) | partial | Dependencies are pinned (`package.json`, `apps/api/requirements.txt`); the local runtime does not rely on a third-party prediction API. | The team must be able to explain the source-to-viewer path, computations, library choices and model/data gates used in the demo. | Rehearse the narrow demonstrated path and use the component notes at the end of this document. | Rehearsal | High (defense) |
| 28 | Economic viability: paying entity, access barriers, realistic server or hardware costs (§7) | partial | `§4` lists possible academic/radiotherapy education buyers and marks demand/costs as assumptions. | No customer interviews, price validation, or measured operating costs are recorded. | Validate with institutional interviews before quoting numbers. | Ongoing | Medium |
| 29 | L1: modular source, clear version history, exhaustive README with local install and dependencies (§8) | partial | README, `RUN_LOCAL.md`, `LOCAL_ACCESS_AND_PROFILES.md`, CI configuration, pinned dependencies, and local lint/typecheck/contract/build results are recorded. | This snapshot does not establish a passing hosted CI run for `7a754d8`, a release tag, or an independent clean-clone setup. Full setup also depends on acquiring local data; raw assets are not in Git. | Check the hosted workflow at the exact release commit, then verify a clean clone and preserve the asset/license boundary. | Before submission | Medium |
| 30 | L2: complete working system with a realistic synthetic medical dataset, at a live web URL (§8) | intentionally out of scope for this release | The approved demo is local Docker. Real research arrays have use limits (`DEMO_DATA_POLICY.md`); no public deployment is approved. | There is no hosted URL or approved synthetic hosted instance in the current release cutline. | Demonstrate locally; do not host installed research data. Revisit with cleared assets and an explicit deployment decision. | Future decision | High |
| 31 | L3: field feasibility, targeted health regulation, 3 and 6 month roadmap (§8) | partial | This draft covers local feasibility, regulatory boundary and a 3/6 month roadmap. | It is a planning document, not a legal opinion or validated pilot plan. | Keep assumptions explicit and seek expert/legal review before a clinical pilot. | Ongoing | High |
| 32 | Demo step 1: real patient scenario (§9) | partial / intentionally reframed | Walkthrough uses source-backed research case `pt_241`, not a patient-care vignette. | The product does not claim a patient-specific clinical case or outcome. | Introduce this as a research comparison and state the boundary. | — | High |
| 33 | Demo step 2: live MVP, no video or static mockup (§9) | met for local product walkthrough | Source-backed DoseTwin review and Academy/Educator workflows are available locally; routes and profile setup are in `LOCAL_ACCESS_AND_PROFILES.md`. | Rehearsal on the final demo machine remains necessary. | Follow the walkthrough below and keep a local offline copy ready. | Rehearsal | High |
| 34 | Demo step 3: defend component choices, scalability, failure resilience, data governance (§9) | partial | Explanatory material is in this document, README, L3 and source/provenance docs. | Team rehearsal on the actual demo setup is not recorded as complete. | Use the defense points in §12 and rehearse; do not infer readiness from docs alone. | Rehearsal | High |
| 35 | Robustness: autonomous Docker environment, local test database, backup access point (§9) | partial | Docker Compose, local DB, read-only dataset mounts and offline operation are documented; `PROGRESS.md` records degraded-mode checks. | A second-machine/backup-access-point rehearsal is not recorded. | Preflight on the actual demo machine; use a second local checkout only if it has been tested. | Rehearsal | High |

---

## 2. Current HackCure positioning

The product owner selected the DoseTwin guided research review described in [`FLAGSHIP_DECISION.md`](FLAGSHIP_DECISION.md). MEDFORGE is a **research and medical-education platform**, not a patient-care or triage product. The local flagship demonstrates source provenance, scientific comparison, human rationale, auditability and honest model limitations. The supervisor confirmed that the cahier is guidance rather than a literal feature checklist; the project does not claim a Track 2 or Track 3 clinical capability it has not built.

The strongest live story is the same-case `pt_241` benchmark reference and archived `set_1` prediction. Supporting modules stay independently usable. Academy submission recovery is a real degraded-network capability, but it does not make DoseTwin viewers or review writes offline clinical tools.

**Current gaps to state plainly:** no patient outcome or clinical utility evidence; the archived prediction is not MEDFORGE inference; model confidence is unavailable; the local reviewer role does not verify clinical qualification; hospital integration and external hosting are not approved; and dataset-use terms limit public display/redistribution.

## 3. Approved research problem and measurable next evidence

**Problem statement for the demo:** research teams need to inspect how a published dose prediction differs from its matching benchmark reference, understand per-ROI and voxel-level evidence, and keep a reasoned, source-linked review record.

This is not a qualified clinical problem statement and does not imply that better review prevents a clinical error. A future research/teaching pilot could measure time to complete a review, agreement among qualified reviewers, and how often disagreements are resolved after inspecting source evidence. These are proposed usability/research measures, not current results.

Do not present the historical dialysis or surgical injury scenarios as the product's patient story. Datasets are independent and do not describe one patient or pathway.

## 4. Business model hypotheses

- **Possible buyers:** academic radiotherapy departments, medical faculties, and research/education programmes.
- **Possible offer:** an institution-managed research/education installation, source curation, integration, and expert-review services. Third-party data are not bundled unless their terms permit it.
- **Unvalidated assumptions:** buyer demand, pricing, operating costs, and willingness to fund expert curation. Interview 3–5 institutional buyers before quoting a price.
- **Access barriers:** source permissions, reviewer availability, institutional IT/security approval, identity and governance integration, and legal/regulatory review.

Patients are not customers or target users. Do not describe the current product as access-surveillance tooling or a clinical service.

## 5. Model and inference claims

- **DoseTwin flagship:** uses the source-published OpenKBP-Opt `pt_241` archived `set_1` prediction against its matching reference. MEDFORGE performs the comparison and evidence capture; it does not generate the prediction. The archive does not publish a checkpoint hash and its external-use terms are not established.
- **Confidence/explainability:** no confidence or risk score exists for this archived output. Show measured differences, DVHs, ROIs, provenance, and caveats; never call these a model explanation or confidence estimate.
- **FiSaV:** measured signal tools and signal-quality inspection exist. A stenosis-risk index/evaluation is deferred until label semantics, external/domain review, and the proposal's gates are resolved. Do not demo probability, AUROC, referral advice, or a model decision.
- **CVS-AdaptNet and other gated models:** remain unavailable for live inference unless source, license, checkpoint, and evaluation gates are satisfied. A blocked capability is not a result.
- **Human review:** the reviewer records a research disposition for further expert assessment. It is not clinician approval, prescription validation, or authorization to treat.

## 6. Security and privacy status

- **Transport:** Docker Caddy proxy negotiates TLS 1.3 and refuses TLS 1.2, according to `PROGRESS.md` and `scripts/check-tls.mjs`. API and broker ports are not public services. This is a local-demo control, not institutional security certification.
- **Application database:** the Docker database uses SQLCipher AES-256; `PROGRESS.md` records the in-container check. Dataset files, key file, and local CA are outside that encryption boundary; use host full-disk encryption and protect keys/backups.
- **Audit and access:** sensitive records are hash-chained/append-only. Educator/admin can perform general research preparation/writes; Clinical Reviewer/admin can create and read permitted DoseTwin research reviews; reviewer records are author-scoped with admin oversight. Students see only assigned learning cases. General research browsing remains local-only and is not covered by complete account-based RBAC.
- **Privacy operations:** account export and erasure endpoints exist, and learning/gamification controls are documented. Legal basis, retention, DPIA, and INPDP analysis remain open for institutional or real-patient use. No GDPR/INPDP compliance claim is made.
- **Data minimisation:** installed datasets use source identifiers; learner gamification is private and opt-in. Never request learner health data or publish account data/credentials.

## 7. Local demo resilience

- Docker Compose, local database, and read-only dataset mounts support the approved local demo after assets and images are prepared. The demo does not depend on venue Wi-Fi.
- Academy's app shell, local answer drafts, and queued idempotent submissions recover after reconnect; this has a production-shell browser check (`docs/ui/PR-UX-46-offline-submission-recovery.md`). It applies to learner submissions only.
- Source viewers and DoseTwin review writes should be treated as workflows that require the local stack. Do not claim an offline DoseTwin review or a clinical degraded-network workflow.
- A backup laptop/restore drill must be rehearsed on the actual selected demo setup. Do not claim it is ready until verified.

## 8. Interoperability

A minimal FHIR R4 export exists for a DoseTwin research-review record and was validated against the official R4 schema. It is an exchange-shaped research artifact, not a hospital profile, clinical record approval, HL7 v2 feed, or live SIH integration. Agree on profiles, terminology, privacy, and governance with a partner before any endpoint test.

## 9. Workflow and action boundary

The DoseTwin reviewer selects a research disposition, supplies a required rationale, records an immutable decision, and can reopen history or export JSON/FHIR evidence. This supports an auditable research review. It does not validate an alert, prescribe, approve a treatment plan, or substitute for a qualified clinician's legal signature. No clinical action-step target is claimed.

## 10. Hosting and data policy

The current release cutline is **local-only**. Do not publish the installed OpenKBP/OpenKBP-Opt or Endoscapes assets, derived screenshots, raw media, credentials, or local database. Their detailed terms and allowed display contexts are in [`DEMO_DATA_POLICY.md`](DEMO_DATA_POLICY.md). A synthetic public demo would be a separate product/deployment decision and is not part of this current cutline.

## 11. Deliverables and remaining jury preparation

- **Implemented and locally evidenced:** source-backed workspaces; DoseTwin `pt_241` review; Academy/Educator workflow; local Docker controls; TLS/DB-encryption checks; audit log; and bounded Academy offline recovery. UX-49/50 add the workspace entry, staged Academy navigation and scientific-inspection improvements. This is local evidence, not proof of hosted CI on the current commit, independent-machine readiness, or a completed jury rehearsal. See [`STATUS.md`](STATUS.md), [`PROGRESS.md`](PROGRESS.md), [`ui/PR-UX-48-clinical-reviewer-workflow.md`](ui/PR-UX-48-clinical-reviewer-workflow.md), [`ui/PR-UX-49-workspace-entry-educator-canvas.md`](ui/PR-UX-49-workspace-entry-educator-canvas.md), and [`ui/PR-UX-50-guided-learning-and-scientific-inspection.md`](ui/PR-UX-50-guided-learning-and-scientific-inspection.md).
- **Required before the event:** confirm source assets and saved review are present on the selected demo machine; provision the intended local profile in that same database; rehearse the walkthrough below; verify Docker startup, local certificate, and display resolution; prepare an offline backup only after a successful rehearsal.
- **Not a current deliverable:** hosted real-data URL, MEDFORGE dose inference, FiSaV risk probability, clinical triage, credential verification, or live hospital integration.

For exact local setup, routes, source import, account provisioning, and profile boundaries, follow [`LOCAL_ACCESS_AND_PROFILES.md`](LOCAL_ACCESS_AND_PROFILES.md) and [`RUN_LOCAL.md`](../RUN_LOCAL.md). Do not put credentials in this document.

---

## 12. Live jury walkthrough (about 6 minutes; local app and installed research assets)

### Before the jury arrives

1. Follow [`LOCAL_ACCESS_AND_PROFILES.md`](LOCAL_ACCESS_AND_PROFILES.md) and [`RUN_LOCAL.md`](../RUN_LOCAL.md) on the demo machine. The dataset files, local database, archived-prediction import, and account grants are local state; they are not included in a Git push.
2. Confirm the full `pt_241` reference and matching archived `prediction-set_1.csv` are installed and checksum-verified. Confirm the local app lists the archived artifact and opens its comparison. Do not use the `pt_201` case as a substitute for `pt_241`.
3. Provision a separate `clinical_reviewer` account in the same local database the app will use. For the local development profile, use the account-creation commands in [`LOCAL_ACCESS_AND_PROFILES.md`](LOCAL_ACCESS_AND_PROFILES.md). For Docker, with the stack running, provision inside the API container so it uses the encrypted demo database:

   ```sh
   docker compose exec api python /app/scripts/create_local_learning_user.py \
     --username jury-reviewer --display-name "Jury Research Reviewer" \
     --role clinical_reviewer
   ```

   Enter a private password at the prompt and keep it out of the deck, repository and this document. A fresh database has no reviewer credentials. This local role does not verify medical qualifications.
4. Open <http://127.0.0.1:5173/studio/dosetwin/cases/current> in the local development profile, or the local Docker URL from the README. If using Docker, rehearse with the Docker database and its prepared reviewer profile; do not assume credentials from the development database carry over.
5. Do one complete rehearsal and confirm the screens render at the demo resolution. If `pt_241`, its archived artifact, or the prepared account is missing, use the clearly labelled fallback at the end; do not invent a result.

### Walkthrough

| Time | On screen and narration |
|---|---|
| 0:00–0:40 | Introduce this as a **research review of a published archived dose prediction**. “We are inspecting a research benchmark comparison, not a patient's active treatment plan. These datasets are independent research cases.” |
| 0:40–1:30 | Open DoseTwin and select OpenKBP-Opt `pt_241`. Identify the matching reference and `set_1` prediction. Point out the **ARCHIVED PREDICTION** provenance badge: this output was published by another project; MEDFORGE did not generate it. |
| 1:30–2:40 | Show the aligned same-case reference and prediction, signed dose difference, and cumulative DVH. Select an ROI and a voxel; explain that the numbers are calculated from the matched source arrays. Do not call the differences clinical risk or treatment deviation. |
| 2:40–3:30 | Open the voxel/research-review panel. Explain that the operator-provisioned Clinical Reviewer role gates this action. It is a local role label only and does not verify a medical license or hospital authority. |
| 3:30–4:30 | Choose one available research disposition—*Accept for further expert assessment*, *Request revision*, or *Reject research candidate*—and enter a specific rationale based on the displayed comparison. Record the review. State that the decision is immutable and can be superseded with a new review; it never approves treatment. |
| 4:30–5:20 | Show the saved review history with source and audit hashes. Export the JSON report, then show the minimal FHIR R4 export as a schema-validated research exchange shape, not a live hospital connection. |
| 5:20–6:00 | Close with limits: no MEDFORGE inference, no published checkpoint hash for the archive, unresolved external-use terms, no confidence score, no clinical validation, and no public hosting of these assets. The local data policy and source attribution stay with the case. |

### Short defense answers

- **“What does your AI predict?”** MEDFORGE does not make this prediction. We compare the source-published archived `pt_241` output with its matching benchmark reference and make the provenance visible.
- **“How confident is the prediction?”** No checkpoint hash or confidence estimate is published for this archived output. We do not invent one. We show measured differences and their source limitations.
- **“Is this clinical approval?”** No. The reviewer records a research disposition for further expert assessment. The local role does not verify a clinician's identity, and the record cannot approve a radiotherapy plan or authorize treatment.
- **“Can you share the demo online?”** Not with these installed assets. The selected release is local-only; the OpenKBP/OpenKBP-Opt display and redistribution terms are not cleared for public hosting.
- **“What works offline?”** The local Docker demo runs without venue internet after preparation. Separately, Academy learner submissions can queue and replay after reconnect. Do not claim offline source browsing or offline DoseTwin review writes.

### Fallback if the flagship is not ready on the machine

Do not improvise a `pt_241` prediction. You may show the source-backed `pt_201` benchmark reference/DVH as a **different, non-comparison case**, or switch to a separate SurgiVision source view with that source's own labels. Clearly name the switch and its limits; never imply a shared patient, procedure, prediction, or synchronized result.

---

## 13. Final demo preflight

The software build is not the same as event readiness. Before the event:

1. Use [`LOCAL_ACCESS_AND_PROFILES.md`](LOCAL_ACCESS_AND_PROFILES.md) and [`RUN_LOCAL.md`](../RUN_LOCAL.md) to prepare the exact local profile and account the team will use. No default reviewer password exists.
2. Confirm local `pt_241` reference and matching archived prediction manifests, import, reviewer account, and saved report on the selected machine/database.
3. Start the chosen Docker or local profile with the network disconnected after image/source preparation; verify the UI and source assets still load. Do not claim DoseTwin review writes are offline.
4. Verify that the Clinical Reviewer account can record and reopen a research review and that no educator/student account is used for that action. Confirm the role wording is understood as local provisioning, not credential verification.
5. Rehearse the six-minute walkthrough, check the local TLS certificate if using Docker, confirm the display resolution, and keep a tested backup plan. Do not show raw OpenKBP data in material that will leave the demo machine.

Current machine and source-readiness evidence is in [`STATUS.md`](STATUS.md) and [`DEMO_ASSETS.md`](DEMO_ASSETS.md); current check results and known limits are in [`PROGRESS.md`](PROGRESS.md). Refresh those checks on the actual demo machine instead of relying on this document as proof of readiness.

---

## Top 5 risks to the jury result

1. **The archived output is mistaken for our AI.** Mitigation: call it an archived prediction and state that MEDFORGE did not generate it.
2. **The local reviewer designation is mistaken for verified clinical authority.** Mitigation: explicitly state that the operator assigns a local role and no credential is checked.
3. **Dataset terms are mistaken for public-display permission.** Mitigation: demo on the local machine only; do not distribute raw data, derived screenshots, or reports without a separate rights review.
4. **The demo machine lacks source assets, import, or profile state.** Mitigation: perform the preflight and full rehearsal on that machine, and use the documented honest fallback if `pt_241` is unavailable.
5. **Research evidence is presented as patient benefit.** Mitigation: make no diagnosis, treatment, model-confidence, clinical utility, or patient-outcome claim.

## Questions for the organizers

1. Since the supervisor described the cahier as guidance, which items will be used as judging criteria versus optional product suggestions?
2. Is a local-only demo acceptable where the installed research datasets do not grant public hosting/redistribution rights?
3. What duration, file format, and technical details are required for the final L3 dossier and demo?
4. May a non-commercial local demonstration show the specific research sources under their respective licenses and attribution rules?
5. What disclosures are required for AI-assisted software development when the team can explain and maintain the implementation?

## One sentence per component (for the defense)

- **Frontend (React, Vite, TypeScript):** renders the viewers and learning flows and talks only to our local API through a same-origin proxy.
- **API (FastAPI, Pydantic):** validates every request against typed schemas, enforces roles, and is the single source of the OpenAPI contract.
- **Database (SQLite with migrations):** stores accounts, learning records and evidence. Migrations run at start-up, and immutable records are enforced by triggers.
- **Auth:** local accounts with PBKDF2 password hashes and hashed, expiring session tokens. General research writes need educator/admin; DoseTwin research-review routes use the local Clinical Reviewer role/admin. This designation does not verify clinical credentials.
- **Datasets:** read-only local files verified by SHA-256 manifests, never downloaded from user input.
- **SurgiVision:** expert-annotated frames with filters, side-by-side compare, and a commit-then-reveal CVS self-check against the annotator majority.
- **FistulaGuard:** measured FiSaV signals with Welch PSD, spectrogram, zero-phase filters, ECG beat detection, and the occlusion-test marker shown as a protocol event.
- **DoseTwin:** OpenKBP benchmark slices and DVHs computed from source arrays. It is not a treatment plan and is unpublishable.
- **Workers:** models run in isolated Python environments as separate processes, never inside the API.
- **FiSaV risk index:** deferred; no prediction, confidence, referral recommendation, or model-based human decision is part of this release.
- **Launcher:** `npm start` runs both services on any OS, and a watchdog stops them if the launcher dies.
- **Contract and tests:** generated TypeScript types from OpenAPI, plus pytest, Vitest and Playwright in CI.

---

## Historical reconciliation with teammate review (baseline only)

> The material below records an audit of older commits and an older worktree. Its branch names, dataset availability, test counts, open questions, and proposed tasks are historical snapshots, not current status. For current facts use the opening snapshot, compliance matrix, [`STATUS.md`](STATUS.md), [`PROGRESS.md`](PROGRESS.md), and [`DEMO_ASSETS.md`](DEMO_ASSETS.md). The approved DoseTwin flagship decision is recorded in [`FLAGSHIP_DECISION.md`](FLAGSHIP_DECISION.md).


**Review being reconciled:** `docs/review/MEDFORGE_HackCure_Cahier_des_Charges_Gap_Assessment (1).docx`. It assessed GitHub commit `d91632b` and dated itself 10 October 2026. Our local work sits on branch `upgrade/hackcure-compliance`: commits up to the `716cb43` merge, plus uncommitted Docker, encryption and audit-log work.

**How claims were checked:** against code and script output on 2026-10-10, not from memory.

**Numbers in this section, all from fresh runs:**
- pytest: 122 passed, 1 skipped (the SQLCipher-only test). Command: `python -m pytest -q apps/api/tests`, uncommitted working tree.
- Vitest: 60 passed in 18 files. Command: `npx vitest run`.
- DoseTwin cross-check: 23 comparisons, maximum absolute difference 7.647e-06 Gy. Source: `docs/openkbp-pt201-validation.json`, written by `scripts/crosscheck_openkbp_pt201.py`.

### Item by item

| Teammate statement | Agree / disagree / outdated | Evidence (verified) |
|---|---|---|
| No single qualified clinical problem (major gap) | Agree | Still true in code and README. Our section 3 proposes framings, but nothing is implemented. |
| Medical MVP functionality is a strong basis | Agree | Viewers, reports and learning flows exist and are tested. |
| Track 3: only an archived `pt_241` prediction; in-app inference gated | Agree for `d91632b`. Partly outdated locally. | `pt_241` comparison is archived output, not our inference (`apps/api/app/dose_artifacts.py`). Locally, an isolated FiSaV evaluation worker exists (`workers/fisav-stenosis/evaluate.py`), protocol frozen in `docs/FISAV_EVALUATION_PROTOCOL.md`, **not yet run**, and no UI exists. |
| Explainability and measurable confidence missing | Agree | No confidence or explanation display exists yet. |
| No clinician accept/reject record | Agree | Not built on either side. Educator grading is not clinical review (we agree with their section 10 wording). |
| TLS 1.3 and AES-256 not demonstrated | Outdated in progress, but still not demonstrated | Uncommitted: `docker-compose.yml`, `docker/Caddyfile.proxy` (TLS 1.3 only), `scripts/check-tls.mjs`, `apps/api/app/db_driver.py` (SQLCipher), `scripts/docker-secrets.mjs`. Images built, but the TLS check and the in-container encryption test have not run. Treat as "not demonstrated" until those pass. |
| Audit and non-repudiation not shown | Outdated (uncommitted) | `db/migrations/0102_audit_log.sql`, `apps/api/app/audit.py`, and hooks in the auth, learning, report, comparison, annotation and self-check routes. `apps/api/tests/test_audit_log.py` (5 tests) covers trigger blocking, tamper detection after a bypass, and flow coverage. |
| General research routes lack RBAC | Outdated | Research POST/PUT routes require an educator or admin since commit `b0f3999` (`require_research_writer` in `main.py`, `apps/api/tests/test_write_auth.py`). Research reads remain open on loopback, so that part still stands. |
| Layer separation exists; Docker and offline missing | Partly outdated | Compose with proxy, web, api, an on-demand worker (`network_mode: none`) and volumes exists uncommitted. Offline mode is still missing. |
| HL7/FHIR not demonstrated | Agree | Nothing exists. |
| UX 3-step audit not demonstrated | Agree | Educator grading still needs several inputs (section 9). |
| L1 largely met; workflow red | Agree on upstream; outdated for our branch on the contract | See CI section below. |
| L2 major gap; L3 missing | Agree | Nothing changed. |
| DoseTwin facts (23 metric comparisons, maximum difference about 0.0000076471 Gy; `pt_241` only for the real comparison) | Agree, verified | `docs/openkbp-pt201-validation.json`: comparison_count 23, max_absolute_difference_gy 7.647058822612962e-06. |
| SurgiVision counts (1,933 BBox201; CholecT50 1,318 sampled and 1,128 labelled) | Cannot verify locally | Endoscapes is still downloading on this machine and CholecT50 is not installed. These figures come from upstream docs. |
| FistulaGuard: "no supported labeled stenosis outcome" | **Disagree in part; open question** | See the fact check below. A patient-level stenosis Y/N field exists in the official patient sheet. Its criterion is undocumented. |
| FistulaGuard: the occlusion field must not be repurposed as a label | Agree, verified | The sheet's separate column N "OCCLUSION TEST (Y/N)" and its location column show `Occlusion` marks a protocol manoeuvre. The app labels it that way (`OCCLUSION_MEANING` in `apps/api/app/fistulaguard_tools.py`). |
| FistulaGuard feature list | Outdated | Not mentioned in the review: zero-phase filters, ECG beat detection, per-beat features, occlusion marker, educator annotations (`fistulaguard_tools.py`, `signal_processing.py`, `src/features/fistulaguard/SignalTools.tsx`). |
| Academy and Educator: impressive, but not clinical human-in-the-loop | Agree | Unchanged. Also added locally: the CVS self-check block and starter lessons as data. |
| Preferred positioning: DoseTwin as a Track 3 flagship | **Disagree with our earlier choice; decision pending** | Our audit preferred FiSaV (Option A). See `docs/FLAGSHIP_DECISION.md`. |
| CI: contract check failed at `d91632b`, production build skipped | Agree, reproduced; upstream has since changed; fixed on our branch | See below. |

### FiSaV label fact check (answers the critical question)

| Question | Finding | Source |
|---|---|---|
| What is the label? | A patient-level "STENOSIS: Presence (Y/N)" field, column BA of `patient_information.xlsx` | OSF project HYPFR. File SHA-256 `a180e669...e6b1`, equal to the OSF-published hash. |
| How was it obtained? | It sits inside the sheet's "ECHOGRAPHIC EXAMINATION" section (columns Y to BD). Next to it are "Distance from anastomotic chamber (mm)", "Residual diameter (mm)" and "Normal diameter (mm)". The sheet does not say who assigned it or how. | Header cells of the sheet |
| Criterion and threshold | **Not documented** in the README or the sheet. The descriptor paper could not be retrieved here. Under the obvious reading, only 14 of the 38 positive patients with both diameters reach 50% diameter reduction, and some values are negative. So a simple 50% rule does not reproduce the label, or the columns mean something else. | Aggregate computation from the sheet on 2026-10-10 |
| Patient-level? | Yes. 59 rows with 59 unique patient IDs. Each patient has exactly one recording. | Sheet plus `data/fisav/medforge-source-manifest.json` |
| Class counts | 40 Y, 19 N | Sheet; also the README: "59 end-stage renal disease patients (40 with stenoses and 19 without stenoses, all without multi-branch fistulas)" |
| Licence | CC BY 4.0. README: "The FiSaV dataset is provided with a Creative Commons Attribution International license (see the CC-BY license file)". OSF project licence id `563c1cf88c5e4a3877f9e96a` (CC BY 4.0). | `README.pdf` on OSF; OSF API |
| Intended uses named by the authors | Includes "development of algorithms and artificial intelligence models for the detection of haemodynamic changes and ominous signs of AVFs dysfunctions, such as stenoses" | `README.pdf` |

**Conclusion.** The teammate is right that the repo, at `d91632b`, had no supported label: the app only used the CSVs, and the occlusion column is not a label. A real patient-level stenosis label does exist in the official dataset, and its authors name stenosis detection as an intended use.

Our audit assumed an "ultrasound reference label". That assumption is **only partly confirmed**:
- The field sits in the echographic section.
- But the defining criterion and threshold are not documented and cannot be reconstructed from the sheet.

Until a clinician or the dataset authors confirm the criterion, any risk index must say "reference label: stenosis presence as recorded in the dataset sheet (criterion not documented)". It must not say "ultrasound-confirmed stenosis".

### CI reproduction

Clean worktrees in the scratchpad: fresh Python 3.13 venv with `apps/api/requirements-test.txt`, then `npm ci`. Local Node is 24.13.0, while CI uses 22.16.0 from `.nvmrc`. `openapi-typescript` 7.13.0 comes from the lockfile in both.

| Checkout | `contracts:check` | Production build | Diagnosis |
|---|---|---|---|
| `d91632b` | Fails: "Generated types are not up-to-date!" | Passes locally | **Real drift.** Regenerating with FastAPI 0.128.2 adds the `ctx` and `input` fields to `ValidationError` in `contracts/openapi-implemented.json` (+7 lines), so the TypeScript types are stale. Still fails after normalising line endings. Matches the teammate's CI log. |
| Our branch `716cb43` | Fails on a Windows checkout only; **passes with LF line endings** | Passes | **Not drift.** The committed contract was regenerated in `b0f3999`. The Windows checkout converts the generated file to CRLF (`core.autocrlf=true`), and `--check` compares bytes. On Linux CI the file is LF. |
| Upstream tip `7f151cc` (GitHub run 38068667902) | Skipped | Skipped | Now fails earlier: "Browser shell tests" with 2 failed, 14 passed. The failing tests are "SurgiVision frame picker stays readable beside the professional sidebar at tablet width" and "SurgiVision routes reviewers from native video to source-matched labels". The tip's committed contract still lacks `ctx`, so the contract check would fail next. |

**Proposed fix** (not applied; it touches the shared branch and needs your approval):
1. Merge our regenerated contract.
2. Regenerate again after merging the upstream tip, since `7f151cc` changed the contract (+64 JSON lines).
3. Add `.gitattributes` with `contracts/openapi-implemented.json text eol=lf` and `packages/contracts/generated-api.ts text eol=lf`, so the check is deterministic on every OS.
4. Ask the collaborator to fix the two SurgiVision browser tests, or quarantine them with a reason.
5. Confirm a green run before tagging a baseline.

### Open questions where evidence cannot settle the disagreement

1. **Flagship (resolved after this historical audit):** DoseTwin was selected for the current local research-review demonstration; see `docs/FLAGSHIP_DECISION.md`. This older audit's open-question wording is retained here only to explain the snapshot above.
2. **FiSaV label criterion:** what defines "stenosis present", and was it assigned from ultrasound? This needs the dataset authors (contact emails are in the README) or a nephrologist.
3. **SurgiVision counts and CholecT50 licence:** cannot be verified on this machine until those datasets are installed here.
