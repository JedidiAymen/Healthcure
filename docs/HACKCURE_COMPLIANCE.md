# HackCure compliance audit and plan

**Source of truth:** the organizers' *Cahier des Charges Spécifique, Projets Participants* (3 pages, French). The brief said the file was at `docs/hackcure/`, but the copy I read is at `HackCure/Cahier des Charges HackCure Participant.pdf`, next to the repo. It has not been added to the repo.

- **Branch and date:** `review/cobalt-dosetwin-d2-d3`, 2026-10-10.
- **Session type:** audit and plan only. No application code was changed for this document.
- **Upstream:** the remote is 4 commits ahead (CI changes by the collaborator) and is not synced in this audit.

**Where the upgrade work stands:**

| Phase | State |
|---|---|
| 1 | Done, except the router split, which is deferred |
| 2 (SurgiVision) | Done |
| 3 (FistulaGuard) | Done |
| 4 | Started: worker and patient-sheet script written, evaluation not yet run |

**Datasets:**

| Dataset | State |
|---|---|
| OpenKBP pt_201 | Installed |
| FiSaV | All 59 recordings installed, plus the patient sheet, which the user approved storing |
| Appendix300 clip | Installed |
| Endoscapes | Still downloading (about 1.4 of 6.3 GB at last check) |
| CholecT50, OpenKBP-Opt pt_241 | Not installed |

**Status words used below:** "met", "partial", "missing", "not applicable" (N/A). Hours are focused engineering estimates for one developer working with an assistant. They assume no surprises and do not include rehearsal.

---

## 1. Compliance matrix

Every requirement in the PDF has a row, including ones the brief did not list. The paths in "Evidence" are relative to the repo root.

