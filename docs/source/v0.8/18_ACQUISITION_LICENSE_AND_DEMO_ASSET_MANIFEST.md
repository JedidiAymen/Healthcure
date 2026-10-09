# 18 — Data acquisition, attribution and local demo asset plan

## Scope
Research/education only. Original medical assets stay out of public Git by default. Do not mirror the unverified FiSaV dataset. No personally identifying case data, untrusted checkpoint unpickling, or clinical treatment claims. Preserve source credit and upstream licenses.

## Source acquisition order (to be executed by Luna on a networked development machine)

1. **OpenKBP pt_201 first**: Clone the pinned repository with appropriate storage or fetch case files individually. `validation-pats/pt_201/` contains `ct.csv`, `dose.csv`, `voxel_dimensions.csv`, sparse ROI masks, `possible_dose_mask.csv`. Verify SHA256 for each locally acquired file; do not confuse source revision hash with downloaded-data hash.
2. **Surgical case:** obtain a minimal licensed Endoscapes subset from the official source; record ZIP hash, content counts, license and exact allowed research demonstration use. Keep the official video-level splits.
3. **CVS-AdaptNet weights:** use only the author-provided URL from official README. Record transferred file size and SHA256; validate inference in isolated trusted environment and compare reference results.
4. **OpenKBP-Opt archived predictions:** try author's OneDrive archive, but ~10.19 GB download can be a show-stopper. If unavailable, continue DoseTwin with a *single actual OpenKBP benchmark dose*, CT and structures. Do **not** fabricate Model A/Model B dose arrays.
5. **FiSaV raw recordings:** retrieve only when repository/DOI/file list and rights are confirmed; request details from paper correspondents if needed. Validate per-channel sample rates, units, ECG channel, sites, labels and subject grouping. Until then, UI may display an explicit `dataset-unavailable` state; separately labeled synthetic development fixtures are allowed in automated tests only.
6. **Fallback AVG data:** assess Figshare audio records if accessible, label it *graft* study, not *fistula* study, and do not reuse unsupported clinical labels.

## Suggested on-disk structure
```
data/
  source-manifests/{dataset-id}.yaml  # license, DOI, upstream SHA, hash, access state
  raw/                          # ignored by git
    openkbp/validation-pats/pt_201/...
    endoscapes/...
    fisav/...                     # only after access approval
  derived/                       # ignored by git
    openkbp/pt_201/{slices,manifest,metrics}/...
  demo-approved/                  # explicitly cleared for redistributing or presenting
artifacts/runs/                   # ignored by git
```

## Machine-verifiable acquisition commands
```
# In a repo that supports GitHub CLI or git on a networked machine:
git clone https://github.com/ababier/open-kbp.git references/open-kbp
cd references/open-kbp && git checkout ce625e62f3b04203f22bd9d1634f3e8fb0245e46
# Then inspect pt_201 on disk rather than downloading the 10 GB OpenKBP-Opt archive first.
find provided-data/validation-pats/pt_201 -maxdepth 1 -type f -print | sort
sha256sum provided-data/validation-pats/pt_201/*.csv > pt_201.sha256
python ../../scripts/validate_openkbp_case.py provided-data/validation-pats/pt_201
```
If cloning this repository is heavy, use `git sparse-checkout` or Github raw file retrieval with a pinned commit. Verify that files can actually be retrieved first.

## Demo manifest requirements
For each juried demo case write `{module,dataset_id,dataset_release,case_id,source_url,license_text,asset_hashes,original_or_derived,reference_type,ready_state,consent_or_anonymization_note}`. No image, video, waveform, chart or dosage result is shown as medical data without a matching manifest. Only approved demonstration assets are bundled.

## Licensing findings
- Endoscapes / CVS-AdaptNet: CC BY-NC-SA 4.0; noncommercial scientific research terms. Confirm jury/public display and derivative content usage before distribution.
- OpenKBP/OpenKBP-Opt code: MIT license files inspected. Do not extrapolate code licensing to every underlying patient's data or related third-party assets; record applicable dataset terms separately.
- PortPy: Apache-2.0-with-Commons-Clause restriction; commercial integration/service licensing needs separate review.
- Trophy UI: MIT UI-component source, not a mandate to use their hosted service.
- FiSaV: article itself CC BY 4.0, which does **not by itself prove a raw dataset license**; resolve separately.

## Engineering rule
An unavailable scientific data source may be represented by an honest disabled module shell with source description and acquisition status, but cannot count as one of the "three working real-data demos" acceptance tests. Do not switch to synthetic medical cases silently.
