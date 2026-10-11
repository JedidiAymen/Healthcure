# HackCure event-readiness checklist

Use this checklist on the actual demo machine. It separates what the repository already supports from local setup and organizer decisions that cannot be inferred from code. The supplied gap assessment is an editorial review of an older commit; current product scope and evidence are taken from [`FLAGSHIP_DECISION.md`](FLAGSHIP_DECISION.md), [`HACKCURE_WALKTHROUGH.md`](HACKCURE_WALKTHROUGH.md), the current preflight, and the implementation. The organizers' primary cahier PDF is not in this checkout, so this checklist does not claim organizer acceptance.

## Fixed demo boundary

- [x] The selected product flow is a **DoseTwin research review** of OpenKBP-Opt `pt_241` and its publisher-archived `set_1` prediction. The saved decision is for further research review, never treatment approval.
- [x] The app does not run a MEDFORGE dose-prediction model or provide a calibrated confidence score for this archived output. Explain the reference, archive, method, hashes, units, and limitations.
- [ ] The team has asked the organizers which track and local delivery format they accept. Do not present Track 2 as a clinical care path or Track 3 as working MEDFORGE inference without new evidence and organizer agreement.
- [ ] The event owner has confirmed the installed source files may be shown in the specific venue and local presentation. A checksum, source license, or local-only deployment is not display-rights approval.

## Prepare the selected machine and profile

- [ ] Check out and record the exact release commit. Keep credentials, SQLite files, raw datasets, and image bundles out of Git and public uploads.
- [ ] Run `npm run hackcure:preflight:docker`. The current-source image bundle, loopback Compose ports, read-only source mounts, checksum-verified `pt_241` inputs, and matching profile records must all pass. A current bundle is necessary for the portable offline package; it does not itself prove the second machine can restore it.
- [ ] Start the already-built stack with `npm run hackcure:start:docker`; confirm the browser trusts the local certificate and opens `https://localhost:8443/studio/dosetwin/cases/openkbp%3Apt_241`.
- [ ] In this same HackCure Docker database, have the authorized operator provision a private educator/admin login and a separate reviewer/admin login. Enter passwords only in the interactive prompt and store them outside the repository.
- [ ] As the educator, import `data/openkbp-opt/pt_241/prediction-set_1.csv` for `pt_241`, preserve the documented revisions and approved local-use basis, inspect the matched comparison, then save its comparison report.
- [ ] Rerun the read-only preflight. Confirm the matching import, matching saved report, effective reviewer login role, source manifest and loopback checks pass. Do not count the optional Academy check as required unless Academy is in the live segment.
- [ ] If Academy is in the live segment, prepare its student, published source-bounded lesson and assignment in the same profile, then verify the assignment path. Otherwise leave Academy out of the timed demo.

The Docker profile is separate from `data/local.sqlite3`. A pass in one does not prepare the other. Exact commands and the source/revision fields are in [`HACKCURE_WALKTHROUGH.md`](HACKCURE_WALKTHROUGH.md) and [`LOCAL_ACCESS_AND_PROFILES.md`](LOCAL_ACCESS_AND_PROFILES.md#hackcure-docker-profile).

## Rehearse the live sequence

- [ ] Open the `pt_241` flagship route and verify the displayed case and archived prediction identify the same source pair.
- [ ] Inspect the reference/prediction and difference views, one ROI/DVH, and a selected numerical difference. Explain each number's units, method, source and limits.
- [ ] Sign out; sign in as the reviewer. Record one supported research disposition with a clear rationale, reopen the saved record, and show its JSON/FHIR research export.
- [ ] Confirm an educator/student account cannot perform reviewer-only decisions. Use the existing role-boundary behavior; do not imply that a local reviewer role verifies a medical license or qualification.
- [ ] Have every presenter answer: what output is archived; what MEDFORGE computes; what it does not infer; why the disposition is not treatment approval; which data and credentials stay local.

## Prove the fallback and close release gates

- [ ] Transfer the approved code, current-source image bundle and separately approved data/profile backup through the team's private process. Never put research arrays, SQLite, credentials, certificates or keys in a public repository or presentation upload.
- [ ] Restore on the actual backup machine, disconnect venue internet, start with no pull/build, and complete the same authenticated review. Record the machine, commit, bundle checksum, result and any recovery steps.
- [ ] Confirm the chosen L1 repository/release commit has green hosted CI and reproducible local instructions. A previous green run or a local typecheck alone does not establish release readiness.
- [ ] Review the L3 dossier with qualified stakeholders. Keep privacy/legal applicability, source display rights, track eligibility, buyer/cost assumptions and institutional deployment as open until the responsible parties decide them.

## Readiness rule

The event walkthrough is **not ready** while any required profile, rights, organizer, authenticated review, or fallback item above is unchecked. `npm run hackcure:preflight:docker` is authoritative only for the machine-local source, Compose, bundle, and profile checks it names; it cannot prove a password works, a human rehearsal succeeded, rights are cleared, or organizers accepted the track.

Evidence and detailed implementation boundaries: [`HACKCURE_WALKTHROUGH.md`](HACKCURE_WALKTHROUGH.md), [`HACKCURE_BACKUP_RESTORE.md`](HACKCURE_BACKUP_RESTORE.md), [`L3_DEPLOYMENT_DOSSIER.md`](L3_DEPLOYMENT_DOSSIER.md), and [`HACKCURE_COMPLIANCE.md`](HACKCURE_COMPLIANCE.md).