| # | Requirement (PDF section) | Status | Evidence | Gap | Fix | Hours | Demo impact |
|---|---|---|---|---|---|---|---|
| 1 | Solve a precisely qualified medical problem (§1) | partial | `README.md`, `docs/MVP_SCOPE.md` (three evidence domains, education framing) | The README describes datasets and features. It does not name one clinical problem, a clinical user, or a measurable outcome. | Adopt one framing from §3 of this document and put it in the first lines of the README, the L3 dossier and the demo | 2 | High: jury's first question |
| 2 | Fit a tangible clinical value chain: collect, analyse, restitute, field impact (§2) | partial | Collect: FiSaV sensors and ECG (`apps/api/app/fisav.py`). Analyse: `signal_processing.py`, `fistulaguard_tools.py`. Restitute: viewers, educator review (`src/pages/Pages.tsx`). | No "field impact" link and no alert or triage output. The chain ends at learning, not at care. | Map each step explicitly (§3). Add a consultative "refer for ultrasound" suggestion with human accept or reject (§5). | 1 doc + §5 work | High |
| 3 | Track choice and its priority (§3) | partial | See §2 of this document | Track 2 wants degraded-network tolerance and zero-latency triage. Track 3 wants explainability and bias control. Neither is fully met. | Hybrid framing (§2). Implement §5 and §7. | see §13 | High |
| 4 | Track 2: asynchronous and synchronous care paths, strict tolerance of degraded rural networks (§3) | partial | Asynchronous: assignment, submit, grade, debrief (`apps/api/app/learning.py`). Submit is idempotent (migration `0010_grade_idempotency.sql`, `learning_submission_receipts`). | No offline cache, no service worker, no queued writes. A dropped network mid-mission loses unsaved answers. Synchronous paths are minimal: there's no live session. | §7: PWA app-shell cache, local draft autosave, queued idempotent submit | 8-12 | High if asked "what if the network drops?" |
| 5 | Track 2 priority: zero latency on the critical triage action (§3) | partial | Local-first. Every viewer and API call is on loopback, and there's no third-party call at runtime (checked by grep). | There's no triage action as such. The closest critical actions are "submit" and "accept or reject suggestion". | Make these actions local and optimistic (§7, §9) | in §7 | Medium |
| 6 | Track 3: assistive positioning (SADM), never replacing the physician's legal signature (§3, §6) | partial | Every view carries research-only copy. CVS-AdaptNet is gated (`_cvs_worker_gate` in `apps/api/app/main.py`). The FiSaV worker is written (`workers/fisav-stenosis/evaluate.py`). | No running assistive model and no "consultative only" banner on a prediction. | §5 option A, with an explicit "consultative, the clinician decides" banner | 8-10 | High for Track 3 |
| 7 | Track 3 priority: explainability and bias control (§3, §6) | missing | Methods are documented in API responses (`method` and `limitations` fields in `fistulaguard_tools.py`) | No confidence index, no per-decision explanation, no bias statement on any prediction | §5: probability, CI, per-feature contributions, bias panel | in 6 | High |
| 8 | Comply with INPDP (Tunisia) and GDPR; health data highly sensitive (§4) | partial | Local-only; PBKDF2 passwords and hashed session tokens (`apps/api/app/auth.py`); student data scoped (`student_research_scope` middleware in `main.py`); participation export (`/api/v1/academy/progress/export`) | No data inventory, retention policy, erasure endpoint, DPIA or INPDP declaration analysis. The new patient sheet is stored unencrypted. | §6 checklist, erasure and export endpoints, encrypted volume | 4-6 | Medium (defense question) |
| 9 | Privacy by design (§4) | partial | Minimal labels file (age and sex excluded): `scripts/acquire_fisav_patient_sheet.py`. Reference labels hidden from students until review. Opt-in gamification. | Not documented as a design principle. No pseudonymisation of learners in exports and educator views. | Document it (§6). Add pseudonymous display mode. | 2 | Medium |
| 10 | Encryption in transit, TLS 1.3 (§5) | missing | Services bind to 127.0.0.1 over plain HTTP (`scripts/dev.mjs`) | No TLS at all | Reverse proxy (Caddy or nginx) in Docker with TLS 1.3 only and a locally trusted certificate (§6) | 3-4 | Medium; easy to show with `curl -v` |
| 11 | Encryption at rest, AES-256 (§5) | missing | Plain SQLite `data/local.sqlite3`; datasets in plain files | No encryption of the database, submissions or patient sheet | SQLCipher (AES-256) for the app database in the Linux container. Encrypted volume or OS-level encryption for datasets. (§6) | 4-6 | Medium; risky on Windows outside Docker |
| 12 | Anonymise or pseudonymise patient identities (§5) | met for research data, partial for accounts | Datasets carry only source IDs (`pat001`, Endoscapes video and frame IDs, OpenKBP `pt_201`). No patient names anywhere. | Learner and educator accounts show display names. No pseudonymous mode. | Pseudonymous learner IDs in exports and cohort views (§6) | 2 | Low |
| 13 | Prevent medical data leaks; non-repudiation of access (§5) | partial | Research writes require educator or admin (Phase 1, `require_research_writer`). `grade_events` is append-only, publication records are immutable (triggers in `0005_learning_delivery.sql`), CVS self-checks are immutable (`0100_cvs_self_checks.sql`). | No general audit log of reads and writes (logins, publishes, grades, report saves, downloads). Research reads are open on loopback. | Hash-chained append-only `audit_log`, written by every sensitive route (§6) | 4-5 | Medium; strong defense answer |
| 14 | Strict separation of layers: frontend, business logic, inference, database (§5) | partial | Frontend `src/`, logic `apps/api/app/`, inference in isolated workers (`workers/cvs-adaptnet`, `workers/fisav-stenosis`), DB migrations `db/migrations/` | SQLite is embedded in the API process. Separation is logical, not separate services. The backend route file is monolithic (router split deferred). | Docker services: `web`, `api`, `worker`, and a `db` volume. If the jury insists on a separate DB server, Postgres is the larger option (not recommended in time). | in 15 | Medium |
| 15 | Degraded mode and offline cache (§5) | missing | Nothing offline. The 3.5 s fetch timeout shows an error. | §7 | §7 | 8-12 | High |
| 16 | Structured JSON exchange formats (§5) | met | Pydantic contract `contracts/openapi-implemented.json`, generated TS types `packages/contracts/generated-api.ts`, `npm run contracts:check`, JSON evidence exports (reports, comparisons, participation record) | None | None | 0 | Low (show the OpenAPI page) |
| 17 | Compatible with HL7 and FHIR paradigms for clinical records (§5) | missing | None | No FHIR or HL7 representation | Minimal FHIR R4 export of a recording summary and the consultative risk output, tagged synthetic and educational (§8) | 3-4 | Low to medium |
| 18 | Future integration with the hospital information system (§5) | partial | OpenAPI contract; loopback API | No integration story | One paragraph in L3 plus the FHIR export (§8) | 1 | Low |
| 19 | Clean navigation that limits cognitive load (§5) | partial | shadcn components, keyboard paths, responsive reviews (`docs/STATUS.md`) | Studio pages are dense, with lots of provenance text | Demo path through few screens; collapse provenance by default | 2 | Medium |
| 20 | Validate an alert or a prescription in at most 3 steps (§5) | partial | Report save is 1 click, plus a sign-in dialog if needed. Student submit is 1 click after answering. | Educator grading takes about 6 to 12 interactions (§9). No alert validation exists yet. | Prefilled grading and accept or reject in at most 3 steps (§9) | 3-4 | Medium |
| 21 | Telemetry and IoT: MQTT or secure BLE, frame integrity (§5) | N/A (Track 1) | FiSaV is recorded offline. We verify file SHA-256 and timestamp integrity (`fisav.py` features). | No live sensors | State N/A clearly. Mention per-file integrity as the analogue. | 0 | Low |
| 22 | XAI: measurable confidence index on every algorithmic decision (§6) | missing | None | No confidence index | §5 | in 6 | High |
| 23 | XAI: contextual explanation (regions of interest, triggering parameters) (§6) | missing | Beat detection shows method text and per-beat values, which is closest | No per-decision explanation | §5: per-feature contributions plus the beat-synchronous plot | in 6 | High |
| 24 | Black-box models forbidden (§6) | met by design | Only CVS-AdaptNet would be a deep model, and it is gated. The planned FiSaV model is a linear model with a JSON checkpoint (`workers/fisav-stenosis/evaluate.py`). | None | Keep it that way | 0 | Positive talking point |
| 25 | Human in the loop: explicit validate or reject by the clinician (§6) | missing | Educator grading is human review of learners, not of the AI | No accept or reject of an algorithmic output | §5: accept or reject with reason, logged in the audit log | 3 | High |
| 26 | UI states the consultative nature of the recommendation unambiguously (§6) | partial | Research-only copy everywhere (`Pages.tsx`, viewer footers) | No recommendation exists yet | Banner on every prediction: "Consultative model output. The clinician decides." | in 6 | High |
| 27 | Quality warning: full mastery of generated code and third-party APIs; explain pipelines, libraries and internals (§6) | partial | Libraries pinned (`package.json`, `apps/api/requirements.txt`). No third-party API at runtime. | The team must be able to explain AI-assisted code. A very large surface (about 70 routes) is a liability under questioning. | One-sentence-per-component sheet (end of this document). Demo only paths we can explain. | 3 | High (defense) |
| 28 | Economic viability: paying entity, access barriers, realistic server or hardware costs (§7) | missing | None | Not formalised | §4 | 3 | Medium |
| 29 | L1: modular source, clear version history, exhaustive README with local install and dependencies (§8) | partial | `README.md` (76 lines), `RUN_LOCAL.md`, CI `.github/workflows/ui-and-api.yml`, many tests | README is long on provenance, short on install. No Docker. Windows path now `npm start`. Our work is uncommitted, so version history needs clean commits. | README rewrite, Docker section, clean logical commits (user approval needed) | 3-4 | Medium |
| 30 | L2: complete working system with a realistic synthetic medical dataset, at a live web URL (§8) | missing | Synthetic fixtures exist only in tests. OpenKBP has a `MEDFORGE_SOURCE_KIND=synthetic-test` mode (`main.py`). | No hosted URL, no synthetic generator per module, and real datasets cannot be hosted publicly | §10: hosted synthetic-only instance plus local real-data Docker | 10-14 | High: mandatory deliverable |
| 31 | L3: field feasibility, targeted health regulation, 3 and 6 month roadmap (§8) | missing | Raw material in `docs/BLOCKERS.md`, `docs/PARITY.md`, `docs/STATUS.md` | No dossier | §11 skeleton, then slides | 4-6 | High |
| 32 | Demo step 1: real patient scenario (§9) | missing | None | No scripted clinical case | §12 | 1 | High |
| 33 | Demo step 2: live MVP, no video or static mockup (§9) | partial | App runs live and offline on installed data | Needs a rehearsed path and Docker | §12, §7 | in others | High |
| 34 | Demo step 3: defend component choices, scalability, failure resilience, data governance (§9) | partial | Material exists in this document | Not rehearsed | Rehearse the defense sheet | 2 | High |
| 35 | Robustness: autonomous Docker environment, local test database, backup access point (§9) | missing | Local DB exists (`data/local.sqlite3`), seed script `scripts/seed_demo.py` | No Docker, no backup plan | docker-compose, seeded local DB, phone hotspot plus second laptop (§7) | 4-6 | High |

