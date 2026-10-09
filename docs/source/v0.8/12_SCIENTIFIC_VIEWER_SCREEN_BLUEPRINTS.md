# MEDFORGE v0.5 — Scientific Viewer Screen Blueprints

**Status: design draft.** Primary workspaces share shell, evidence origins, run history, linked selection and report export. Their medical content and tools are **not** interchangeable. The data from three specialties are separate research cases, NOT one patient journey.

## A. SurgiVision — Surgical Analysis Studio

**Primary viewer:** 16:9/actual native aspect endoscopic media, no artificial crop. If Endoscapes sampled images only, show **frame navigator**, not invented continuous video playback.

**Desktop anatomy layout**: top case/recording identity + data source label; center large original/annotated frame; right inspector tabs `Anatomy | Instruments | CVS | Model | Reference`; bottom frame/timestamp/event navigator; header actions `Compare | Analyze | Report`.

**Component behavior**:

- Frame timeline: actual frame index, explicit timestamp if available; nearest annotated frames distinguished visually; click to navigate. Action selection persists when changing available overlays but resets only if incompatible.
- Detection overlays: class-named boxes and valid score (if real prediction); hover/click highlighting; opacity slider; toggle instance ID in inspector; reference vs model toggled separately. Invalid/mismatched coordinate data -> error; never put annotations on wrong frame.
- Segmentation overlays: class-specific mask palette, legend, solid-color and outline modes, alpha control; explicit absent label (not guessed background mask).
- CVS panel: 3 canonical criteria shown individually; three-expert annotations and consensus/disagreement when available; model probability separate. No single-frame procedural 'safe to clip' approval.
- Model comparison: A/B same frame and task and evaluation version, side by side; differences listed with linked boxes/frames; if one unavailable show cause. Metrics should be aggregated over valid evaluation sets, not fabricated for a single frame.
- Phase/action timeline: available only for compatible dataset (Cholec80/CholecT50); disabled with stated reason otherwise. Avoid implying phase/class annotations are in Endoscapes where they are not.
- Report: frame IDs, bounding geometry, annotation origin, criteria, model and upstream revisions, limitations.

**SurgiVision tabs**: `Cases`, `Visual Review`, `CVS`, `Tools`, `Temporal`, `Models`, `History`. Defer specialist controls to contextual inspector; no giant everything-at-once dashboard.

**Acceptance check**: toggling model prediction does not toggle reference GT; clicking criterion links only supported frames; zoom/pan preserves boxes/masks alignment; no fabricated video; no video-level data leakage in evaluation.

## B. DoseTwin — Radiotherapy Volume & Dose Studio

**Primary viewer:** synchronized axial/coronal/sagittal CT panels, plus optional interactive 3D mesh view after geometry pass. OpenKBP CSV arrays require preprocessing; they are not necessarily complete patient DICOM studies.

**Desktop initial layout**: left 2x2 imaging tile area (axial, sagittal, coronal, 3D or inspector); right `Structure | Dose | Compare | Quality`; bottom dock `DVH | Metrics | Difference Histogram | Results`. Allow `Focus` single slice for slower laptop. Always identify case, distribution, dimensions, Gy scale and selected ROI.

**Interactions**:

- Click voxel in any view -> update shared `[i,j,k]` selection, other crosshairs, 3D marker if position known, displayed dose at that voxel and highlighted selected ROI if any. If physical transforms missing, use voxel coordinates explicitly and do not label millimeter positions as known.
- ROI select -> highlight mask in slices and optional mesh, focus its DVH curve and official/derived dose metrics, inspect mask voxel count and volume with spacing.
- Dose select -> reference / archived prediction ID (same case only). Opacity and window controls alter display ONLY. Provide physically meaningful legend (dose in Gy); avoid unlabeled rainbow without legend.
- Comparison A/B -> validate case ID, shape, orientation, spacing and units. Difference `A - B`, diverging scale centered at 0, always show signed legend. Numerical discrepancy list jumps to corresponding voxel and ROI. Don't claim prediction uncertainty from model disagreement.
- DVH -> x Gy, y % of structure volume for cumulative DVH; selectable, labeled distributions; share focus with ROI panel; downloadable table; known dose interpolation/quantile policy. Benchmark metric definitions should match official OpenKBP evaluator; note D_0.1_cc vs voxel Dmax.
- Geometry validator -> clear read-only report `voxel dims, shape, axis order, reference alignment, missing origin`. If registration insufficient, disable 3D world-coordinate claims and physical overlays rather than guessing.
- Planning Lab -> available only when recognized compatible optimizer inputs and solver; display queue/state; viewer precomputed predicted dose is NOT optimized deliverable treatment plan.

