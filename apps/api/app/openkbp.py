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
import math
from pathlib import Path
import re
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
    if len(shape) != 3 or any(
        not isinstance(dimension, (int, np.integer))
        or isinstance(dimension, (bool, np.bool_))
        or dimension <= 0
        for dimension in shape
    ):
        raise ValueError("Sparse grid shape requires 3 positive integer dimensions")
    n = math.prod(int(dimension) for dimension in shape)
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
            raw_index = row[0].strip()
            if re.fullmatch(r"[+-]?\d+", raw_index) is None:
                raise ValueError(f"Invalid integer voxel index {row[0]!r} at {path}:{line}")
            idx = int(raw_index)
            if not 0 <= idx < n:
                raise ValueError(f"Voxel index out-of-range ({idx}) at {path}:{line}")
            if idx in seen:
                raise ValueError(f"Duplicate voxel index {idx} at {path}:{line}")
            seen.add(idx)
            try:
                value = 1.0 if binary else float(row[1])
            except ValueError as exc:
                raise ValueError(f"Invalid voxel value {row[1]!r} at {path}:{line}") from exc
            if not np.isfinite(value):
                raise ValueError(f"Nonfinite voxel {idx} at {path}:{line}")
            out[idx] = value
    return out.reshape(shape, order="C")

def dose_statistics(dose_gy: np.ndarray, roi: np.ndarray, spacing_mm: np.ndarray) -> dict:
    if dose_gy.ndim != 3 or roi.shape != dose_gy.shape:
        raise ValueError("Dose and ROI arrays must share the same 3-dimensional grid")
    spacing_mm = np.asarray(spacing_mm, dtype=np.float64)
    if spacing_mm.shape != (3,) or not np.all(np.isfinite(spacing_mm)) or not np.all(spacing_mm > 0):
        raise ValueError("Voxel spacing requires 3 positive finite mm values")
    mask = roi.astype(bool)
    values = dose_gy[mask].astype(np.float64)
    if values.size == 0:
        return {"status": "empty-mask", "voxels": 0}
    voxel_volume_mm3 = float(np.prod(spacing_mm))
    voxel_cc = voxel_volume_mm3 / 1000
    # Match the OpenKBP evaluator: round the voxel count, then use NumPy's
    # percentile interpolation for D_0.1_cc. A nearest-voxel shortcut differs
    # for these 88.2 mm^3 voxels and must not be presented as the benchmark metric.
    voxels_within_tenths_cc = min(len(values), max(1, int(np.round(100 / voxel_volume_mm3))))
    d0_1_cc_percentile = 100 - voxels_within_tenths_cc / len(values) * 100
    return {
        "status": "ok", "voxels": int(values.size),
        "volume_cc": round(values.size * voxel_cc, 5),
        "dmean_gy": round(float(np.mean(values)), 5),
        "dmax_voxel_gy": round(float(np.max(values)), 5),
        "d95_gy_interpolated": round(float(np.percentile(values, 5)), 5),
        "d0_1cc_gy_openkbp": round(float(np.percentile(values, d0_1_cc_percentile)), 5),
        "openkbp_d0_1cc_percentile": float(d0_1_cc_percentile),
        "d99_gy_openkbp": round(float(np.percentile(values, 1)), 5),
        "d1_gy_openkbp": round(float(np.percentile(values, 99)), 5),
        "v20gy_percent": round(float(100 * np.mean(values >= 20)), 5),
        "note": "Percentile metrics follow the pinned OpenKBP evaluator. For ROIs smaller than 0.1 cc, D0.1cc uses the full available ROI; no clinical interpretation is implied."
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