---

## 2. Track fit (blunt)

MEDFORGE is a **medical education and research-evidence platform**. Structurally it is a **Track 2** web platform with asynchronous paths (assign, submit, review, debrief). Its most differentiating technical content belongs to **Track 3** ethics: transparent analysis, provenance, and gated models.

**Recommendation: a hybrid, primary Track 2 with a Track 3 module.** "A care-team training platform for peripheral centres, with one transparent, consultative decision-support module." Only make the Track 3 claim if §5 option A ships with confidence, explanation and human accept or reject. Otherwise present as Track 2 only and describe the models as gated research.

**What a Track 2 jury will expect:**
- Proven behaviour on a bad network (offline cache, queued actions, recovery).
- A fast critical action.
- Simple navigation.
- A deployable URL.

**What a Track 3 jury will expect:**
- A real model.
- A confidence index.
- An explanation per decision.
- A bias analysis.
- Human-in-the-loop.
- A clear SADM disclaimer.

**Where we are weakest:**
1. **The problem is not care delivery.** The cahier's §1 lists ER saturation, medical deserts, chronic-care (ALD) follow-up and medication errors. Education is one step removed. We must link training to a defined clinical error and a measurable outcome (§3) or risk being judged off-brief.
2. **There is no live URL, and the real data cannot be published.** Endoscapes is CC BY-NC-SA and OpenKBP has no data licence.
3. **No security infrastructure:** no TLS, no encryption at rest, no audit log.
4. **No offline mode**, which is the core of Track 2.
5. **No running assistive model.** The honest one (FiSaV stenosis) has an untested worker and an unknown result. It may well come out weak on 59 patients. If so, we must present it as a transparent negative or weak result, not hide it.
6. **Surface area.** Many features the team must be able to explain under questioning (§6 quality warning).

---

## 3. Clinical problem framing (choose one; option A recommended)

### Option A (recommended): missed arteriovenous fistula stenosis in hemodialysis patients (an ALD)

- **Problem:** stenosis of the vascular access leads to thrombosis and loss of the access, then emergency catheters and hospital admissions. In peripheral dialysis centres the first line of surveillance is the nurse's physical exam (thrill and bruit). It is subjective and ultrasound is not always on site. This fits §1 (ALD follow-up, medical deserts) and Track 2 (rural, degraded networks).
- **Clinical user:** dialysis nurses and nephrology residents. Supervisors are educators.
- **Value chain:**
  1. **Collect:** force sensors plus ECG, as in FiSaV.
  2. **Analyse:** transparent signal features and a consultative risk index.
  3. **Restitute:** the nurse sees the beat-synchronous view, the risk index with confidence and explanation, and accepts or rejects "refer for ultrasound".
  4. **Field impact:** structured, earlier referral, and better-trained examiners.
