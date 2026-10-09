# 25 — Workspace interaction protocol and scientific chart specification

## Shared viewer architecture
`CaseWorkspace` owns immutable `caseManifest` and a normalized URL for case selection. `SelectionController` owns *ephemeral* selection state; worker artifacts contain immutable provenance. The three viewers use their own selection type. No cross-module merging of incompatible coordinate systems.

### Selection types
```ts
type SurgicalSelection = { module:'surgivision'; caseId:string; frameId:string; bboxId?:string; maskId?:string; source:'expert'|'model'; };
type DoseSelection = { module:'dosetwin'; caseId:string; voxelIndex:[number,number,number]; organId?:string; doseArtifactId:string; coordinateFrame:'openkbp-grid'; };
type VascularSelection = { module:'fistulaguard'; caseId:string; channelId:string; startSample:number; endSample:number; sampleRateHz:number; };
type ScientificSelection = SurgicalSelection|DoseSelection|VascularSelection;
```

### Screen: research Home `/studio`
- Module cards, last opened case, source readiness indicator, jobs that actually exist.
- Forbidden: dummy KPIs, invented research totals or fake patient records.
- Action: open specialty via cards, open case explorer via source readiness panel.

### Screen: case library `/studio/cases`
- Search by dataset version, module, modality, annotation availability; present genuine case ID and origin.
- Cards reveal source publication link, license notice, available assets, file hash integrity and analysis availability.
- Error state distinguishes not-downloaded from missing permission or corrupt file.

### SurgiVision `/studio/surgivision/cases/:id`
- Primary canvas uses original image dimensions; resize with scaling, no stretched coordinate overlays.
- Timeline is discrete indexed frames with sampling provenance. Only real video asset enables continuous playback.
- Right panel tabs: Anatomy, Instruments, CVS Evidence, Model Results, Provenance.
- Compare split view: original vs reference; optionally reference vs model only on compatible actual outputs.
- Annotation masks and confidence must have source-specific legends; missing labels marked unavailable.
- Charts: annotated-frame count by class (actual count), per-criterion CVS scores if real, temporal phase timeline if source and algorithm exist.
- Performance: virtualize hundreds of frames; lazy-load masks; thumbnail caching.

### DoseTwin `/studio/dosetwin/cases/:id`
- Primary synchronized axial/sagittal/coronal view into *processed OpenKBP benchmark voxel grid*. Never map to native DICOM physical orientation without source metadata.
- Lock crosshair to integer voxel indices [0..127]. Show spacing 3 floats in mm, if present; keep model source file origin visible.
- Right tabs: Organs, Dose layers, Metrics, Comparison, Metadata. Toggle ROI masks by source.
- DVH: cumulative structure fraction (%) on y-axis, dose in Gy on x-axis; clearly state histogram bin size and interpolation rules; use step style where appropriate.
- Additional metrics: Dmean, Dmax voxels, optionally D95/D0.1cc with documented benchmark compatibility. Don't compare incompatible metric conventions.
- Comparison disabled when case IDs, voxel grid, spacing, dose reference kind or orientation metadata conflict.
- Display controls (opacity, window, thresholds) MUST never modify numerical raw dose arrays.
- For optional 3D mesh: use extracted mask mesh in index/grid space, mapped via spacing. No fabricated skull/head clinical geometry.

### FistulaGuard `/studio/fistulaguard/cases/:id`
- Primary uPlot waveform: time in seconds, amplitude in **source units**, no arbitrary dB unless calibrated.
- Channel selector includes exact sensor modality/site from metadata; never force ECG/audio channels onto same normalized unit scale without labels.
- Selection `startSample/endSample` sends exact interval to a Python or JS DSP adapter: FFT, Welch PSD and spectrogram; show N, sample rate, window, overlap and units.
- WaveSurfer audio playback only for an actual appropriate audio channel. Sensors capturing subaudible mechanical forces aren't automatically human-audible WAV assets.
- UI handles dropped samples, NaNs, clipping, inaccessible labels, absent audio and incomplete channel metadata.
- Classification panel only available after genuine weight and patient-held-out evaluation; absent = review mode.

## Shared states
`idle | loading | ready | missing-asset | permission-denied | incompatible | running | error | stale`. Stale means loaded artifacts reference old dataset/model revision; require explicit refresh or safe read-only replay.

## Chart acceptance
- All plotted metrics derived from case/run artifacts, not arbitrary arrays in components.
- Values match API computations within explicit rounding tolerance.
- Hover must display unit + exact provenance.
- Keyboard navigation, text table equivalent, high contrast and color-independent legend.
- Test selected frame/voxel/samples across panels, across resize, and across saved-layout restore.
