# Demo assets and source permissions

Updated 2026-10-09. This file records the sources present in this local checkout. It is an implementation manifest, not a legal opinion or permission grant for public display or redistribution. Raw datasets and model weights remain outside Git under `data/`.

## DoseTwin — OpenKBP validation case `pt_201`

- **Installed asset:** one complete 128×128×128 processed validation case: CT, benchmark reference dose, possible-dose mask, and ROI masks. The viewer is bound to case `openkbp:pt_201` and labels the reference dose as a benchmark, not a delivered plan.
- **Integrity:** 14 source CSV files; Git blob IDs were checked against the upstream repository and file SHA-256 values are in [`openkbp-pt201-manifest.json`](openkbp-pt201-manifest.json) and `data/openkbp/pt_201/medforge-source-manifest.json`.
- **Pinned source:** `ababier/open-kbp`, commit `ce625e62f3b04203f22bd9d1634f3e8fb0245e46`.
- **Permission status:** the repository's software license is not treated as a dataset license. The current policy is local research/education only; external demo display, redistribution and commercial use need a separate rights review. Student publication is blocked in the application.
- **Demonstrated use:** orthogonal index-space slices, ROI overlay, linked voxel, source-derived cumulative DVH and source provenance. Physical orientation is not available and is not inferred.

## SurgiVision — Endoscapes BBox201 annotated frames

- **Installed asset:** all 1,933 authentic `Endoscapes2023` BBox201 annotated images across train/val/test (1,212 / 409 / 312), original image-level COCO split annotations, and the annotated subset's 2,248 compressed RLE segmentations. The 6.3 GB ZIP, continuous videos and unannotated intermediate frames are not installed.
- **Integrity:** selected image and annotation SHA-256 values are recorded in `data/endoscapes/medforge-source-manifest.json`. The API checks hashes before serving each image and annotation.
- **Source and license:** [CAMMA-public/Endoscapes](https://github.com/CAMMA-public/Endoscapes); CC BY-NC-SA 4.0 for non-commercial scientific research, per the installed manifest. Preserve attribution, license and split identity. Public presentation and redistribution still require scope review.
- **Useful browser frames:** `4_26200` and `13_46850` are separate source images. The viewer draws their official annotations in original pixel coordinates and identifies reference labels separately from model output.
- **Permission status:** suitable for local scientific development under the recorded terms; no blanket external sharing approval is recorded.

## FistulaGuard — FiSaV raw signal cohort

- **Installed asset:** all 59 official CSV recordings (`pat001`–`pat059`), 8,144,854,743 uncompressed bytes total. The full 2.27 GB ZIP and demographics workbook were not retained.
- **Integrity:** per-record size, source member path, SHA-256, archive CRC results and license are recorded in `data/fisav/medforge-source-manifest.json`.
- **Source and license:** [OSF DOI 10.17605/OSF.IO/HYPFR](https://osf.io/hypfr/); CC BY 4.0. Preserve attribution and license terms.
- **Demonstrated use:** selectable measured ECG and four raw PZT channels, bounded waveform, Welch PSD and descriptive window features from the same source interval. Values are uncalibrated; no stenosis result or clinical interpretation is produced.
- **Privacy boundary:** only waveform CSV files are installed; the separate demographics workbook is excluded. Recording IDs remain dataset identifiers and are not presented as patient identities.

## Shared use and prohibited claims

- There are 1,993 registry records: one OpenKBP case, 1,933 Endoscapes annotated frames, and 59 FiSaV recordings. These sources are independent research datasets; they do not describe one patient or linked clinical pathway.
- Do not add raw media, source datasets or checkpoints to Git. Keep source license, original IDs, hashes, units and provenance with derived results.
- No installed model checkpoint is claimed as runnable. No prediction, diagnosis, clinical clearance, treatment plan, patient outcome or professional certification is fabricated.
- External jury or public display remains gated where explicit data-use permission has not been recorded.
