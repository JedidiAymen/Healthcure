#!/usr/bin/env python3
"""Compare MEDFORGE case calculations with the pinned official OpenKBP evaluator."""
from __future__ import annotations

import json
import math
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASE = ROOT / "data" / "openkbp" / "pt_201"
UPSTREAM = ROOT / "references" / "open-kbp-validation"
sys.path.insert(0, str(ROOT / "apps" / "api"))
sys.path.insert(0, str(UPSTREAM))

from app.openkbp import read_sparse_csv, sha256, validate_case
from provided_code.data_loader import DataLoader
from provided_code.dose_evaluation_class import DoseEvaluator


def main() -> int:
    if not CASE.is_dir():
        raise SystemExit(f"Missing local source case: {CASE}; run scripts/acquire_openkbp_pt201.py")
    derived = validate_case(CASE)
    with tempfile.TemporaryDirectory(prefix="medforge-openkbp-check-") as temp:
        prediction = Path(temp) / "pt_201.csv"
        prediction.symlink_to(CASE / "dose.csv")
        evaluator = DoseEvaluator(
            DataLoader([CASE], batch_size=1),
            DataLoader([prediction], batch_size=1),
        )
        evaluator.evaluate()
        dose_score, dvh_score = evaluator.get_scores()
        official = evaluator.reference_dvh_metrics_df.loc["pt_201"]

    comparisons = []
    roi_names = [*derived["available_rois"]]
    for roi in roi_names:
        calculated = derived["available_rois"][roi]
        official_mean = official.get(("mean", roi))
        if official_mean is not None and not math.isnan(float(official_mean)):
            diff = abs(float(calculated["dmean_gy"]) - float(official_mean))
            if diff > 0.00001:
                raise AssertionError(f"{roi} mean-dose mismatch: {calculated['dmean_gy']} vs {official_mean}")
            comparisons.append({"roi": roi, "metric": "mean", "medforge_gy": calculated["dmean_gy"], "official_gy": round(float(official_mean), 5), "absolute_difference_gy": diff})
        official_d0 = official.get(("D_0.1_cc", roi))
        if official_d0 is not None and not math.isnan(float(official_d0)):
            diff = abs(float(calculated["d0_1cc_gy_openkbp"]) - float(official_d0))
            if diff > 0.00001:
                raise AssertionError(f"{roi} D_0.1_cc mismatch: {calculated['d0_1cc_gy_openkbp']} vs {official_d0}")
            comparisons.append({"roi": roi, "metric": "D_0.1_cc", "medforge_gy": calculated["d0_1cc_gy_openkbp"], "official_gy": round(float(official_d0), 5), "absolute_difference_gy": diff})
        for metric, key in (("D_95", "d95_gy_interpolated"), ("D_99", "d99_gy_openkbp"), ("D_1", "d1_gy_openkbp")):
            ref = official.get((metric, roi))
            if ref is None or math.isnan(float(ref)):
                continue
            diff = abs(float(calculated[key]) - float(ref))
            if diff > 0.00001:
                raise AssertionError(f"{roi} {metric} mismatch: {calculated[key]} vs {ref}")
            comparisons.append({"roi": roi, "metric": metric, "medforge_gy": calculated[key], "official_gy": round(float(ref), 5), "absolute_difference_gy": diff})

    result = {
        "status": "PASS",
        "case_id": "pt_201",
        "case_directory": str(CASE),
        "source_commit": "ce625e62f3b04203f22bd9d1634f3e8fb0245e46",
        "source_manifest": "docs/openkbp-pt201-manifest.json",
        "official_evaluator": "references/open-kbp-validation/provided_code/dose_evaluation_class.py",
        "official_same_dose_scores": {"dose_score": float(dose_score), "dvh_score": float(dvh_score)},
        "comparisons": comparisons,
        "comparison_count": len(comparisons),
        "max_absolute_difference_gy": max((item["absolute_difference_gy"] for item in comparisons), default=0.0),
        "grid_shape": derived["grid_shape"],
        "spacing_mm": derived["voxel_dimensions_mm"],
        "dose_sha256": sha256(CASE / "dose.csv"),
        "limitations": [
            "This checks numerical agreement with the published benchmark evaluator on one validation case.",
            "It does not verify model prediction quality, treatment validity, DICOM orientation, or clinical use.",
            "Same-dose evaluator scores are a code-path sanity check, not a model result.",
        ],
    }
    output = ROOT / "docs" / "openkbp-pt201-validation.json"
    result["output"] = "docs/openkbp-pt201-validation.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: result[key] for key in ("status", "comparison_count", "max_absolute_difference_gy", "official_same_dose_scores", "output")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