- **Measurable field impact (proposed, needs a pilot):**
  - Learner agreement with the ultrasound reference on the training set, before and after the lessons.
  - Time from abnormal exam to ultrasound referral.
  - Share of referrals with structured evidence attached.
- **Must NOT claim:**
  - Diagnosis or detection of stenosis.
  - Clinical accuracy beyond the 59-patient research cohort.
  - Fewer thromboses or access losses.
  - Replacing ultrasound or the nephrologist.
  - That the FiSaV sensors are a product.

### Option B: bile duct injury during laparoscopic cholecystectomy, via Critical View of Safety training

- **Problem:** bile duct injury is a rare but severe complication. The literature commonly cites incidence in the order of a few per thousand cholecystectomies (*assumption: verify the figure and source before quoting*). CVS is the recommended safety step, and adherence and assessment vary between surgeons.
- **Clinical user:** surgical residents and their supervisors.
- **Value chain:**
  1. **Collect:** expert-annotated laparoscopic frames.
  2. **Analyse:** learner judgement against the annotator majority, with disagreement made visible.
  3. **Restitute:** educator review and cohort calibration.
  4. **Field impact:** better calibrated CVS assessment among trainees.
- **Measurable impact:** learners' agreement with the expert majority on held-out frames, before and after training, and calibration on frames where experts disagree.
- **Must NOT claim:** reduced injury rates, intraoperative safety assessment, competence certification, or anything about real-time surgical guidance.
- **Weakness for this jury:** it is pure education with no field data flow, and Endoscapes is non-commercial.

### Option C (not recommended as the lead): radiotherapy dose-volume histogram (DVH) literacy

OpenKBP data is for personal hackathon use only, publication is blocked, and the clinical value chain is distant. Keep it as a third module, not the story.

---

## 4. Business model (every figure is an assumption to verify)

- **Paying entity (primary):**
  - Private and public dialysis centres and their networks, which pay for staff training and access-surveillance tooling.
  - Faculties of medicine and nursing schools, which pay for simulation and education licences.
  - *Assumption:* there is a significant private dialysis sector in Tunisia. Verify.
- **Paying entity (secondary):** the Ministry of Health or regional health directorates, for continuing education programmes in peripheral centres.
- **Not the payer:** patients.
- **Pricing hypotheses (assumptions):**
  - Institutional annual licence per site, with tiers by number of learner seats.
  - Starter tier for a single dialysis centre or teaching department.
  - Exact amounts to be set after 3 to 5 customer interviews. Do not quote numbers to the jury as validated.
- **Operating cost estimate (assumptions):**
  - A small virtual server (2 vCPU, 4 GB RAM, 80 GB disk) is enough for one institution, at roughly 20 to 40 EUR per month at mainstream providers.
  - Backups and a domain add a few EUR per month.
  - The real cost driver is curated, licensed content and expert review time, not servers.
- **Access barriers:**
  1. **Data licensing.** Endoscapes is CC BY-NC-SA (non-commercial only) and OpenKBP has no data licence. A commercial offering needs institution-owned or commercially licensed content. FiSaV is CC BY 4.0, so commercial use is allowed with attribution.
  2. Expert review capacity for lessons.
  3. Institutional IT approval (security, hosting location, INPDP).
  4. Connectivity in peripheral centres, which is why offline mode matters.
  5. Any clinical use of the risk index would make it software as a medical device. That's out of scope; keep it educational.

---

## 5. AI gap plan (ranked; no new diagnostic model beyond what is justified)

### A. Transparent FiSaV stenosis risk index (recommended; partially built)

- **What it is:**
  - L2 logistic regression on 9 unit-free PZT1 features: relative band powers, spectral centroid and edge, a high/low frequency power ratio, and the systolic/diastolic bruit energy ratio per beat.
  - Data: 59 patients, ultrasound reference label from the dataset patient sheet, nested and repeated cross-validation (`workers/fisav-stenosis/evaluate.py`, not yet run).
- **Justification:**
  - **Data:** a real per-patient label exists.
  - **Validation:** nested cross-validation, bootstrap confidence intervals, a permutation test, and two baselines.
  - **Risk:** controlled, because outputs are labelled educational and consultative.
- **Claims:** "On this research cohort, out-of-fold, the model ranks stenosis cases above non-stenosis cases with AUROC X (95% CI a to b). Here is why it scored this recording."
- **Must not claim:** diagnosis, clinical validity, generalisation to other sensors or centres, or anything for patients outside the cohort.
- **Confidence shown as:**
  - The out-of-fold probability, from a model that never saw this patient.
  - Its spread across repeats.
  - The cohort-level AUROC with its confidence interval.
- **Explanation shown as:**
  - Per-feature contribution (coefficient times the standardised value) as a signed bar chart, in plain words such as "more high-frequency energy in systole than diastole pushed the score up".
  - The beat-synchronous energy plot this feature comes from.
