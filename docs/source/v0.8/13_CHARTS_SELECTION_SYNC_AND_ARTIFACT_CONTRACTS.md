# MEDFORGE v0.5 — Chart Catalog, Selection Synchronization and Visualization Contracts

**Status:** Proposed implementation-ready UX contract, subject to scientific source verification. Consult `12_SCIENTIFIC_VIEWER_SCREEN_BLUEPRINTS.md` for contextual behavior. Scientific units and source provenance are part of the interface, not optional tooltip metadata.

## Chart mapping — use charts to answer an actual user question

| Surface | Scientific question | Chart/visualization | Source/tech | Selection consequence |
|---|---|---|---|---|
| Studio home | What is currently accessible? | Recent cases + readiness table, not vanity KPIs | shadcn table/cards | Open filtered real case |
| Model Lab | Which model is ready and on what data? | Capability/status matrix, table; optional benchmark chart | shadcn/Recharts | Open model detail, validate compatibility |
| Experiment Center | Which compatible run performed better? | Metric comparison/table + distribution | Recharts if aggregated | Jump to case-level error |
| SurgiVision | What is visible on this exact frame? | Native image/boxes/masks | canvas/SVG overlay | Click structure -> inspector |
| SurgiVision | How do criteria/evidence vary across available frames? | Frame-level criterion state and actual annotation coverage timeline | native timeline, optional Recharts | Click -> exact frame |
| SurgiVision | Which frames disagree? | Annotated review table, visual comparison | table + synchronized viewer | Click row -> frame and mask |
| SurgiVision | How is model performing on valid evaluation split? | Per-class precision/recall, PR curve or confusion matrix | Recharts/Plotly optional | Click class -> errors |
| DoseTwin | Where is the dose geographically located in research anatomy? | CT cross-sections + aligned dose overlay | Cornerstone3D OR verified custom renderer | Click -> voxel, linked views |
| DoseTwin | What volume receives at least dose D? | Cumulative DVH x Gy y % | Recharts/Plotly | Select ROI -> focus curve + mask |
| DoseTwin | How much do dose distributions differ? | Difference map diverging at zero + voxel histogram | image/NumPy + chart | Click hotspot -> voxel |
| DoseTwin | Which organ dose metrics differ? | Per-ROI metric table, change columns | table, optional bar chart | Click -> organ |
| FistulaGuard | What happens at time t? | Linked multichannel waveform | uPlot | Time cursor everywhere |
| FistulaGuard | What frequencies occur in interval? | PSD/FFT and STFT spectrogram | SciPy backend, canvas heatmap/Plotly | interval -> recalculated feature panel |
| FistulaGuard | How does location affect pattern? | Sensor/channel matrix based on documented layout | SVG and linked tracks | sensor -> channel |
| FistulaGuard | Is classifier reproducible? | Confusion matrix + ROC/PR where valid, sample counts | Recharts/Plotly | click misclassification -> real case |
| Academy | How is a learner progressing? | Completion, competency coverage, points | Recharts + Trophy UI | Open relevant reviewed attempt |
| Educator | Which skills need revision? | Assignment completion and rubric item counts | Recharts/table | Open authorized submissions |

No automatic 'confidence donut', disease severity percentage, survival risk, or clinical green/red traffic light. Model probabilities are only displayed with their calibration/context; archived expert references are not probabilistic inference. No cross-specialty performance leaderboard using incomparable metrics.

## Shared selection contract

The frontend should emit only verified, discriminated selections from specialty viewers. Linked panels subscribe within the **same case and run**, not global application-wide.

```ts
export type Selection =
  | { module: 'surgivision'; caseId: string; frameId: string;
      regionId?: string; timestampMs?: number; }
  | { module: 'dosetwin'; caseId: string; ijk: [number, number, number];
      structureId?: string; doseArtifactId: string; }
  | { module: 'fistulaguard'; caseId: string; channelId: string;
      rangeSec: [number, number]; sampleRateHz: number; };

export type ResultOrigin =
  | 'reference_annotation'
  | 'archived_prediction'
  | 'live_model_inference'
  | 'computed_metric'
  | 'teaching_simulation';

export interface VisualizationArtifact {
  id: string;
  caseId: string;
  origin: ResultOrigin;
  sourceId: string;
  provenanceId: string;
  kind: string; // narrowed by module-specific schema
  unit?: string;
  checksumSha256?: string;
}
```

**State update rule**: user action -> validate selection (frame exists/ijk valid/range positive) -> atomically update module-local selected case state -> notify dependent panels -> fetch missing artifact once -> render stable output. Request racing must not permit response from prior case to replace new case contents. Persist a versioned subset of user layout and selected coordinates, never hidden answers or restricted content.

## Chart rendering and data contract details

1. Each scientific dataset carries source ID, processing version, scientific units, sampling/spatial geometry, x/y semantics and reference origin.
2. Every chart has a loading state, empty state, missing-data state, valid-zero representation and calculation-error state.
3. Tooltip/selected row shows exact values with significant digits and units (avoid fake precision).
4. Every distribution has explicit domain min/max or known quantile policy; normalization shown when applied.
5. Accessible chart text companion: table of observations/metrics, keyboard focus, legends with labels and patterns for essential categories.
6. Cache large arrays separate from UI metadata; use decimation/min-max envelope to display high-density series while preserving exact values for selection/computation. Never base scientific metrics on chart-downsampled data.
7. Do not apply a visual threshold to scientific data and persist the modified array as if it were the original.
8. Heavy viewers lazy loaded per specialty. Frame/video buffers, audio players, WebGL and observers freed when leaving the workspace.

## Dose-specific numerical rules

- Never compare different patients, units, structures or spatial transforms in a direct voxelwise difference view.
- Cumulative DVH e.g. `(doseGy, fractionOfRoiPercent)`; computed from full ROI dose distribution, not displayed color map.
- Official OpenKBP-Opt published evaluation uses mean and D_0.1_cc for relevant OARs and D_99/D_95/D_1 for targets; label source-specific numerical metrics accurately. Preserve 3D voxel dimension metadata and reconstruct arrays with checked axis conventions.
- Color legends for dose (Gy) and signed difference (Gy) are distinct. Show source and model IDs for A and B.

## SurgiVision-specific rules

- Distinguish source reference / model detection / user annotation via independent layers, not solely by color.
- Some image-level CVS labels are averages/disagreements of expert annotations; don't force binary on fractional reference without an explicitly documented rubric.
- An Endoscapes image-sequence with sparse sampling is not a continuous operation recording. Only show timestamps verified from data.

## FistulaGuard-specific rules

- Preserve original acquisition units/channel details; audio amplification and high-pass filter settings must be disclosed when active.
- PSD (power/Hz) and STFT magnitude are not interchangeable; an uncalibrated signal is not dB SPL.
- Derived features include exact time/window/procedure IDs; scalar summaries should not silently include a different time interval from the currently selected range.

## Performance / availability tests (goals, not measured)

Target interaction feedback <150ms for cached selections where feasible; avoid blocking main UI on scientific computation. First-load and volume memory budgets require measurement on an actual 1366x768 laptop. Results from unavailable models must show `Requires Setup` rather than demo-only synthetic predictions. Regression tests: wrong-case artifact, zero-voxel mask, empty audio channel, incompatible geometry, NaN dose, corrupted frame mapping, missing rights.
