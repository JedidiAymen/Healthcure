# FiSaV stenosis risk index: evaluation protocol

**Frozen 2026-10-10T16:41Z, before the evaluation was run on real data.**

Every setting below was fixed before the first run on the 59 real recordings. The protocol must not be changed after seeing results. Any later change gets a new protocol version and is reported alongside the original result, never in place of it.

This is research and education only. The output is a consultative, educational index. It is not a diagnostic test.

## Frozen code and inputs

| Item | SHA-256 |
|---|---|
| `workers/fisav-stenosis/evaluate.py` | `4d6b5bafb9ddad3e641ed52adb6fee2182f2aaf2115d2087b9bed176474cbe3f` |
| `apps/api/app/signal_processing.py` (R-peak detector, marker intervals) | `366093f44a7b23075ab54d50557ad88f2ca785443e613b39a68bde2cab649a4c` |
| `data/fisav/medforge-patient-labels.json` (derived labels) | `f82234ef5d7c7d56ba32be25371e99c6f4f84fe2cc65012f3d2314275194149f` |
| `patient_information.xlsx` (OSF, matches the OSF-published hash) | `a180e6698b68fb01b67fb8ea348e9ba7187195a090bacdfa3f8aa553f713e6b1` |
| 59 recordings | per-file SHA-256 from `data/fisav/medforge-source-manifest.json`, re-checked by the worker before features are computed |

**Runtime:** isolated worker venv (Python 3.13, numpy 2.3.5, scipy 1.16.3, scikit-learn 1.7.2), recorded in the output.

## Unit of analysis and grouping

- **One feature vector per patient.** Each FiSaV patient has exactly one recording, and the patient ID is the grouping key.
- **Grouped folds at both levels.** Outer and inner folds use `StratifiedGroupKFold` with patient groups. The worker asserts that no patient appears in both the training and test sides of an outer fold.

## Reference label

`stenosis` is the patient sheet's "STENOSIS: Presence (Y/N)" field, in the echographic examination section. There are 40 Y and 19 N.

What we know and don't know about this label:

- **The criterion and threshold are not documented** in the dataset README or the sheet. The descriptor paper (doi 10.1038/s41597-026-08242-8) could not be retrieved from this environment: the publisher redirected to a login, and the paper isn't indexed in Europe PMC yet.
- **The sheet also records** the stenosis distance from the anastomotic chamber, a "residual diameter" and a "normal diameter".
- **A 50% rule doesn't fit, as far as we can tell.** Under the obvious reading (reduction = 1 - residual/normal), only 14 of the 38 positive patients with both diameters reach 50% diameter reduction, and some values are negative. So either the label was not assigned by a simple 50% diameter rule, or those columns mean something else. This is aggregate information only.
- **Treat it as a clinician-recorded presence label**, method unknown.
- **Open question for a clinician:** what criterion, including any threshold, defines "stenosis present" in this dataset? (Recorded in `docs/BLOCKERS.md`.)

## Sensor placement check

PZT1 is over the anastomosis in all 59 patients. The sheet's two wordings ("Over the anastomosis" and "Over the anastomosis at the middle third of the forearm") match the fistula type exactly: 38 distal fistulas and 21 middle-arm fistulas, where the anastomosis is mid-forearm. Only PZT1 is used.

## Features (fixed: 9)

All features are computed from PZT1 on the longest clean contiguous segment:
- The segment is taken from the first 150 s read.
- Occlusion-test windows plus a 2 s margin are removed.
- The segment must last at least 20 s and is capped at 60 s.
- Sensor units are uncalibrated, so every feature is unit-free.