- **Human in the loop:** "Agree, refer for ultrasound", "Disagree" or "Not sure", each with an optional reason. Recorded in the audit log, at most 3 steps.
- **Limits and bias stated:**
  - n=59, single centre, class imbalance of 40 to 19, no external validation.
  - Sensor placement varies, but PZT1 is always over the anastomosis.
  - Amplitudes are uncalibrated.
  - Occlusion-test windows are excluded.
  - Reference labels taken from the patient sheet.
  - **If the confidence interval includes 0.5, say so plainly and present it as a demonstration of honest evaluation, not as a working detector.**
- **Effort:** run the evaluation (about 10 to 20 minutes of compute), then build the explanation panel, accept or reject flow, registry entry and tests in about 8 to 10 hours.

### B. Rule-based signal-quality and beat-detection confidence (cheap, low risk)

- **Claims:** "This window is usable for teaching or analysis because these checks passed." Checks: finite samples, timestamp deviations, beat count consistency, RR plausibility.
- **Must not claim:** clinical signal adequacy.
- **Confidence and explanation:** a score from 0 to 1 built from named checks, each shown as pass or fail with the measured value.
- **Human in the loop:** "use this window" or "pick another".
- **Effort:** 3 to 4 hours, largely reusing `fisav.features` integrity counts.

### C. CVS self-check calibration (built; not AI)

The learner's judgement against the expert majority, with disagreement shown. Present it as human expertise feedback, not as a model.

### D. Verified-checkpoint model comparison (CVS-AdaptNet)

Do not attempt it. There is no checkpoint with a verified hash, no confirmed terms, and no compatible GPU stack verified. Keep it as a gated registry entry, and present the gating itself as governance.

### Not recommended

- Any new deep model.
- Anything from XpeRay (hallucinated reports, no licence, an exposed token in its history).
- Anything from PCD-BrainTumorSegmentation (no weights, no licence, BraTS redistribution risk).

---

## 6. Security and privacy

- **TLS 1.3:**
  - Add a reverse proxy container (Caddy is simplest) in front of `web` and `api`, restricted to TLS 1.3.
  - Use a locally trusted certificate (mkcert) for the laptop demo, or a self-signed certificate with a clear explanation.
  - On a hosted instance, use a real certificate from the platform.
  - Evidence for the jury: `curl -v --tlsv1.3` output and a browser certificate view.
- **AES-256 at rest:**
  - App database via SQLCipher (AES-256) in the Linux API container (`sqlcipher3` wheel), with the key from a Docker secret.
  - Datasets and the patient sheet on an encrypted volume, or OS full-disk encryption (BitLocker on the demo laptop). State honestly which one is used.
  - Risk: SQLCipher on bare Windows is awkward, so keep it inside Docker.
- **Pseudonymisation:**
  - Datasets are already pseudonymous (source IDs only).
  - Accounts: add a pseudonymous learner ID in exports and an optional pseudonym-only educator view.
  - Never ask learners for health data.
- **Non-repudiation:**
  - Add an append-only `audit_log` (actor, role, action, target, source hash where relevant, time, previous-row hash) with database triggers that block UPDATE and DELETE.
  - Write it on: login and logout, publish, assign, submit, grade and release, report save, annotation, accept or reject of model output, expert review, and dataset download script runs.
  - Show educators the entries for their own content.
- **GDPR and INPDP checklist for data we actually hold:**

| Data | Purpose | Legal basis (assumption) | Retention (proposed) | Rights | Status |
|---|---|---|---|---|---|
| Accounts (username, display name, PBKDF2 hash) | Access control | Education contract / legitimate interest | Course duration + 1 year | Access, rectification, erasure | Erasure endpoint missing |
| Sessions (hashed tokens) | Access | Same | 8 h expiry | n/a | Met |
| Submissions, observations, viewer evidence, self-checks | Learning and assessment | Education contract | Course + 1 year | Access (export exists), erasure | Erasure missing |
| Grades, feedback, review notes | Assessment | Education contract | Per institution policy | Access | Met (debrief and export) |
| Preferences (XP, achievements) | Optional gamification | Consent (opt-in) | Until withdrawn | Withdraw | Met |
| Reports, comparisons, annotations | Research and teaching | Legitimate interest | Project duration | Access | Partial |
| FiSaV recordings and patient sheet (pseudonymous, CC BY) | Research and teaching | Public licensed research data | Project duration | n/a (no identities) | Stored locally, unencrypted (gap) |

Still to do:
- An INPDP declaration or authorisation analysis for any real deployment (*verify the obligations under Tunisian law no. 2004-63*).
- A DPIA for any clinical pilot.
- Data processing agreements if hosted by a third party.

---

## 7. Resilience

- **Docker:** `docker-compose.yml` with:
  - `proxy` (Caddy, TLS 1.3)
  - `web` (static Vite build)
  - `api` (FastAPI)
  - `worker` (FiSaV evaluation, run on demand)
  - a named encrypted `db` volume
  - read-only bind mounts for datasets
  - plus a seeded local test database (`scripts/seed_demo.py`).
- **Backup access point:**
  - Demo on a laptop running the stack entirely offline.
  - A second laptop with the same images and data.
  - A phone hotspot only for the hosted synthetic URL.
  - Never depend on venue Wi-Fi for the live demo.
