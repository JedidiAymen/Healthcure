# 34 — Scientific artifact contracts, selection and replay

## Source and origin rules
- Each specialty has **separate** dataset IDs, acquisition lineage, labels and numerical interpretation. SurgiVision gallbladder surgery does not share a patient with head/neck radiotherapy or AV fistula recordings.
- Every scientific output labels one of `expert-reference`, `published-prediction`, `computed-analysis`, `synthetic-test`. Missing information is null/unknown, never guessed.
- Published OpenKBP *benchmark reference dose* is not necessarily a delivered patient plan. Preserve lack of original physical-world orientation; use index coordinates unless a validated physical transformation exists.
- A FistulaGuard feature-only sheet is *not* a sound recording. Don't synthesize a waveform and present it as acquired data.
- Original Endoscapes sampled frames are not automatically continuous video. Frame `timestamp_ms` must come from actual metadata or be marked unknown.

## Core artifact types
`reference_impl/apps/api/app/schemas.py` implements three alternative typed artifact shapes discriminated by `kind`:
1. `volume`: `asset_key`, shape, voxel spacing, coordinate frame, dose units, orientation flag.
2. `image-sequence`: frames / count / source image reference and true-video flag (reference sample is a minimal contract).
3. `signal`: sample rate, duration and per-channel units (reference sample is a minimal contract).

**Final work** must expand these to record array dtype, source shape/flattening order, grid origin/orientation *only when known*, original frame bounds for COCO boxes, independent signal channel calibration, sensor position, data quality and measurement provenance. Discriminator pattern follows documented Pydantic v2/OpenAPI practice.

## Linked selection interface
See `reference_impl/packages/contracts/selection.ts` for typed union. Maintain module-specific single source of truth, with selectors as pure transformations:
- Surgical selection: `{ caseId, frameId, annotationId?, runId? }` → highlight image, frame annotation, CVS evidence.
- Dose selection: `{ caseId, voxel: [i,j,k], structureId?, doseArtifactId, runId? }` → corresponding axial/sagittal/coronal slices, dose readout, segmented ROI and DVH selection.
- Vascular selection: `{ caseId, channelId, startSample, endSampleExclusive, sampleRateHz, runId? }` → waveform, PSD, STFT/spectrogram, quality metrics and features derived from **the same selected interval**.

**Resampling rule:** Never confuse arrays indexed by source samples with timestamps or pixel coordinates. Scientific computations must use the original sampling period, frame timestamp or voxel spacing, never CSS pixels.

## DoseTwin validation requirements
- Sparse indices in `[0, 128³)`, no duplicates, finite dose, mask cardinality and file hash checks.
- Decode OpenKBP's sparse arrays in the source's expected flattening order. Source orientation is an independently verified transform, not inferred from array axes.
- DVH: record dose bin boundaries, cumulative vs differential, interpolation, volume weighting and empty mask behavior.
- `D95`, `D0.1cc`, `V20`, near maximum and benchmark DVH score must reproduce official definitions **before** publication-equivalent claims.
- Dose prediction comparison requires *same case, same grid, same units*, otherwise explicit incompatibility.
- `reference_impl/apps/api/app/openkbp.py` computes *exploratory* summary values. Reference script must not be used to calculate clinical thresholds.

## SurgiVision validation requirements
- COCO annotations have original image width/height; overlay boxes/masks must follow original image coordinates under crop/zoom/pan.
- Frame ID and timestamp are not interchangeable. If sampled frames lack continuous video file, use a frame explorer not a fabricated player.
- CVS is a multi-criterion assessment; preserve criteria and annotator disagreement. Do not issue a real-time surgical clearance claim.
- Separate detector, segmenter, CVS head, phase recognizer and triplet recognizer in model registry.
- Checkpoint not merely linked; verify SHA, dependency runtime, sample inference output and licensing before marking `ready`.

## FistulaGuard validation requirements
- Raw recordings must disclose source type (`AVF`, `AVG`), sample rate, calibration, channel names, patient-group ID, labels and dataset rights.
- Spectrogram windows, overlap, sampling rate and FFT normalization are stored in provenance.
- Classifier training uses patient-disjoint splits; never mix windows from the same subject across train and test.
- A model without real labeled test data stays `unverified` or `missing-dataset`, not `ready`.

## Evidence Replay
Reopen saved input hashes, parameters, annotations and output artifact references without needing the original model runtime. Re-execution is separate, requires compatible pinned checkpoint/dependencies and creates a **new** analysis run, even when algorithmically reproducible.
