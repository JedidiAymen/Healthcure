# Demo assets and source permissions

Updated 2026-10-10. This file records the sources present in this local checkout. It is an implementation manifest, not a legal opinion or permission grant for public display or redistribution. Raw datasets and model weights remain outside Git under `data/`.

## DoseTwin — OpenKBP validation case `pt_201`

- **Installed asset:** one complete 128×128×128 processed validation case: CT, benchmark reference dose, possible-dose mask, and ROI masks. The viewer is bound to case `openkbp:pt_201` and labels the reference dose as a benchmark, not a delivered plan.
- **Integrity:** 14 source CSV files; Git blob IDs were checked against the upstream repository and file SHA-256 values are in [`openkbp-pt201-manifest.json`](openkbp-pt201-manifest.json) and `data/openkbp/pt_201/medforge-source-manifest.json`.
- **Pinned source:** `ababier/open-kbp`, commit `ce625e62f3b04203f22bd9d1634f3e8fb0245e46`.
- **Permission status:** the repository's software license is not treated as a dataset license. The current policy is local research/education only; external demo display, redistribution and commercial use need a separate rights review. Student publication is blocked in the application.
- **Demonstrated use:** orthogonal index-space slices, ROI overlay, linked voxel, source-derived cumulative DVH and source provenance. Physical orientation is not available and is not inferred.

## DoseTwin — OpenKBP-Opt `pt_241` reference and archived prediction

- **Installed asset:** separate complete 128³ case with CT, benchmark reference dose, possible-dose mask, seven nonempty source ROI masks and authentic `paper-predictions/set_1/pt_241.csv` output. The default launcher lists `pt_241` as a separately selectable, fully enabled case when both the reference and prediction files are present; `scripts/start_local_openkbp_pt241.sh` still opens it as an isolated profile.
- **Integrity:** source manifest `data/openkbp-opt/pt_241/medforge-source-manifest.json` records the pinned OpenKBP Git blob SHA-1/size, matching OpenKBP-Opt ZIP member CRC32/size, SHA-256 hashes, archive ETag, spacing `[3.906, 3.906, 2.5] mm` and permission caveat. Reference dose SHA-256: `272f347a6981b9ec836638db7f3ea24f4e75fa45ab9990f5268984e1672689f3`; set_1 prediction SHA-256: `d9fc8da169b2a7e12c1dd417f60b8364888ab28e233db19e87ee3ea93c40a583`.
- **Compatibility:** the official OpenKBP-Opt archive includes predictions for `pt_241`–`pt_340`, not `pt_201`. Compare set_1 only with its matching `pt_241` reference. Do not mix or resample this patient with `pt_201`.
- **Checkpoint and rights:** the published archive does not provide a model checkpoint hash or separate clinical-array license. The local UI records the checkpoint hash as unpublished. Keep this user-authorized research copy local; no redistribution or public display rights are claimed.
- **Visual review:** actual app captures with the imported prediction and same-slice comparison are in ignored `.local-review/openkbp-pt241/` at desktop 1440×900, tablet 768×1024 and phone 390×844.

## SurgiVision — Endoscapes sampled sequences and BBox201 annotations

- **Installed asset:** the complete official 2023 ZIP release has 60,339 verified regular files and 99,646 safe relative aliases, including 58,585 sampled 1 fps images and split video annotations, plus all 1,933 BBox201 annotated stills and 2,248 compressed RLE segmentations. The release itself contains still frames, not continuous videos.
- **Integrity:** pinned archive ETag/SHA-256 and per-file SHA-256 records are in `data/endoscapes/medforge-full-release-manifest.json` and `medforge-full-release-files.jsonl`. The API verifies source annotations and checks each requested image against the source hash before serving it. Sampled non-keyframes carry no fabricated BBox labels.
- **Source and license:** [CAMMA-public/Endoscapes](https://github.com/CAMMA-public/Endoscapes); CC BY-NC-SA 4.0 for non-commercial scientific research, per the installed manifest. Preserve attribution, license and split identity. Public presentation and redistribution still require scope review.
- **Viewer:** browse the 1 fps sampled sequence with the shadcn slider and previous/next controls. The displayed source frame index is not called a timestamp; continuous playback is not inferred.
- **Useful browser frames:** `4_26200` and `13_46850` are separate source images. The viewer draws their official annotations in original pixel coordinates and identifies reference labels separately from model output.
- **Permission status:** suitable for local scientific development under the recorded terms; no blanket external sharing approval is recorded.

## SurgiVision — one Appendix300 continuous video excerpt

- **Installed asset:** `Center1_014.mp4`, 26,947,136 bytes, 38.1384 seconds, de-identified laparoscopic appendectomy. The clip was extracted by ETag-pinned HTTP ranges from the official 80.77 GB OPARA archive; the full archive was not downloaded.
- **Integrity:** source member CRC-32 `f170315d` and local SHA-256 `af050e90b66076f7dd83e8278be3cc4bd50ea490a375165e9747946b0e94c2bc` are in `data/appendix300/medforge-source-manifest.json`. Duration is verified with `ffprobe`; the API rechecks size and SHA-256 before listing and streaming the clip.
- **Source and license:** [Appendix300 on OPARA](https://doi.org/10.25532/OPARA-1173), CC BY 4.0; cite Kolbinger et al., *Scientific Data* 13, 886 (2026), [paper](https://doi.org/10.1038/s41597-026-07593-6). The player explicitly labels appendectomy and the separate source; this clip is not cholecystectomy footage and has no instrument masks.

## FistulaGuard — FiSaV raw signal cohort

- **Installed asset:** all 59 official CSV recordings (`pat001`–`pat059`), 8,144,854,743 uncompressed bytes total. The full 2.27 GB ZIP and demographics workbook were not retained.
- **Integrity:** per-record size, source member path, SHA-256, archive CRC results and license are recorded in `data/fisav/medforge-source-manifest.json`.
- **Source and license:** [OSF DOI 10.17605/OSF.IO/HYPFR](https://osf.io/hypfr/); CC BY 4.0. Preserve attribution and license terms.
- **Demonstrated use:** selectable measured ECG and four raw PZT channels, bounded waveform, Welch PSD and descriptive window features from the same source interval. Values are uncalibrated; no stenosis result or clinical interpretation is produced.
- **Privacy boundary:** only waveform CSV files are installed; the separate demographics workbook is excluded. Recording IDs remain dataset identifiers and are not presented as patient identities.

## Shared use and prohibited claims

- The default registry has 1,993 primary records: one OpenKBP case (`pt_201`), 1,933 Endoscapes annotated frames, and 59 FiSaV recordings. When its local source files are installed, the development app can expose `pt_241` as a separately selectable DoseTwin case; the dedicated `start_local_openkbp_pt241.sh` launcher instead uses an isolated database. The HackCure Docker profile maps `pt_201` as viewer-only and `pt_241` as the only comparison-enabled case, with separately mounted read-only roots for Endoscapes, FiSaV, Appendix300, and Cholec80. Its host-bind-mounted rehearsal database is checked without writes by `scripts/hackcure_docker_preflight.sh`. The ordinary Compose profile and development launcher keep their own state. These are independent research datasets; they do not describe one patient or linked clinical pathway.
- Do not add raw media, source datasets or checkpoints to Git. Keep source license, original IDs, hashes, units and provenance with derived results.
- No installed model checkpoint is claimed as runnable. No prediction, diagnosis, clinical clearance, treatment plan, patient outcome or professional certification is fabricated.
- External jury or public display remains gated where explicit data-use permission has not been recorded.
