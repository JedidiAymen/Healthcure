# 27 — Dataset and feasibility update (9 October 2026)

## Evidence standard
- `DIRECT_REPOSITORY_INSPECTION`: source file, commit or license read directly.
- `PAPER_ASSERTION`: author text describes dataset or result, files not verified.
- `ACCESSIBLE_METADATA`: data catalog exists, raw files might be restricted.
- `LOCAL_RUN_VERIFIED`: exact input, command, output, environment and numerical check performed.
- `UNCHECKED`: not yet validated.

## Source revisions audited previously
| Source | Commit |
|---|---|
| Endoscapes | `a8bd4f9b783308f783cca5943c31ff95317b8256` |
| CVS-AdaptNet | `bb21ffbd781b6f943be0daaeeccf1567c21e691d` |
| SurgLatentGraph | `8e521f07ffe431926ae00f273dce649ebf0cdbfa` |
| OpenKBP | `ce625e62f3b04203f22bd9d1634f3e8fb0245e46` |
| OpenKBP-Opt | `16fbe0dbc64c94ed4b7e8378a090b47c6596bbd7` |
| PortPy | `bd4d881917164e5929326598c6b4795ce6510132` |

Commit hashes describe inspected revisions, **not author-provided tested builds**. Re-fetch commits before cloning and verify their ancestry/licenses in the working repo.

### OpenKBP (most ready)
- Public repo: https://github.com/ababier/open-kbp
- Public `provided-data` tree contains 200 training, 40 validation and 100 test case dirs. `pt_201` contains `ct.csv`, `dose.csv`, `possible_dose_mask.csv`, `voxel_dimensions.csv`, structure masks.
- Previously inspected `pt_201` spacing: [5.422,5.422,3.0] mm, shape per canonical loader (128,128,128).
- Previously computed small-mask source summaries: Brainstem 351 voxels, LeftParotid 266, PTV70 10406. They prove sparse indexing and voxel-count audit, **not CT/dose reconstruction or benchmark metric validity**.
- Code: `provided_code/data_loader.py`, `dose_evaluation_class.py`. Compare metrics/voxel ordering against both official modules.
- **Current blocker:** full multi-megabyte files could not be pulled into this tool runtime because outbound access to raw.githubusercontent.com failed. Must retry from Luna's actual dev machine; do not claim a local full patient compute pass.
- Research datum must be labeled *OpenKBP benchmark synthetic reference dose*, not prescribed/delivered patient plan.

### SurgiVision
- Endoscapes: https://github.com/CAMMA-public/Endoscapes. Dataset README links release, CC BY-NC-SA 4.0 terms for noncommercial research. Verify event display and data redistribution conditions separately. The repository itself is dataset documentation, not full source videos.
- SurgLatentGraph `weights/` directory contains conversion/extraction Python scripts, not all the model `.pth` files. README explicitly says checkpoints for all tasks coming soon; do not claim complete weights availability.
- CVS-AdaptNet README links external pretrained `.pth`; actual transfer/hash/execution not confirmed. `test.py` calls `.cuda()` explicitly, so CPU feasibility is unknown and requires a rewrite/test, not just setting a flag.
- Action: retrieve one Endoscapes labeled frame and matching official JSON -> exact overlay screenshot and coordinate test. Only then start weights verification.

### FistulaGuard
- FiSaV 2026 paper: https://www.nature.com/articles/s41597-026-08242-8, 59 patients (40 stenosis, 19 no-stenosis), broadband sensor array and ECG; abstract is accessible but a usable data archive/download has **not been verified**. Paper CC BY 4.0 applies to paper text; do not assume raw recordings share every permission.
- Alternative AVF dataset record: https://zenodo.org/records/14500865 (Bozzetto et al.) announces WAVs but files explicitly restricted; users must request access. `ACCESSIBLE_METADATA`, **not** audio access.
- Alternative 2026 AVF features: https://formative.jmir.org/2026/1/e97202 offers a described supplementary XLSX with 1464 acoustic recordings' feature rows from 30 patients. **Spreadsheet metadata and derived features are not an audio dataset.** Validate appendix download/column semantics and its rights before importing.
- Alternate published Figshare via https://doi.org/10.6084/m9.figshare.26420107 is arteriovenous **graft** (AVG), not AVF. Source study https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0308385 reports 45 AVG participants and audio data. DOI resolution/raw files not locally verified here.
- Conditional demo paths: FiSaV multichannel->multisensor real view; any genuine AVF WAV->single-channel acoustic view; AVG WAV->**AVG** acoustic view; CSV/XLSX features->feature table/charts **without waveforms**; no raw source->transparent blocker.
- Training/evaluation: disjoint by **subject**, not random clips/segments; report number of independent subjects and uncertainty; no clinical diagnosis UI.

### Frontend scientific visualizers
- Cornerstone docs https://www.cornerstonejs.org/docs/getting-started/vue-angular-react-etc/ offer Vite bundler guidance and official example. Example repo currently uses React 18 in package.json, not proof of React 19 compatibility. Run actual React19 + Vite + pinned Cornerstone smoke with real OpenKBP-derived slice asset; record build/preview console and browser screenshots.
- Fallback if Cornerstone integration fails: explicit benchmark-grid 2D canvas viewer with strict voxel-index and mask alignment; keep `cornerstone` as later verified adapter, not mandatory for first demo.
- Keep external package install optional until peer dependency and license tested. Source docs aren't acceptance test results.

## Need-to-prove checklist before final locked claims
- [ ] Real downloaded dataset manifest, transfer/checksum, license and allowed display
- [ ] Real `pt_201` loader output checked against official OpenKBP `EvaluateDose`
- [ ] Surgical COCO annotation overlay source/target image dimensions aligned
- [ ] One genuine vascular acoustic file with verified format and rights, or user-approved feature-only fallback
- [ ] Test fixture vs real source watermarks and artifact origin types
- [ ] React19 + graphics libraries installation, production build and browser tests on actual laptop
- [ ] Algorithm/source licensing and commercial-use restrictions examined by responsible team member
