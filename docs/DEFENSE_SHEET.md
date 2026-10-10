# Defense sheet: one sentence per component

- **DoseTwin:** shows OpenKBP benchmark CT, reference dose and structures. Its DVHs and metrics match the official OpenKBP evaluator (`docs/openkbp-pt201-validation.json`). It compares a same-case archived AI prediction against the reference, and that prediction is always badged as not our inference.
- **Research review:** a reviewer records "Accept for further expert assessment", "Request revision" or "Reject research candidate" with a required rationale. The server freezes the evidence with every source hash, records are immutable, and revisions supersede.
- **Difference inspector:** returns the reference Gy, prediction Gy, signed difference and structure membership at one voxel, straight from the source arrays.
- **Provenance badge:** every output is labelled SOURCE BENCHMARK, ARCHIVED PREDICTION, RULE-BASED METHOD or IN-APP MODEL INFERENCE, with what that label does not mean.
- **Audit log:** each sensitive action appends a row whose hash covers the previous row, so any edit or deletion breaks the chain that `/api/v1/audit/verify` checks.
- **SQLCipher:** the app database file is AES-256 encrypted with a key from a Docker secret. Datasets and the key itself are outside its scope.
- **TLS proxy:** Caddy accepts only TLS 1.3 with a local CA. The API is reachable only through it.
- **FHIR export:** a review becomes a minimal R4 Bundle (pseudonymous Patient, Observations, DiagnosticReport, Provenance), tagged as test data and validated against the official schema.
- **SurgiVision:** expert-annotated frames with annotator-disagreement filters, side-by-side compare, and a CVS self-check that reveals the expert values only after the learner commits.
- **FistulaGuard:** measured FiSaV signals with Welch PSD, spectrogram, zero-phase filters and ECG beat detection. The occlusion test is shown as a protocol marker, not a label.
- **Simulated device:** a container publishes generated ECG and pulse frames over MQTT. The API checks each frame's CRC32 and sequence number and counts gaps instead of hiding them.
- **Academy and Educator:** lessons built from real evidence, with cohorts, manual rubric grading and delayed debriefs. Rubrics never reach students.
- **Workers:** models run in separate processes and containers with no network, never inside the API.
- **Claims checker:** CI fails if UI or docs claim diagnosis, validation or compliance without a negation.
- **Contract:** Pydantic schemas generate OpenAPI and the TypeScript types, and CI fails on drift.

## Likely questions

- **"What AI is running?"** None of ours in the flagship. DoseTwin reviews a published archived prediction, and we say so on screen. The only learned model we prepared (the FiSaV index) is deliberately not shown, because its reference label's criterion is undocumented.
- **"How is it explained?"** Through voxel and structure differences, DVHs, source hashes and method versions. We show no confidence score, because no model of ours supports one ("no confidence theater").
- **"What if the network fails?"** The whole stack runs in Docker on the laptop with no network after the build.
- **"How is data protected?"** TLS 1.3, SQLCipher at rest, the hash-chained audit log and role checks. Legal compliance is documented as open, not claimed.