- **Degraded mode (PWA):**
  - Service worker (vite-plugin-pwa) caching the app shell and fonts.
  - Cache the assigned lesson manifest and the assigned case's viewer data when the mission opens.
  - Autosave draft answers to IndexedDB.
  - Queue the submit with its existing Idempotency-Key and replay on reconnect. The API already treats replays as one submission.
  - An offline banner with the queue state.
- **Behaviour today when the network drops mid-mission:**
  - Unsaved answers live only in React state and are lost on reload.
  - Save and submit show an error. Retrying submit is safe because it is idempotent.
  - Viewers fail after a 3.5 s timeout.
- **Behaviour after the fix:** the learner keeps working, sees "saved on this device, will send when online", and nothing is lost.

---

## 8. Interoperability

- **Worth doing (minimal, honest):**
  - A FHIR R4 `Bundle` export for one FiSaV analysis, containing:
    - `Patient`: pseudonymous `pat021` only, no demographics.
    - `Observation`: heart rate from detected beats (LOINC 8867-4), the analysed window, the source SHA-256 as an identifier.
    - `RiskAssessment`: the consultative model output, with `prediction.probabilityDecimal`, `method` = model id, version and checkpoint hash, `basis` pointing to the Observation, and `note` = consultative, research cohort only.
    - `Provenance`: who accepted or rejected it.
  - Every resource tagged `meta.tag` = educational and synthetic-or-research, with a security label.
  - Validate against the base FHIR R4 JSON schema.
- **Not worth doing:**
  - HL7 v2 messaging.
  - FHIR for grades and lessons. Learning data belongs to education standards (xAPI or LTI), not clinical records.
  - DICOM-RT export of OpenKBP benchmark arrays (no native orientation, and not a plan).
  - Live SIH connectors.

---

## 9. Ergonomics: step counts today and targets

| Action | Today | Target (3 steps or fewer) | Change |
|---|---|---|---|
| Educator grades a submission | About 6 to 12 interactions: open Submissions, pick assignment, enter points per criterion (2 to 8), feedback, review note, save | 3: open the submission, review prefilled suggestion, confirm | Prefill criterion points from auto-checked items (Phase 5.1) and the last review; make the review note optional with a default; one "Confirm and release" button |
| Student submits a mission | 2 after answering: select evidence point, Submit (submit autosaves) | Met | None |
| Student commits a CVS self-check | 4: three choices, commit | 4 (formative learning task, not an alert) | Leave as is; explain it is a deliberate learning step |
| Researcher saves a report or comparison | 1 click, plus a one-time sign-in | Met | None |
| Clinician accepts or rejects a model suggestion | Not built | 3: view suggestion with explanation, choose Agree, Disagree or Not sure, optional reason, done | Build in §5 A |

---

## 10. Hosting conflict and synthetic data plan

- **Constraint:** L2 asks for a live web URL with realistic synthetic data. We cannot publicly host Endoscapes (non-commercial, no redistribution), OpenKBP (no data licence) or the patient sheet. FiSaV is CC BY, so hosting is legally possible with attribution, but keep the hosted instance synthetic-only to be safe and consistent.
- **Plan:**
  1. **Hosted instance, synthetic only.** Same Docker images, `MEDFORGE_SOURCE_KIND=synthetic`, a permanent "SYNTHETIC DATA" banner, seeded demo accounts with published throwaway passwords, nightly reset.
  2. **Local instance, real data.** A Docker stack on the demo laptop with installed research data, used for the live jury demo offline.
- **Synthetic generator per module** (`scripts/generate_synthetic.py`, every output labelled synthetic):
  - **DoseTwin:** a 128³ phantom with a water-cylinder CT, a spherical PTV and cylindrical organs at risk, and a dose with smooth falloff from the PTV. DVHs computed by the existing code. Labelled "synthetic phantom, not anatomy".
  - **SurgiVision:** procedurally drawn scene frames (coloured shapes standing in for structures and tools) with COCO boxes and masks, plus synthetic three-annotator CVS triplets including disagreement. Labelled "synthetic illustration, not surgery".
  - **FistulaGuard:**
    - A synthetic ECG plus a pulse-synchronous vibration with band-limited noise bursts in systole and diastole, at 10 kHz, in the same CSV format, with an occlusion marker window.
    - Two parameter presets that differ in systolic/diastolic high-frequency balance, labelled "illustrative, encodes our assumption, not a stenosis signature".
    - The synthetic stenosis flag is generated, so the risk index on synthetic data demonstrates the workflow, not accuracy.
  - **Accounts:** synthetic names only.
- **Effort:** 10 to 14 hours for the generator plus hosted deployment.

---

## 11. Deliverable checklists and L3 skeleton

**L1, technical repository:**
- [ ] README rewrite: problem, quick start (Docker), local install (Windows, macOS, Linux), dependencies, data acquisition, offline use, tests, architecture diagram, security notes.
- [ ] Clean logical commits of the uncommitted work (needs user approval). Clear history.
- [ ] Repository shared with the organizers. Collaborator branch strategy agreed.
- [x] Modular code and tests (pytest 109, Vitest 60, Playwright suite, CI workflow).

