#!/usr/bin/env python3
"""Validate an OpenKBP sparse CSV case, and calculate benchmark-space dose summaries.

Requires: numpy. This tool is research/education validation, not clinical software.
It does not derive a patient DICOM coordinate frame or certify any treatment plan.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path
import sys
import numpy as np

DEFAULT_SHAPE = (128, 128, 128)
ROI_NAMES = (
    "Brainstem", "SpinalCord", "RightParotid", "LeftParotid",
    "Esophagus", "Larynx", "Mandible", "PTV56", "PTV63", "PTV70"
)

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()

def read_sparse_csv(path: Path, shape: tuple[int,int,int], binary=False) -> np.ndarray:
    n = int(np.prod(shape))
    out = np.zeros(n, dtype=np.float32)
    seen: set[int] = set()
    with path.open(newline="", encoding="utf8") as f:
        rows = csv.reader(f)
        header = next(rows, None)
        if header is None or len(header) != 2 or header[1].strip().lower() != "data":
            raise ValueError(f"Invalid sparse header: {path}")
        for line, row in enumerate(rows, 2):
            if not row or all(not v.strip() for v in row):
                continue
            if len(row) != 2:
                raise ValueError(f"Expected 2 columns at {path}:{line}")
            idx = int(row[0])
            if not (0 <= idx < n) or idx in seen:
                raise ValueError(f"Duplicate/out-of-range voxel index {idx} at {path}:{line}")
            seen.add(idx)
            value = 1.0 if binary else float(row[1])
            if not np.isfinite(value):
                raise ValueError(f"Nonfinite voxel {idx} at {path}:{line}")
            out[idx] = value
    return out.reshape(shape, order="C")

def dose_statistics(dose_gy: np.ndarray, roi: np.ndarray, spacing_mm: np.ndarray) -> dict:
    mask = roi.astype(bool)
    values = dose_gy[mask].astype(np.float64)
    if values.size == 0:
        return {"status": "empty-mask", "voxels": 0}
    voxel_cc = float(np.prod(spacing_mm) / 1000)
    # In cumulative DVH convention D95 approximates the dose received by 95%
    # of structure volume. Percentile choice must match official metric protocol.
    sorted_ascending = np.sort(values)
    n_point_one_cc = max(1, int(np.ceil(0.1 / voxel_cc)))
    near_max = float(sorted_ascending[-min(n_point_one_cc, len(values))])
    return {
        "status": "ok", "voxels": int(values.size),
        "volume_cc": round(values.size * voxel_cc, 5),
        "dmean_gy": round(float(np.mean(values)), 5),
        "dmax_voxel_gy": round(float(np.max(values)), 5),
        "d95_gy_interpolated": round(float(np.percentile(values, 5)), 5),
        "d0_1cc_gy_nearest_voxel": round(near_max, 5),
        "v20gy_percent": round(float(100 * np.mean(values >= 20)), 5),
        "note": "Exploratory statistics. Compare benchmark clinical-metric conventions before reporting publication-comparable D95/D0.1cc."
    }

def validate_case(case_path: Path, shape=DEFAULT_SHAPE) -> dict:
    case_path = Path(case_path)
    vpath = case_path / "voxel_dimensions.csv"
    spacing = np.loadtxt(vpath, dtype=np.float64).reshape(-1)
    if spacing.shape != (3,) or not np.all(np.isfinite(spacing)) or not np.all(spacing > 0):
        raise ValueError("Voxel spacing requires 3 positive finite mm values")
    files = [p for p in case_path.glob("*.csv")]
    results: dict = {
        "case": case_path.name,
        "grid_shape": list(shape),
        "voxel_dimensions_mm": spacing.tolist(),
        "files_sha256": {p.name: sha256(p) for p in files},
        "available_rois": {},
        "dose_reference_kind": "OpenKBP benchmark reference dose (NOT clinical-plan certification)",
        "coordinate_frame": "OpenKBP processed voxel-grid; native DICOM origin and orientation NOT ASSUMED",
    }
    for required in ["ct.csv", "dose.csv", "possible_dose_mask.csv"]:
        if not (case_path/required).is_file():
            raise FileNotFoundError(case_path/required)
    dose = read_sparse_csv(case_path/"dose.csv", shape)
    ct = read_sparse_csv(case_path/"ct.csv", shape)
    allowed = read_sparse_csv(case_path/"possible_dose_mask.csv", shape, binary=True)
    if np.any(dose < 0):
        results["warnings"] = ["Negative dose values present"]
    results["dose_nonzero_voxels"] = int(np.count_nonzero(dose))
    results["ct_nonzero_voxels"] = int(np.count_nonzero(ct))
    results["possible_dose_voxels"] = int(np.count_nonzero(allowed))
    # Unmasked dose data may contain intentionally sparse zeros. Don't assume
    # all nonzero values are restricted to a given mask without a version check.
    for name in ROI_NAMES:
        p=case_path/f"{name}.csv"
        if p.exists():
            roi = read_sparse_csv(p, shape, binary=True)
            results["available_rois"][name] = dose_statistics(dose, roi, spacing)
    if not results["available_rois"]:
        raise ValueError("No supported anatomical structure masks found")
    return results

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("case_dir", type=Path, help="folder containing sparse OpenKBP patient .csv files")
    parser.add_argument("--shape", type=int, nargs=3, default=DEFAULT_SHAPE)
    args=parser.parse_args()
    try:
        print(json.dumps(validate_case(args.case_dir, tuple(args.shape)), indent=2, sort_keys=True))
    except Exception as exc:
        print(f"VALIDATION FAILED: {exc}", file=sys.stderr)
        return 1
    return 0

if __name__=="__main__":
    raise SystemExit(main())
