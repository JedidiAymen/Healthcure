# Claims and limits

What MEDFORGE may and may not say, in the UI, docs, slides and the defense. This is based on the teammate review's section 10 and the product rules. `scripts/check_claims.py` fails CI (through `apps/api/tests/test_claims.py`) when a banned phrase appears in user-facing copy or docs without a negation. Reviewed exceptions live in `scripts/claims_allowlist.txt`, each with its reason.

## Product position

MEDFORGE is research and education software. It is not a medical device. It does not diagnose, prescribe, approve treatment, or replace a clinician's decision. Every review decision recorded in the app is a research assessment for further expert review, not for patient treatment.

## Must not claim

| Do not say | Say instead | Why |
|---|---|---|
| "diagnoses", "detects stenosis", "stenosis detected" | "consultative research index" (only if a pre-registered evaluation supports it), or "descriptive signal features" | No validated detector exists. The FiSaV stenosis label's criterion is not documented. |
| "our model predicted this dose" | "archived OpenKBP-Opt set_1 prediction (not our inference)" | The pt_241 prediction is published archived output |
| "clinically validated", "proven", "approved", "certified", "medical device" | "research prototype; benchmark parity with the official evaluator" | No clinical validation or regulatory clearance exists |
| "full-rate video analysis", "real-time surgical guidance" | "1 fps sampled stills; separate Appendix300 excerpt without aligned labels" | Endoscapes is sampled stills. Appendix300 is a different procedure. |
| "FHIR compatible" or "HL7 compliant" | "minimal FHIR R4 educational export validated against the R4 schema" (once built) | Only a small export is planned |
| "GDPR compliant", "INPDP compliant", "fully secure" | "privacy-by-design controls: TLS 1.3, SQLCipher at rest, audit log; legal compliance not reviewed" | No legal audit exists |
| "an educator approved this AI output, so it is clinically approved" | "recorded as a research review by the reviewer account" | Educator review is not qualified clinical approval |
| any patient-level interpretation of uncalibrated PZT amplitudes | "compare shape and timing within one recording" | Sensor units are uncalibrated |
| any combined patient story across datasets | "three independent evidence domains" | The datasets come from unrelated people |

## Always show

Every number carries its unit, origin, method, case or record ID, version or hash, and limitations. Every model or archived output is badged as one of: SOURCE BENCHMARK, ARCHIVED PREDICTION, RULE-BASED METHOD, or IN-APP MODEL INFERENCE. Each badge comes with a "what this does not mean" note.
