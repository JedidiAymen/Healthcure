# Live demo script: DoseTwin flagship (5 to 7 minutes, offline, local Docker)

Replaces the FistulaGuard-first script in `docs/HACKCURE_COMPLIANCE.md` section 12, now that DoseTwin is the flagship.

## Before the demo (checklist)

1. **Copy the comparison case.** The flagship comparison needs the OpenKBP-Opt `pt_241` reference case and its archived prediction `prediction-set_1.csv` in `data/openkbp-opt/pt_241/`. They are on the teammate's machine. The official OneDrive link now redirects to SharePoint and refuses scripted downloads (HTTP 403 on 2026-10-10), so copy the folder directly. Personal hackathon use only; never publish it.
2. Build and start: `node scripts/docker-build.mjs`, then `docker compose up -d`. The api service maps `openkbp:pt_241` automatically (`MEDFORGE_OPENKBP_FULL_CASES_JSON` in `docker-compose.yml`). This base profile encrypts the database with SQLCipher; the separate HackCure overlay (`npm run hackcure:start:docker`) uses plain SQLite, so only show the encryption check on the base profile.
3. Get the demo passwords once with `docker compose logs api | grep -A4 "New local accounts"`: `demo-educator`, `demo-student` and `demo-reviewer` (Clinical Reviewer). Sign in as `demo-educator` (only educators and admins can import). Open `pt_241` in DoseTwin, then **Comparison**, then import `prediction-set_1.csv` as an archived model prediction (source revision `16fbe0dbc64c94ed4b7e8378a090b47c6596bbd7`, model revision `OpenKBP-Opt archived set_1`). The file SHA-256 must be `d9fc8da169b2a7e12c1dd417f60b8364888ab28e233db19e87ee3ea93c40a583`.
4. Start the simulated sensor: `docker compose --profile device up -d sim-device`.
5. Run `node scripts/check-tls.mjs` and `node scripts/check-db-encryption.mjs` and keep both outputs open in a terminal tab.
6. Open every screen once while online, so the service worker has the app cached.

## Script

1. **(1 min) The problem.** *Illustrative vignette, not a real patient:* "A dosimetrist receives an AI-generated head-and-neck dose candidate overnight. Before anyone relies on it, a reviewer must check it against the reference plan and record a responsible judgement." Then say plainly: the case we open is a real, de-identified OpenKBP benchmark case, not this person.
2. **(2 min) Inspect the evidence.**
   - Open `pt_241`. Show the slice, the dose overlay and the per-structure DVH.
   - **Comparison** tab: the prediction carries the **ARCHIVED PREDICTION, not MEDFORGE inference** badge. Show the same-slice difference map and the per-structure deltas.
   - Difference inspector: pick a voxel and read reference Gy, prediction Gy and the signed difference.
3. **(1.5 min) Human decision in 3 steps.**
   - Click **Sign in to review** and sign in as `demo-reviewer`. Only a Clinical Reviewer or admin can record a review; an educator is refused.
   - Choose **Request revision**, type the rationale, then **Record research review**.
   - Point to the boundary line: "For further expert review, not for patient treatment."
   - Show the history entry, then download the **FHIR R4** bundle (tagged as test data) and the JSON report with every source hash.
   - Click **Verify audit log**: the hash chain verifies.
4. **(1 min) Supporting modules.**
   - FistulaGuard: a real FiSaV recording, the **Quality** tab, then the **simulated device** panel with live frames and integrity counters (labelled SIMULATED, not patient data).
   - Academy: an educator grades a submission in 3 steps (**Mark all criteria met**, write feedback, **Release review**).
5. **(1 min) Resilience and governance.**
   - In the Academy, as `demo-student`, turn the network off: the offline banner appears and a submit is queued on the device. Turn it back on and sign in again if asked: the submit is sent once. Do not claim offline research browsing or offline review writes; those need the local API.
   - Show the TLS and encryption check outputs from the checklist.

## Likely questions

- **"Is this deciding treatment?"** No. It records a research decision on a benchmark comparison, for further expert review. MEDFORGE runs no dose model; the prediction is an archived published one, and the badge says so.
- **"What if the network fails?"** Everything runs locally in Docker. Drafts are saved on the device, and queued submits replay with their original Idempotency-Key, so they cannot double-submit.
- **"How do we know a decision was not altered?"** Review records are immutable (database triggers), and every decision is appended to a hash-chained audit log that `/api/v1/audit/verify` checks.
- **"Is the sensor real?"** No. It is a simulator that publishes framed, CRC-checked telemetry over MQTT, to show the integration path. It is labelled as simulated everywhere.
