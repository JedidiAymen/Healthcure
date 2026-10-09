# 23 — Upstream capability family parity register (pre-lock)

Each row represents a research capability, **not** proof that pretrained weights and a functioning application are available. Luna should fill `integration_status`, `tested_commit`, `weight_hash`, `example_case_id`, `evaluation_log`, and `owner` before claiming parity. Keep every row unless source inspection proves it invalid; never quietly delete.

| Module | Capability | Upstream | Integration plan | Target phase |
|---|---|---|---|---|
| SurgiVision | Endoscapes COCO annotations / datasets and official splits | Endoscapes | dataset adapter; train/val/test preserved | P0 |
| SurgiVision | Bounding boxes incl gallbladder, duct, artery, plate, triangle, tools | Endoscapes; SurgLatentGraph | labeled overlay + detection adapter | P0/P2 |
| SurgiVision | Instance/semantic segmentation | Endoscapes; SurgLatentGraph | real masks; model inference after checkpoint gate | P0/P2 |
| SurgiVision | Faster R-CNN, Cascade R-CNN, Deformable DETR | SurgLatentGraph | isolated MMDetection research worker | P3 |
| SurgiVision | Mask R-CNN, Cascade Mask R-CNN, Mask2Former | SurgLatentGraph | isolated segmentation worker | P3 |
| SurgiVision | LG-CVS, DeepCVS, LayoutCVS, ResNet50-DetInit, LG-DG | SurgLatentGraph | CV research adapter with typed classifier outputs | P3 |
| SurgiVision | Temporal models, phase and action-triplet recognition | SurgLatentGraph, Cholec80/CholecT50 | dataset-compatible temporal adapter | P3 |
| SurgiVision | CVS-AdaptNet testing and training | CVS-AdaptNet | dedicated device-tested worker, official weights | P1/P3 |
| SurgiVision | Whole-video inference | SurgLatentGraph `run_inf_on_vid.py` | actual video; timeline/annotation exact alignment | P2 |
| DoseTwin | CT/dose/organ-mask sparse loading and official splits | OpenKBP | native benchmark arrays -> typed image/dose viewer | P0 |
| DoseTwin | Reference dose, ROI dose statistics and DVH metrics | OpenKBP | faithful NumPy implementation validated against source | P0 |
| DoseTwin | Keras/TensorFlow U-Net baseline training and dose inference | OpenKBP | isolated legacy worker | P3 |
| DoseTwin | Archived 21 prediction distributions | OpenKBP-Opt | asset importer + model provenance + comparisons | P1 if available |
| DoseTwin | Knowledge-based planning optimizer and analysis | OpenKBP-Opt | isolated OR-Tools/Gurobi environment | P3 |
| DoseTwin | PortPy CT/beam/structures/influence matrix | PortPy | optional separate planning dataset adapter | P3 |
| DoseTwin | IMRT, VMAT, global optimization experiments and notebooks | PortPy | option-specific advanced planning worker | P3 |
| DoseTwin | 3D research anatomy / linked 2D views / discrepancy | MEDFORGE | UI built by us; not upstream parity | P1 |
| FistulaGuard | FiSaV multichannel sound/vibration/ECG playback/plotting | FiSaV paper/data | blocked until raw data terms+parsing confirmed | P0 if acquired |
| FistulaGuard | Spectrogram / PSD / selected-channel features | MEDFORGE implementation | SciPy verified formulas and unit labels | P1 |
| FistulaGuard | Subject-disjoint stenosis experimental classifier | MEDFORGE implementation | gated by legally acquired labeled data | P2 |
| Shared | Model registry, typed artifacts, provenance, experiment run manager | MEDFORGE | shared core system | P0/P1 |
| Academy | Student tasks, answer-hiding, rubric, replay, XP | MEDFORGE/Trophy UI | source-linked case lesson engine | P1/P2 |
| Educator | Lesson authoring and published immutable versions | MEDFORGE/dnd-kit | no hidden reference leakage | P1/P2 |

This register is preliminary and does not claim to list every function, script, model configuration or hyperparameter in the original research repositories. A complete commit-pinned source-code and config inventory is a required step before claiming **full** upstream feature parity.
