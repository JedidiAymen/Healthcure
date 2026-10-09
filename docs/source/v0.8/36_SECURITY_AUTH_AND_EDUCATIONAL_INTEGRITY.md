# 36 — Authorization, safety, learning integrity (future production contract)

## WARNING
`reference_impl` has **NO AUTHENTICATION**. It is a local contract fixture and must never be internet-exposed or included as a supposedly secure production backend. Nothing here constitutes patient-ready medical software.

## Security boundaries Luna must implement before any multiuser deployment
1. External identity provider or secure session implementation; issue short-lived session tokens, rotate/revoke, secure cookies if using browser sessions.
2. Scoped authorization on **every** case, dataset, asset, model run, lesson, assignment, attempt and report. Hiding a button is not permission enforcement.
3. Dataset license and consent restrictions enforced before asset download, inference and educator publication.
4. Storage keys opaque and validated; never allow arbitrary filesystem or remote URL fetch; signed URLs only after authorization; checksum downloaded assets.
5. Job isolation: no arbitrary shell commands/scripts from web inputs; install only audited research code, pin known commits and checkpoint hashes; set resources/timeouts.
6. Avoid logging patient-identifiable content or storing credentials in build artifacts. Use de-identified, permitted research cases.
7. Rate-limit sensitive endpoints and upload actions, enforce content-size and file-format restrictions, apply malware scanning before untrusted uploads where applicable.
8. Refuse claims of live surgical clearance, autonomous clinical decisions or radiotherapy treatment-plan prescriptions.

## Three roles, not three copies of scientific code
- `student`: open assigned **student manifest only**; submit own attempts; access allowed feedback when reveal policy permits.
- `educator`: author and publish versioned lessons, review enrolled attempts, access reference/rubric; case and dataset permissions still apply.
- `researcher`: use authorized scientific workspaces, run licensed algorithms, inspect provenance and publish research reports.
- `admin`: manage access, dataset/license records and compute quotas; cannot override third-party license restrictions.

## Critical learning security checks
- Never include `secret_rubric_json`, reference answers or hidden annotations in student endpoint payloads, preload caches or client-side source code before authorized reveal.
- Grading uses server-authoritative rubric version and attempt state; prevent repeat submissions from granting XP twice.
- Published lesson versions are immutable; changing block order/rubric creates a new version, preserving historical attempt scoring.
- Ensure grading equality/tolerance handles units, scientific significant figures and uncertainty, not just string-match answers.
- Text explanations can be marked `review_required` instead of providing inaccurate automated medical scoring.

## Threat-oriented tests (planned)
- Student cannot read someone else's attempted assignment.
- Student cannot read grading key before authorized reveal, including indirect asset URLs.
- Author cannot publish a lesson using a case they may not redistribute.
- Duplicate submission same idempotency key results in one grade event / one award.
- Submitted/graded attempt cannot be silently edited.
- Public browser requests cannot traverse raw filesystem or execute injected model config.

These tests are **not** included in the current six reference API tests; they are release gates for multiuser implementation.
