# 40 — Upstream source pins and capability index

The following revisions were inspected via GitHub metadata during the earlier v0.6–v0.7 review, not cloned and executed in this v0.8 package. Verify that the source history is still accessible before integration.

| Upstream source | Inspected revision | Status |
|---|---|---|
| [Endoscapes](https://github.com/CAMMA-public/Endoscapes) | `a8bd4f9b783308f783cca5943c31ff95317b8256` | Dataset/annotations described; restricted noncommercial research use |
| [CVS-AdaptNet](https://github.com/CAMMA-public/CVS-AdaptNet) | `bb21ffbd781b6f943be0daaeeccf1567c21e691d` | Code/training/checkpoint link; actual inference unverified |
| [SurgLatentGraph](https://github.com/CAMMA-public/SurgLatentGraph) | `8e521f07ffe431926ae00f273dce649ebf0cdbfa` | Detectors, segmenters, CVS, temporal families; checkpoint completeness unverified |
| [OpenKBP](https://github.com/ababier/open-kbp) | `ce625e62f3b04203f22bd9d1634f3e8fb0245e46` | Public research case CSVs and baseline code; runtime not established |
| [OpenKBP-Opt](https://github.com/ababier/open-kbp-opt) | `16fbe0dbc64c94ed4b7e8378a090b47c6596bbd7` | Archived predictions/optimization; full archive, solver license and runtime gating |
| [PortPy](https://github.com/PortPy-Project/PortPy) | `bd4d881917164e5929326598c6b4795ce6510132` | Planning, evaluation, datasets, example notebooks; Commons Clause license review |
| [Trophy UI](https://github.com/trophyso/ui) | `81ee8a192b781aa1dff39c972fef692b31e3359e` | Game-oriented React components; adoption still requires frontend test |

## Mandatory feature preservation
- **SurgiVision**: Endoscapes annotated frames, COCO boxes/masks, CVS criteria, SurgLatentGraph detector/segmenter architecture alternatives, single-frame/temporal classification, phase/triplet tasks, training/evaluation, official splits and audit of overlaps.
- **DoseTwin**: original OpenKBP loader/baseline/evaluator, OpenKBP-Opt reference/predicted/optimized distributions and comparative evaluation; PortPy physics data/planning/evaluation and supported solver integrations.
- **FistulaGuard**: raw channel/position/ECG visualization, spectral and interval features, signal-quality checks, patient-disjoint model training/evaluation, provenance and cautious research predictions.
- **Cross-module**: case explorer, specialized scientific views, model registry/readiness, experiments, run artifacts/replay, evidence reports, Student Academy, Educator lesson builder, RBAC/scoping and visual feedback.

Separate **source repo license** from **dataset rights** and **model checkpoint distribution rights**. The MIT license of code does not prove that every included patient dataset can be redistributed or commercially sold. Review each source separately.
