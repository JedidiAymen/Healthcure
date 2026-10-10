"""Local-only import checks and comparisons for authentic OpenKBP-grid dose arrays."""
from __future__ import annotations

import csv
import io
import math
from pathlib import Path
import re

import numpy as np

from .openkbp import ROI_NAMES, dose_statistics, read_sparse_csv

SHAPE = (128, 128, 128)
INDEX_CONVENTION = 'x-major-y-middle-z-fastest'
MAX_UPLOAD_BYTES = 64 * 1024 * 1024


def parse_spacing(value: str) -> tuple[float, float, float]:
    try:
        spacing = tuple(float(part.strip()) for part in value.split(','))
    except ValueError as exc:
        raise ValueError('Spacing must contain three comma-separated millimeter values') from exc
    if len(spacing) != 3 or not all(math.isfinite(item) and item > 0 for item in spacing):
        raise ValueError('Spacing must contain three positive finite millimeter values')
    return spacing  # type: ignore[return-value]


def validate_prediction(path: Path) -> np.ndarray:
    if path.stat().st_size <= 0 or path.stat().st_size > MAX_UPLOAD_BYTES:
        raise ValueError('Dose CSV must be between 1 byte and 64 MiB')
    prediction = read_sparse_csv(path, SHAPE)
    if not np.all(np.isfinite(prediction)):
        raise ValueError('Dose prediction contains a non-finite value')
    if np.any(prediction < 0):
        raise ValueError('Dose prediction contains a negative value; Gy values must be nonnegative')
    if not np.any(prediction > 0):
        raise ValueError('Dose prediction contains no positive dose values')
    return prediction


def file_name(value: str) -> str:
    normalized = value.replace('\\', '/')
    name = Path(normalized).name
    if normalized != name:
        raise ValueError('Upload file name must not include a folder path')
    if not name or len(name) > 160 or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._ -]*\.csv', name, re.IGNORECASE):
        raise ValueError('Upload must have a simple CSV file name')
    return name


def comparison_for_roi(reference: np.ndarray, prediction: np.ndarray, mask: np.ndarray, spacing: np.ndarray) -> dict:
    ref = reference[mask.astype(bool)].astype(np.float64)
    pred = prediction[mask.astype(bool)].astype(np.float64)
    if not ref.size:
        raise ValueError('Selected structure has no voxels in this case')
    difference = pred - ref
    maximum = max(float(np.max(reference)), float(np.max(prediction)))
    if not math.isfinite(maximum) or maximum <= 0:
        raise ValueError('A positive finite shared Gy range is unavailable')
    thresholds = np.linspace(0, maximum, 51)
    return {
        'voxel_count': int(ref.size),
        'reference_mean_gy': float(np.mean(ref)),
        'prediction_mean_gy': float(np.mean(pred)),
        'mean_delta_gy': float(np.mean(difference)),
        'mean_absolute_delta_gy': float(np.mean(np.abs(difference))),
        'maximum_absolute_delta_gy': float(np.max(np.abs(difference))),
        'reference_dvh': [{'dose_gy': float(threshold), 'volume_percent': float(100 * np.mean(ref >= threshold))} for threshold in thresholds],
        'prediction_dvh': [{'dose_gy': float(threshold), 'volume_percent': float(100 * np.mean(pred >= threshold))} for threshold in thresholds],
        'reference_metrics': dose_statistics(reference, mask, spacing),
        'prediction_metrics': dose_statistics(prediction, mask, spacing),
    }


def validate_sparse_csv_bytes(payload: bytes) -> None:
    """Stream-validate the declared OpenKBP sparse CSV shape before persistence."""
    if not payload or len(payload) > MAX_UPLOAD_BYTES:
        raise ValueError('Dose CSV must be between 1 byte and 64 MiB')
    # The on-disk parser checks header, integer bounds, finite numbers and duplicate indices.
    # This lightweight guard prevents NUL data and non-UTF8 payloads before a temp file is parsed.
    try:
        text = payload.decode('utf-8-sig')
    except UnicodeDecodeError as exc:
        raise ValueError('Dose CSV must be UTF-8 text') from exc
    if '\x00' in text:
        raise ValueError('Dose CSV contains invalid binary data')
    rows = csv.reader(io.StringIO(text))
    header = next(rows, None)
    if header is None or len(header) != 2 or header[0].strip().lower() not in {'', 'index', 'voxel'} or header[1].strip().lower() != 'data':
        raise ValueError('Dose CSV needs an index,data header')
