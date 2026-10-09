# 24 — Concrete MVP cutline and jury demo flows (v0.7)

**State:** proposal; no user approval implied. **Priority: scientific evidence, then interaction, then storytelling.**

## Two different definitions of 'complete'
- **Full-product completeness** means every source research capability family remains tracked, has an integration owner, input/output contract, dependency list, reproducibility tests and a proposed UI entry point. It **does not** claim every legacy model is runnable.
- **Hackathon-demo completeness** means an actual data-backed, reproducible vertical slice with working user interactions, labels, evidence provenance and tests on the demo machine. Anything else is `SOURCE_ONLY`, `BLOCKED`, or `FUTURE`.

## P0 release lines (must work before polish)
| Track | Valid minimum functionality | Do NOT claim | Evidence needed |
|---|---|---|---|
| Shared platform | Home, working module navigation, role-aware sidebar, case registry, error states, real artifact manifest | Cloud deployment or clinical readiness | Browser test, no broken buttons |
| DoseTwin | One official OpenKBP research case; 128³ CSV reconstruction; slice navigation; aligned ROI overlay; actual benchmark dose from source; dose statistics/DVH derived from voxels | DICOM orientation, delivered clinical dose, radiation treatment recommendation, optimizer if not run | Loader cross-check and ROI/volume/DVH numerical tests |
| SurgiVision | Real Endoscapes frame; COCO BBox/mask/labels when present; image/frame ID/timestamps; annotation/source layers | Live video from sampled frames, trained model output unless checkpoint executed, clinical CVS certification | Dataset sample, annotation geometry tests |
| FistulaGuard | A real, rights-cleared recording **if acquired** with actual sample rate/channel metadata; waveform + FFT/PSD; segment selection & quality checks | FiSaV accessibility without file verification, AVF diagnosis, AVF from AVG source | File sample and metadata + signal-processing tests |
| Educator/Academy | One versioned lesson on one real source case; controlled scientific viewer; server-side answer; submission and feedback; optional achievement | LMS, medical certification or AI tutoring from fabricated evidence | Pre-reveal leakage security test + end-to-end attempt |
| Report | Export exact source case, artifact hashes, method, labels, metric units and limitations | Patient treatment plan or diagnostic summary | Snapshot test and downloadable file |

### FistulaGuard absent raw evidence fallback hierarchy
1. **FiSaV real multichannel session** if actual raw download, file hash, sample rate/channel semantics and rights are verified.
2. **Legally usable, genuine AVF .wav** from another dataset with accurate source/label mapping; cannot claim FiSaV multi-site vibration/ECG.
3. **AVG sound recording** from 2024 Figshare, *explicitly labeled arteriovenous graft*, and no AVF-specific classifier claims. Check existence, license and actual audio content first.
4. **2026 AVF feature spreadsheet** provides authentic statistical features, but no raw waveform/spectrogram playback; show a **feature explorer** only.
5. If none legally usable, show blocked data import/viewer functionality with actual dependency message. Keep full module code contracts and tests for offline synthetics, clearly labeled as test fixtures, excluded from the live biomedical evidence claim.

## Jury walkthrough A — DoseTwin (must-have)
- Start offline. Open `/studio/dosetwin`, choose source OpenKBP case `pt_201`.
- Show metadata (dataset name, benchmark reference origin, voxel spacing, available organs).
- Rotate/scroll three benchmark-space views. Select `Brainstem`; ROI outline lines up with underlying voxel mask.
- Show correct reference-dose Gy value, DVH with percentage volume, Dmean and additional metrics, each labeled.
- Switch between masked/unmasked and CT/dose overlays; show that display opacity does not alter numerical results.
- Open evidence drawer: exact source filenames, upstream commit, SHA-256 and metric algorithm revision.
- Save an analysis record and produce an evidence report. Test unmodified content on replay.
- If archived OpenKBP-Opt prediction downloaded, additionally compare **same** case prediction vs benchmark reference; otherwise omit comparison, never invent dose arrays.

## Jury walkthrough B — SurgiVision (must-have if real frame acquired)
- Choose Endoscapes `frame_id`, display as a discrete annotated frame with original image dimensions.
- Toggle expert anatomy bounding boxes, instrument labels and available segmentation masks; verify coordinates in original image space.
- Read original CVS criterion label (expert average) and distinguish disagreement/missing labels; timestamp only if genuine provenance exists.
- Compare with actual pretrained output **only if a smoke test ran**. Model catalog shows `REQUIRES_SETUP` otherwise.
- Export frame review with annotations/provenance; never call expert annotation an inference result.

## Jury walkthrough C — FistulaGuard (conditional)
- Choose exactly named source and modality (AVF/AVG), show recording metadata and permitted use.
- Select five-second time interval and channel; waveform, spectrum, PSD and feature inspector update from the same samples.
- Show FFT input length / sample rate / units and quality warnings.
- Keep classifier disabled unless patient-disjoint evaluation and trained artifact validated.

## Jury walkthrough D — Evidence-to-Learning (P1)
- Educator selects authorized case and evidence layer subset, creates typed objective and answer rubric, publishes immutable version.
- Student starts mission, manipulates scientific viewer, submits an observation, receives source-linked explanation and XP from server ledger.
- Confirm hidden correct answer never appeared in the student pre-submit API JSON.

## Priorities
- P0: actual DoseTwin full loop, shared case contract, SurgiVision genuine overlay, working scientific panels and error states.
- P1: one real acoustic flow if rights cleared; educator -> Academy mission; downloaded real model results if executable; report.
- P2: advanced segmentation and temporal models; multi-case benchmarks; GPU training; OpenKBP-Opt optimization; PortPy; cohort analytics, LTI, collaborative review.

No demo may imply three datasets describe one patient or one treatment pathway.