**DoseTwin tabs**: `Case`, `CT & Structures`, `3D`, `Dose Explorer`, `DVH`, `Compare`, `Planning`, `History`.

**Acceptance check**: a clicked voxel indexes the same array across all panels; ROI DVH values cross-check independently; thresholds don't mutate dose arrays; A/B comparison fails safely on incompatible geometry.

## C. FistulaGuard — Vascular Signal Analysis Studio

**Primary viewer:** multi-track physiological waveform with linked time axis and per-channel units. Download/licensing/channel schema for FiSaV is still UNVERIFIED; do not substitute synthetic signals and label them as research recordings.

**Desktop layout**: stacked tracks large center; narrow left channel/sensor list; right `Signal Quality | Spectrum | Features | Model`; bottom playback transport, spectrogram, event markers / ECG aligned view (only if truly available).

**Interactions**:

- Select channel -> highlight track/sensor location; display sample rate, units and provenance, channel validity. If audio playback supported, independent transport and scrub tied to same absolute time. Do not audio-normalize away amplitude without displaying processing provenance.
- Click-drag `[t0,t1]` -> active interval reflected in all tracks, FFT/PSD/spectrogram and features, but keep a clear indicator when features are derived from whole recording instead. Snap to sample boundaries and refuse invalid negative/out-of-range intervals.
- Spectrogram settings -> window length, overlap, frequency limit, scaling/unit; actual SciPy calculations server-side or verified client worker. Label STFT magnitude vs PSD and dB reference correctly; no generic uncalibrated dB SPL claims.
- Quality gate -> clipping, silence, missing channel, wrong sample rate, excessive noise; each with reason and measured threshold. Quality warning blocks incompatible classifier, but allows raw inspection.
- Sensor-position map -> only use documented source placements, no inferred positions or fake 3D fistula anatomy. Multisite overlay uses same time reference or explicit misalignment warning.
- Model -> experimental stenosis-associated pattern classifier only on compatible labeled research data, no clinical patient-level diagnosis; show patient-disjoint evaluation with sample counts and confidence intervals.
- Research experiment -> group split by patient/session identity; no split by overlapping windows from same patient.

**FistulaGuard tabs:** `Recordings`, `Multichannel`, `Spectrum`, `Sensors`, `Features`, `Quality`, `Models`, `Validation`, `History`.

**Acceptance check**: waveform timestamps match actual sample indices; linked window and spectrum come from identical interval; audio and scientific time selection remain in sync; label and quality gates prevent diagnosis claims.

## Reusable workspaces vs specialist-only widgets

| Shared component | SurgiVision | DoseTwin | FistulaGuard |
|---|---|---|---|
| Case manifest/attribution | yes | yes | yes |
| Evidence origin badge | yes | yes | yes |
| Viewport focus mode | frame | slice/3D | channel/time |
| Compare layout | same frame/model | matched volumes | compatible intervals/recordings |
| Primary legend | anatomy classes | Gy / dose difference | channels / power units |
| Linked selection | `frameId` + region | `ijk` + ROI | channel + `[t0,t1]` |
| Scientific dock | timeline | DVH/metrics | spectrogram/features |
| Report + history | yes | yes | yes |
| Training/model runs | selected legacy adapters | prediction/optimization | fitted signal ML |

## Failure UX

Every workspace must show an actionable incompatibility state: 'Segmentation is not available on frame 002', 'A and B have different voxel grids', 'This sensor channel has no audio signal', 'Model weights not installed', 'Case restricted by license'. No sample chart or generated overlay as fallback in the live scientific results surface.
