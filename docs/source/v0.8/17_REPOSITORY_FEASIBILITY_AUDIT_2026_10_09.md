# 17 — MEDFORGE source and data feasibility audit

**Date:** 2026-10-09. **Status:** Evidence collected; not architecture lock. This is a desk/source-code feasibility audit plus a reproducible local synthetic test harness, NOT real pipeline integration, weights download, or deployment verification.

## Evidence levels
- **A / inspected:** repository file, exact source configuration or dataset file was read through GitHub; describe only inspected properties.
- **B / documented:** official README or peer-reviewed paper advertises a capability; its actual runtime/download is not validated locally.
- **C / blocked:** no reachable raw-data asset, model checkpoint, compatible runtime, or usable license confirmation established.
- **T / tested on synthetic data:** local test passed with *synthetic fixtures*, not a medical dataset or upstream model.

## Current capability matrix

| Product / asset | Evidence | Verified or documented fact | Unverified risk | Decision |
|---|---|---|---|---|
| Endoscapes | A+B | COCO-labeled frames, separate CVS / bounding-box / segmentation samples; dataset link and CC BY-NC-SA research condition documented | ZIP transfer and full license/jury display not verified | SurgiVision annotations and frame navigation in MVP once approved data obtained; never fake continuous video |
| CVS-AdaptNet | A+B | README offers pretrained CVS checkpoint link; test.py has hard-coded `.cuda()` at multiple points | Checkpoint transfer/hash, pretrained performance, local CUDA/CPU inference untested | Separate worker; no 'live model' badge until successful test |
| SurgLatentGraph | A+B | Source contains detector/segmentation/CVS/phase/triplet model code and video inference script | README says checkpoints 'coming soon'; weights folder contains *conversion scripts*, not full model checkpoints | Preserve training/evaluation interface in parity registry; implement chosen architectures only when weights available |
| OpenKBP core | **A** | GitHub contains 200 train, 40 validation, 100 test case directories; individual pt_201 CT/dose/ROI/spacing sparse CSV assets | Full patient bulk download; viewer geometry and real-array numerical integration not tested | Strongest immediate first research-space viewer |
| OpenKBP pt_201 | **A** | voxel_dimensions = [5.422, 5.422, 3.0] mm; Brainstem 351 voxels (30.96 mL); LeftParotid 266 (23.46 mL); PTV70 10,406 (~917.75 mL) using sparse indices | These values verify mask index counts and spacing only, **not** DVHs or clinical contours correctness | Tiny reproducible sampling fixture documented; use full actual dose file for dose tests |
| OpenKBP-Opt | B | 100 test cases, 21 archived prediction distributions; 10.19 GB separate reference/prediction archive | OneDrive link download and validation of matching arrays unverified | Phase 2 archived comparison unless subset obtained and verified |
| OpenKBP-Opt optimization | A | `optimizer.py` selects `GUROBI_LP` via OR-Tools | Gurobi solver/license and long runtime untested | Advanced solver worker only, not demo prerequisite |
| PortPy | A+B | Module imports include CT, Structures, Beams, Optimization, Evaluation, Visualization; examples include IMRT/VMAT workflows | Runtime/models/datasets not installed; code has Commons Clause commercial restrictions | Long-term optional radiation planning worker; keep separate from OpenKBP target data |
| FiSaV | B+C | Article published 2026-09-25; 59 AVF patients, 40 stenosis / 19 without, multichannel force sensor + ECG, >=3 minutes | Full early online article page omits detailed data links; raw recordings and their dataset-specific permissions could not be verified | FistulaGuard remains independent in scope; genuine FiSaV playback/classifier blocked until confirmed |
| AVG Figshare backup | B+C | 2024 paper links openly available audio data at doi:10.6084/m9.figshare.26420107 | Actual files not downloaded; data are arteriovenous **grafts** (AVG), not FiSaV AVF | Optional accurately labeled backup only; NEVER reuse AVG results as AVF labels |
| Trophy UI | A+B | Canonical repository `trophyso/ui`, MIT, React 18+ and Tailwind v4+ documented | React 19/Vite app install not tested | Use selected local source components only after smoke test |
| Cornerstone3D | B | Official docs show Vite+React examples and custom image loader | OpenKBP CSV -> volume integration and geometry correctness untested | Start with faithful slice renderer; add Cornerstone only after geometry spike |
| WaveSurfer | B | Regions, audio playback and spectrogram plugin documented | Raw force sensor channels may not represent directly audible sound; frontend integration untested | Use only for *genuine acoustic* channels; never convert unsuited vibration data without documented transform |
| dnd-kit | B | Modern `@dnd-kit/react` supports sortable with keyboard sensors | React 19/Vite integration not tested | Educator reorder; retain non-DnD Move Up/Down buttons |

### Critical scientific correction: OpenKBP geometry/reference dose
The 128×128×128 benchmark arrays are preprocessed. Each case includes spacing, but they are **not guaranteed to encode patient-native DICOM origin/orientation**. Visualize as *benchmark voxel-grid space* with mm spacing. Do not create invented patient physical orientation or claim mesh corresponds to native treatment setup. The original OpenKBP publication describes the released reference dose as **synthetic**. Label it 'OpenKBP benchmark reference dose' rather than delivered clinical treatment dose. A reference-dose volume is NOT a deliverable optimized plan.

### Executability limits
This sandbox could inspect public GitHub through a connector, but `curl` to raw.githubusercontent.com could not resolve, so model weight downloads, external ZIP retrieval, pip/npm installation and browser app smoke tests **were not performed**. No GPU environment was tested. Do not assign PASS to these gates.

## Pinned inspected repository HEADs (2026-10-09; review again before implementation)

| Repository | Branch | Inspected SHA |
|---|---|---|
| CAMMA-public/Endoscapes | main | `a8bd4f9b783308f783cca5943c31ff95317b8256` |
| CAMMA-public/CVS-AdaptNet | main | `bb21ffbd781b6f943be0daaeeccf1567c21e691d` |
| CAMMA-public/SurgLatentGraph | main | `8e521f07ffe431926ae00f273dce649ebf0cdbfa` |
| ababier/open-kbp | master | `ce625e62f3b04203f22bd9d1634f3e8fb0245e46` |
| ababier/open-kbp-opt | master | `16fbe0dbc64c94ed4b7e8378a090b47c6596bbd7` |
| PortPy-Project/PortPy | master | `bd4d881917164e5929326598c6b4795ce6510132` |
| trophyso/ui | main | `81ee8a192b781aa1dff39c972fef692b31e3359e` |

These are discovery snapshots, not guaranteed compatible application dependencies. Pin only the revisions actually tested by Luna in the resulting lock file.

## Sources and evidence URLs
- https://github.com/CAMMA-public/Endoscapes
- https://github.com/CAMMA-public/CVS-AdaptNet/blob/main/test.py
- https://github.com/CAMMA-public/SurgLatentGraph
- https://github.com/ababier/open-kbp/tree/master/provided-data/validation-pats/pt_201
- https://github.com/ababier/open-kbp/blob/master/provided_code/data_loader.py
- https://github.com/ababier/open-kbp-opt
- https://github.com/ababier/open-kbp-opt/blob/master/provided_code/optimizer.py
- https://github.com/PortPy-Project/PortPy/blob/master/LICENSE.txt
- https://github.com/trophyso/ui
- https://www.nature.com/articles/s41597-026-08242-8
- https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0308385
- https://doi.org/10.6084/m9.figshare.26420107
- https://aapm.onlinelibrary.wiley.com/doi/10.1002/mp.14845