**L2, prototype:**
- [ ] Docker compose, TLS 1.3, encrypted DB.
- [ ] Synthetic generator and hosted URL.
- [ ] Seeded demo accounts.
- [ ] Offline mode for missions.
- [ ] Assistive module (§5 A) with confidence, explanation and accept or reject.
- [ ] Audit log visible.

**L3, deployment dossier (skeleton, pre-filled):**
1. **Problem and users:** missed AVF stenosis in hemodialysis (ALD); dialysis nurses and nephrology residents (§3 A).
2. **Field feasibility:**
   - Runs on one laptop or a small server, offline-capable after the fix.
   - Data sources: institution-collected recordings and CC BY FiSaV for training.
   - Pilot: one teaching dialysis centre for 8 weeks (*assumption*).
   - Needs: expert reviewers, a sensor kit or existing recordings, IT approval.
3. **Regulatory:**
   - Education software is outside medical-device scope as long as no individual clinical decision is made from it.
   - The risk index stays consultative and educational. Clinical use would make it SaMD and need a conformity pathway (*verify the Tunisian framework and the EU MDR rule 11 analogy*).
   - INPDP declaration and DPIA before any real patient data. GDPR principles applied.
   - Dataset licences respected (FiSaV CC BY; Endoscapes non-commercial; OpenKBP personal use).
4. **Security and governance:** §6 summary, the audit log, model gating with hash and terms, and expert review records.
5. **Business model:** §4.
6. **Roadmap:**
   - **3 months:** pilot curriculum of 3 lessons per module reviewed by domain experts; offline mode hardened; the SQLCipher deployment; the institution's own recordings ingested under consent; an external re-evaluation of the risk index on new recordings (the first honest generalisation test).
   - **6 months:** a multi-site pilot with learner-outcome measurement (pre and post agreement with the reference); FHIR export to a test SIH; the stenosis model kept or dropped based on external results; a decision on a regulatory pathway only if results justify it.

---

## 12. Live demo script (5 to 7 minutes; offline; installed data only)

1. **(1 min) Clinical case.** "In a peripheral dialysis centre, a nurse examines a left radio-cephalic fistula before a session. The thrill feels different. There is no ultrasound on site today." Say plainly that the vignette is illustrative and that the signal we open next is a real, de-identified FiSaV recording, not this patient.
2. **(2 min) Live analysis.**
   - Open FistulaGuard `pat021`: waveform, Welch PSD, spectrogram.
   - In Signal processing tools, show Beats: about 76 bpm, the per-beat table, and the occlusion-test window flagged as a protocol marker, not a label.
   - Apply a 50 Hz notch and show raw versus filtered.
3. **(1.5 min) Consultative risk index** (only if §5 A ships).
   - Probability with its confidence interval, feature contributions, and the "Consultative. The clinician decides" banner.
   - The nurse chooses "Agree, refer for ultrasound" in 3 steps. Show the audit-log entry.
   - Show the cohort evaluation card, including baselines and limits.
4. **(1.5 min) Training loop.**
   - Educator publishes the spectrogram lesson (DRAFT, expert review pending) and assigns it.
   - The student completes it. Pull the network cable: the answers stay queued, then sync.
   - Educator reviews and releases.
5. **(30 s) Governance.** The `https://` lock icon (TLS 1.3), the encrypted DB, and the gated models list with author credits.

**Likely defense questions:**
- **"Is this a diagnostic device?"** No. It's education plus a consultative research index evaluated on 59 patients. Clinical use would need external validation and a regulatory pathway, which is in our 6-month plan only if results justify it.
- **"What happens if the network fails?"** The stack runs fully locally in Docker. Missions are cached, answers save on the device, and submission is idempotent, so replays cannot double-submit.
- **"How confident is the model, and is it biased?"** We show the out-of-fold probability and the cohort AUROC with a bootstrap confidence interval. Known biases are a single centre, a 40 to 19 imbalance and no external validation, and we report exam-only and majority baselines. If the interval includes 0.5, we say it is not yet useful.

---

## 13. Survival plan

**Deadline unknown:** see the questions for the organizers. Hours are estimates.

| Priority | Item | Hours | Depends on |
|---|---|---|---|
| MUST | Docker compose (proxy, web, api, worker, volumes) and seeded local DB | 5 | none |
| MUST | TLS 1.3 reverse proxy with a local certificate | 3 | Docker |
| MUST | Hash-chained audit log on sensitive routes, plus an educator view | 5 | none |
| MUST | Run the FiSaV evaluation; risk index panel with confidence, explanation, consultative banner, accept or reject (§5 A) | 10 | patient sheet (done), worker (written) |
| MUST | Degraded mode: local draft autosave, offline banner, queued idempotent submit | 6 | none |
| MUST | Synthetic generator (3 modules) and hosted synthetic URL | 12 | Docker |
| MUST | README rewrite, clean commits (with approval) | 4 | Docker |
| MUST | L3 dossier and business model slides; clinical framing in the README | 5 | §3 decision |
| MUST | Demo rehearsal and defense sheet | 3 | all of the above |
| SHOULD | Encryption at rest with SQLCipher in the container, plus an encrypted data volume | 5 | Docker |
| SHOULD | Grading in 3 steps (prefill and confirm) | 4 | none |
| SHOULD | PWA service worker (app shell and assigned-case cache) | 5 | degraded mode |
| SHOULD | Minimal FHIR export | 4 | §5 A |
| SHOULD | GDPR: account erasure and export endpoints, pseudonymous exports | 4 | audit log |
| SHOULD | Signal-quality confidence index (§5 B) | 3 | none |
| COULD | Phase 5 auto-checked questions | 7 | none |
| COULD | Educator analytics | 4 | none |
| COULD | Model-vs-expert lesson block | 5 | §5 A |
| COULD | Router split | 8 | collaborator coordination |

