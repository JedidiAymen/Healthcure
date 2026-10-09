# 20 — Scientific validation protocol & reproducible scripts

## Local validation kit included
- `scripts/validate_openkbp_case.py` — load a local real OpenKBP case from its sparse CSV source; validate spacing/index ranges/duplicates/missing files, calculate elementary ROI dose statistics and output JSON with per-file SHA256.
- `tests/test_openkbp_case.py` — synthetic geometry/dose tests, rejecting malformed sparse data, empty structure and missing-file behavior.

**Run on any Linux/macOS machine with Python + NumPy + pytest:**
```
python -m pytest -q tests/test_openkbp_case.py
python scripts/validate_openkbp_case.py references/open-kbp/provided-data/validation-pats/pt_201 > data/derived/pt_201_validation.json
```

## What *passing the included tests* does NOT prove
These tests cover logic using **synthetic arrays**. They do not validate a real OpenKBP dose/DVH, file transfer, browser visualization, source GPU models, calibration, clinical suitability, or a deliverable radiation plan.

## Real-data dose acceptance (Luna must perform)
1. Parse `pt_201`, confirm 128³ shape and 3 positive spacing numbers, record patient-specific ROI presence.
2. Confirm masks' flattened indices are in [0,128³) and follow official OpenKBP `np.put` semantics.
3. Compare tissue masks and reference-dose overlays in 3 orthogonal views; verify original array strides and explicit grid-axis labels (avoid 'left/right' anatomical assertion absent orientation).
4. Check `mean`, D95, D0.1cc and DVH metrics against official `provided_code/dose_evaluation_class.py` (not just our approximate continuous-interpolation definitions). Document differences in metric conventions.
5. Test same case with independent CPU reference; 3D mesh geometry comes later and must derive from same transform, not approximated with ad hoc scaling.
6. Only label output as "actual OpenKBP reference/archived dose" when data and checksums match the source. Note that these are benchmark/synthetic-dose research data; not patient-specific clinical planning approval.

## SurgiVision acceptance
- Exactly align official COCO boxes/masks to correct frames and natural image dimensions. Show image time spacing honestly; no pseudo-30-FPS video from 5-second-sampled labels.
- If a weight is present, isolate and hash trusted checkpoint; reproduce at least one labeled evaluation against source convention and keep eval split at video-level.
- A missing checkpoint disables model run; expert annotations must remain visually distinct from predictions.

## FistulaGuard acceptance
- Raw FiSaV needs explicit source and data rights; confirm sampled channels/units/sensor locations and ECG reference. Never treat vibration/force as automatically equivalent to microphone sound pressure.
- Compute PSD with known sampling rate/window normalization; unit-aware axes (`Hz`, e.g. arbitrary/physical PSD units as appropriate). Segment comparisons by actual timestamps.
- If ML classification is fitted, split by **subject** (not time window); report n_subjects, class counts, confidence intervals, failed quality gates and explain research-only status.
- If dataset remains unavailable, count FistulaGuard as design-complete but raw-data-blocked, not a successful clinical ML demo.

## QA blockers
Reject any run that (a) mismatches case IDs, (b) silently changes dose geometry, (c) uses synthetic values tagged as real, (d) evaluates mixed patient windows across splits, (e) hides missing pretrained weights, or (f) exposes protected student answer keys before submit.