| # | Feature | Definition |
|---|---|---|
| 1-5 | `rel_power_{25-100, 100-250, 250-500, 500-1000, 1000-2000}_hz` | Welch PSD (nperseg 8192) band power divided by 5-2000 Hz power. The 5-25 Hz band is left out so the five do not sum to one. |
| 6 | `log10_spectral_centroid_hz` | Power-weighted mean frequency, 5-2000 Hz |
| 7 | `log10_spectral_edge90_hz` | Frequency below which 90% of 5-2000 Hz power lies |
| 8 | `log10_high_low_power_ratio` | (500-2000 Hz power) / (25-250 Hz power) |
| 9 | `log10_systolic_diastolic_energy_ratio` | Median over beats of log10(mean 100-1000 Hz energy 50-300 ms after R / mean energy 450-700 ms after R). Only beats with RR of at least 0.75 s count. At least 5 beats are required. R peaks come from the ECG lead using the documented detector. |

A patient is excluded and reported if they have less than 20 s of clean signal, fewer than 5 usable beats, a missing recording, or a hash mismatch.

## Model and tuning (fixed)

- **Pipeline:** `StandardScaler`, then `LogisticRegression(penalty L2, class_weight balanced, max_iter 2000)`.
- **Regularisation grid:** C in {0.01, 0.1, 1.0, 10.0}, chosen by inner 4-fold grouped stratified CV on ROC AUC, inside each outer training fold only. No tuning ever sees an outer test fold.
- **Decision threshold:** 0.5, fixed in advance and not tuned.

## Evaluation (fixed)

- **Outer CV:** 5-fold grouped stratified, repeated 10 times, seed 20261010 (repeat r uses seed 20261010 + r).
- **Out-of-fold probability per patient:** the mean across the 10 repeats. Its spread is the standard deviation across repeats.
- **Primary metric:** AUROC of the mean out-of-fold probabilities, with a 95% bootstrap CI (2000 patient resamples, seed 20261010).
- **Secondary metrics:** sensitivity, specificity and balanced accuracy at the fixed 0.5 threshold; the mean and SD of per-repeat AUROC.
- **Permutation test:** 200 label permutations, each run through the same nested procedure with 1 repeat. p = (1 + count of permuted AUROC at least the observed AUROC) / (1 + 200).
- **Baselines:**
  - Majority class: always "stenosis". Accuracy 40/59, AUROC 0.5.
  - Exam only: the same nested procedure on two binary inputs from the sheet, systolic-only thrill and systolic-only bruit.
- **Final model:** refit on all included patients with the same inner search, saved as plain JSON (`model.json`). Its SHA-256 is the checkpoint hash. **Predictions from the final model are not out-of-fold** and must never be presented as cohort performance.

## Reporting rule

- The result is reported as it comes out, whether good or weak.
- If the AUROC CI includes 0.5, or the permutation p-value is at least 0.05, the index is presented as "not shown to be better than chance on this cohort". It is then used only to teach how a model is evaluated, not as decision support.

## Amendment v1.1 (2026-10-10T16:43Z, before any metric was computed)

- **Why:** label-blind feature extraction showed that the v1.0 systolic/diastolic windows (fixed 50-300 ms and 450-700 ms after R, beats with RR of at least 0.75 s only) exclude almost every beat when the heart rate is above 80 bpm. For example, pat002 has a median RR of 0.669 s and kept 3 of 88 beats. Excluding patients because of heart rate would bias the cohort. The v1.0 run was stopped during feature extraction. No label was read, and no model was fitted or scored.
- **Change:** windows now scale with each beat's RR interval. Systolic is 6% to 36% of RR after R, diastolic is 55% to 85% of RR after R, and only beats with RR between 0.4 and 1.5 s count. Nothing else changed.
- **v1.0 code SHA-256:** `4d6b5bafb9ddad3e641ed52adb6fee2182f2aaf2115d2087b9bed176474cbe3f`
- **v1.1 code SHA-256:** `806a3c7f38a86b79b3864199e48744682b949b1a3f70a6de2e3c13b7f0d7e7f2`
- **Status:** the v1.1 evaluation has not been run yet. It is paused for the label fact check requested in the teammate reconciliation.