- **MUST total:** about 53 hours.
- **MUST plus SHOULD:** about 78 hours.
- **If time is short:** keep the MUST rows that the demo and L2 depend on (Docker, audit log, §5 A, degraded mode, synthetic URL, L3) and drop the rest first.

**Recommended order:**
1. Docker and TLS.
2. Run the evaluation and decide how to present it.
3. §5 A panel with accept or reject.
4. Audit log.
5. Degraded mode.
6. Synthetic generator and hosted URL.
7. SQLCipher.
8. README and commits.
9. L3 and slides.
10. Rehearsal.

**Revised upgrade plan:**

- **Moves up (new):**
  - Docker, TLS, encryption at rest, the audit log.
  - Degraded and offline mode.
  - The synthetic generator and hosted URL.
  - The README.
  - The L3 dossier and business model.
- **Moves up (from Phase 4/5):**
  - The FiSaV risk index with explainability and human accept or reject.
  - The shared prediction display.
  - Expert review records.
- **Moves down:**
  - Phase 5 analytics.
  - Auto-checked questions.
  - The model-vs-expert block.
  - Lesson export and import, and the glossary (already cut).
- **Stays cut:**
  - The router split (unless the collaborator pauses).
  - The frontend split.
  - The NeuroMRI viewer.
  - Any XpeRay or PCD model work.
  - CVS-AdaptNet execution.
- **Done and reused in the demo:** Phase 1 (auth on writes, cross-platform launcher, scripts, contract, seed), Phase 2 (SurgiVision filters, compare, CVS self-check) and Phase 3 (FiSaV tools, starter lessons).

---

## Top 5 risks to the jury result

1. **Judged off-brief.** Education instead of care delivery. Mitigation: the §3 A framing, plus a consultative assistive step in the demo.
2. **No live URL by the deadline.** Mitigation: the synthetic hosted instance first, because the generator is on the critical path.
3. **The assistive model performs poorly on 59 patients.** Mitigation: present an honest evaluation and keep §5 B as the minimum confidence-and-explanation feature.
4. **The defense exposes code the team cannot explain** (§6 quality warning). Mitigation: demo a narrow path and rehearse the component sheet below.
5. **Demo failure on venue network or hardware.** Mitigation: an offline Docker stack on two laptops, with no network dependency.

## Questions for the organizers

1. Does an education platform for care teams qualify under Track 2 or Track 3, or must the solution act directly on patient care? Is a hybrid track allowed?
2. If dataset licences forbid public hosting, is a synthetic-only public URL plus a local real-data live demo acceptable for L2?
3. The "3 steps maximum" rule names alert and prescription validation. Which actions will you check in a product without prescriptions?
4. Is a locally trusted or self-signed TLS 1.3 deployment, plus SQLCipher in Docker, acceptable evidence of transit and rest encryption?
5. May we demo non-commercial research datasets (CC BY-NC-SA) in a hackathon setting?
6. Does the Telemetry and IoT row (MQTT, BLE) apply only to Track 1?
7. What are the expected length and format of L3, the demo duration, and the submission deadline?
8. Is the use of AI coding assistants allowed if the team can explain the code, and should it be disclosed?

## One sentence per component (for the defense)

- **Frontend (React, Vite, TypeScript):** renders the viewers and learning flows and talks only to our local API through a same-origin proxy.
- **API (FastAPI, Pydantic):** validates every request against typed schemas, enforces roles, and is the single source of the OpenAPI contract.
- **Database (SQLite with migrations):** stores accounts, learning records and evidence. Migrations run at start-up, and immutable records are enforced by triggers.
- **Auth:** local accounts with PBKDF2 password hashes and hashed, expiring session tokens. Research writes need an educator or admin.
- **Datasets:** read-only local files verified by SHA-256 manifests, never downloaded from user input.
- **SurgiVision:** expert-annotated frames with filters, side-by-side compare, and a commit-then-reveal CVS self-check against the annotator majority.
- **FistulaGuard:** measured FiSaV signals with Welch PSD, spectrogram, zero-phase filters, ECG beat detection, and the occlusion-test marker shown as a protocol event.
- **DoseTwin:** OpenKBP benchmark slices and DVHs computed from source arrays. It is not a treatment plan and is unpublishable.
- **Workers:** models run in isolated Python environments as separate processes, never inside the API.
- **FiSaV risk index (if shipped):** a linear model on unit-free features, evaluated by nested cross-validation, shown with confidence, an explanation and a clinician accept or reject step.
- **Launcher:** `npm start` runs both services on any OS, and a watchdog stops them if the launcher dies.
- **Contract and tests:** generated TypeScript types from OpenAPI, plus pytest, Vitest and Playwright in CI.
