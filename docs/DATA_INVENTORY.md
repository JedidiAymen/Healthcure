# Data inventory, retention and privacy by design

This covers the personal and research data MEDFORGE actually holds in a local deployment. Legal bases and retention periods are proposals (*assumptions*) to confirm with the institution's data protection officer. No GDPR or INPDP compliance is claimed.

## Inventory

| Data | Where | Purpose | Proposed legal basis (assumption) | Proposed retention | Subject rights in the app |
|---|---|---|---|---|---|
| Account: username, display name, role, PBKDF2 hash and salt | `users`, `local_credentials`, `role_grants` (SQLCipher DB) | Access control | Education or research contract | Course or project duration plus 1 year | Export (`GET /api/v1/account/export`); erasure by pseudonymisation (`POST /api/v1/account/erase`) |
| Sessions (hashed tokens, expiry) | `local_sessions` | Authentication | Same | 8-hour expiry; removed on erasure | Logout revokes |
| Learning attempts, answers, viewer evidence, CVS self-checks | `attempts`, `observations`, `attempt_viewer_evidence`, `cvs_self_checks` | Learning and assessment | Education contract | Course plus 1 year | Export; kept under the pseudonymous ID after erasure |
| Grades, feedback, review notes | `grade_events`, `learning_grade_receipts` | Assessment | Education contract | Institution assessment policy | Learners see them in the debrief |
| Research reviews, reports, comparisons, annotations | `research_reviews`, `reports`, `signal_comparisons`, `signal_annotations` | Research record | Legitimate interest (research) | Project duration | Export through review export |
| Audit log | `audit_log` | Non-repudiation and security | Legal obligation or legitimate interest | Project duration (append-only by design) | Entries you performed are in your export |
| Gamification preferences | `student_learning_preferences`, `student_achievement_preferences` | Optional motivation | Consent (opt-in, off by default) | Until withdrawn | Toggle off |
| Research datasets (OpenKBP, Endoscapes, Appendix300, FiSaV including the patient sheet) | `./data`, mounted read-only | Research and teaching content | Public licensed research data, pseudonymous source IDs | Project duration | Not personal data held by us about identifiable people |

## Erasure behaviour

Erasure removes credentials, sessions and role grants, and replaces the display name with `Erased account L-xxxxxxxx`. Learning records and audit entries remain linked to the same random user ID. That ID no longer identifies a person in the system, which keeps educators' grade history and the audit chain intact. This is pseudonymisation, not deletion of those records. Full deletion would break the append-only audit log.

## Privacy by design (what the code does)

- **Minimisation:**
  - The FiSaV labels file keeps only the fields used. Age and sex stay in the source sheet.
  - The FHIR export carries no demographics.
  - Students never receive rubrics or reference labels before review.
- **Pseudonymous identifiers:** datasets use source IDs (`pat021`, `pt_241`). `learner_code` gives exports a stable code that is not the username.
- **Security controls:** TLS 1.3 in transit; SQLCipher (AES-256) at rest for the app database; passwords as salted PBKDF2; session tokens stored only as hashes; role checks on every write; student access scoped to assigned cases.
- **Accountability:** a hash-chained, append-only audit log with a verifier.
- **Local by default:** services bind to the local machine. There are no third-party calls at runtime and no analytics.

## Still open

- Confirm legal bases and retention periods with a data protection officer.
- An INPDP declaration analysis and a DPIA before any real patient data.
- Automated retention enforcement (scheduled purge after the retention period).
