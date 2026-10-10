# L3 deployment dossier (draft)

This draft is for the HackCure jury and the team. Statements marked *assumption* need validation with clinicians, buyers or legal advisers before they are presented as facts.

## 1. Target workflow and users

- **Problem:** reviewing candidate radiotherapy dose distributions, increasingly AI-generated, is information-intensive. Teams need to see where each number comes from and to record who judged what, and why.
- **Primary user:** a radiation oncology professional reviewing research candidates (medical physicist, radiation oncologist or resident) in a research or teaching context.
- **Secondary users:** educators and trainees (Academy and Educator), and surgical and nephrology educators who use the SurgiVision and FistulaGuard evidence modules.
- **Output:** a frozen, auditable research review with decision, rationale, evidence and hashes. It is for further expert review, not for patient treatment.

## 2. Field feasibility

| Topic | Current state (evidence in repo) | Needed for a pilot |
|---|---|---|
| Runtime | Docker stack (proxy, web, api, mqtt, on-demand worker) on one laptop, offline after the build | A site server or workstation inside the institution network (*assumption*) |
| Data | Public research datasets under their licences (`docs/DEMO_DATA_POLICY.md`) | Institution-owned cases, used under its governance |
| Rigor | DoseTwin metrics cross-checked with the official OpenKBP evaluator (`docs/openkbp-pt201-validation.json`) | Re-check on the institution's own planning-system exports |
| Users | Local accounts (educator, student, admin) | Integration with institutional identity, for example SSO (*future*) |
| Interoperability | Minimal FHIR R4 export, validated against the R4 schema | A test endpoint on the hospital information system and agreed profiles |

## 3. Regulatory and privacy scope

- **Intended use:** research review and education. The product makes no individual clinical decision. As long as it is not used to make or support treatment decisions for individual patients, it is positioned outside medical-device scope (*assumption: confirm against Tunisian rules and the EU MDR software classification before any clinical use*).
- **Privacy:**
  - Personal data actually held: account data, learning submissions, grades and review records.
  - Research datasets carry pseudonymous source IDs.
  - Controls: TLS 1.3, SQLCipher at rest, hash-chained audit log, role checks, and data minimisation.
  - INPDP (Tunisia) and GDPR obligations still to settle: legal basis, retention periods, data subject rights (export exists for learners; account erasure is planned), any INPDP declaration, and a DPIA before real patient data. **No legal compliance is claimed.**
- **Dataset licences:** OpenKBP has no dataset licence (personal hackathon use only, lessons unpublishable). Endoscapes is non-commercial (CC BY-NC-SA). FiSaV and Appendix300 are CC BY 4.0. A commercial deployment needs institution-owned or commercially licensed content.

## 4. Security architecture

TLS 1.3 at a single proxy; the API and broker are not published. The database is encrypted at rest (SQLCipher, AES-256, key from a Docker secret). The audit log is append-only and hash-chained, with a verifier. Research writes are restricted to reviewer roles, and students are scoped to their assigned cases. Inference runs in isolated workers with no network. Details and proof scripts: `README.md` "Security and privacy notes", `scripts/check-tls.mjs`, `scripts/check-db-encryption.mjs`.

## 5. Business model (all assumptions)

- **Paying entities:** university hospital teaching departments, private oncology centres, and medical faculties (training and research budgets).
- **Offer:** an institutional annual licence per site with installation and support. Content curation and expert review are sold as services.
- **Costs:** hosting is modest (a small server or an existing workstation). The real cost is curated, licensed content and expert reviewer time.
- **Barriers:** dataset licensing, institutional IT approval, expert availability, and integration effort.

## 6. Roadmap

| Horizon | Milestones |
|---|---|
| 3 months | Expert review of the DoseTwin review workflow and the starter lessons. A pilot at one teaching department on institution-owned exports. Usability measurements (time to open a case, time to record a review, task error rate). Account erasure and retention controls. TLS client certificates for devices. |
| 6 months | Multi-user pilot with measured review consistency. FHIR exchange with a test hospital endpoint. Decision on a verified in-app dose model only if its checkpoint, licence and evaluation pass the gates. FiSaV risk index only if the label definition is confirmed with clinicians and the frozen protocol's evaluation supports it. |
