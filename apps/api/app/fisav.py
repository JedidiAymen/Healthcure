"""Checksum-verified access and bounded analysis for a local FiSaV sample."""
from __future__ import annotations

import hashlib
import json
import os
import re
from functools import lru_cache
from pathlib import Path

import numpy as np

from .schemas import Case, SignalFeatures, SignalRecord, SignalSpectrogram, SignalSpectrum, SignalWindow

SOURCE_URL = "https://osf.io/hypfr/"
PAPER_URL = "https://www.nature.com/articles/s41597-026-08242-8"
CHANNELS = ("ECG", "raw PZT1", "raw PZT2", "raw PZT3", "raw PZT4")
CHANNEL_INDEX = {name: index + 1 for index, name in enumerate(CHANNELS)}


def root_dir() -> Path | None:
    value = os.environ.get("MEDFORGE_FISAV_ROOT", "").strip()
    if not value:
        return None
    root = Path(value).expanduser().resolve()
    return root if root.is_dir() else None


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _catalogue(root: Path) -> list[dict] | None:
    try:
        manifest = json.loads((root / "medforge-source-manifest.json").read_text(encoding="utf8"))
        if (manifest.get("dataset_doi") != "10.17605/OSF.IO/HYPFR"
                or manifest.get("license") != "CC BY 4.0"):
            return None
        entries = manifest.get("records") or [manifest.get("sample_file")]
        safe = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            filename = entry.get("file_name", "")
            digest = entry.get("sha256", "")
            size = entry.get("uncompressed_bytes")
            if not re.fullmatch(r"pat\d{3}\.csv", filename) or not re.fullmatch(r"[a-f0-9]{64}", digest):
                continue
            if not isinstance(size, int) or size < 1:
                continue
            path = (root / filename).resolve()
            if path.parent == root and path.is_file() and path.stat().st_size == size:
                safe.append(entry)
        return safe
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return None


@lru_cache(maxsize=3)
def _load_record(root_text: str, file_name: str, expected_sha: str, modified_ns: int,
                 changed_ns: int, size: int) -> tuple[np.ndarray, float, str] | None:
    root = Path(root_text)
    try:
        entries = _catalogue(root) or []
        meta = next((entry for entry in entries if entry["file_name"] == file_name), None)
        path = (root / file_name).resolve()
        if (meta is None or meta.get("sha256") != expected_sha
                or path.parent != root or path.name != file_name
                or path.stat().st_mtime_ns != modified_ns or path.stat().st_ctime_ns != changed_ns
                or path.stat().st_size != size
                or _sha256(path) != expected_sha):
            return None
        # Only the time column and five measured channels are loaded. Occlusion
        # is deliberately kept out of this signal view to avoid implying a label.
        values = np.loadtxt(path, delimiter=",", skiprows=1, usecols=(0, 1, 2, 3, 4, 5), dtype=np.float64)
        if values.ndim != 2 or values.shape[1] != 6 or values.shape[0] < 1000 or not np.isfinite(values).all():
            return None
        times = values[:, 0]
        steps = np.diff(times)
        if np.any(steps <= 0):
            return None
        # Keep the recorded time values for plotting. The public cohort has a few
        # 1% timestamp intervals, so the median still gives the 10 kHz base rate.
        step = float(np.median(steps))
        if step <= 0 or not np.allclose(steps, step, rtol=0, atol=max(1e-9, step * 1.1e-2)):
            return None
        sample_rate = round(1.0 / step, 6)
        if not 100 <= sample_rate <= 100_000:
            return None
        return values, sample_rate, expected_sha
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
        return None


def installed_records() -> list[Case]:
    root = root_dir()
    if root is None:
        return []
    entries = _catalogue(root)
    if entries is None:
        return []
    return [Case(id=f"fisav:{Path(entry['file_name']).stem}", module="fistulaguard",
                 dataset_id="FiSaV", source_case_id=Path(entry["file_name"]).stem,
                 reference_kind="research", status="ready",
                 label=f"FiSaV · {Path(entry['file_name']).stem} · source signal")
            for entry in entries]


def _record_entry(record_id: str) -> tuple[Path, dict] | None:
    if not re.fullmatch(r"pat\d{3}", record_id):
        return None
    root = root_dir()
    if root is None:
        return None
    entries = _catalogue(root)
    if entries is None:
        return None
    entry = next((row for row in entries if row["file_name"] == f"{record_id}.csv"), None)
    return (root, entry) if entry else None


def record(record_id: str = "pat001") -> tuple[np.ndarray, float, str] | None:
    located = _record_entry(record_id)
    if located is None:
        return None
    root, entry = located
    try:
        path = (root / entry["file_name"]).resolve()
        if path.parent != root or not path.is_file():
            return None
        stat = path.stat()
        return _load_record(str(root), entry["file_name"], entry["sha256"],
                            stat.st_mtime_ns, stat.st_ctime_ns, stat.st_size)
    except OSError:
        return None


def record_summary(data: tuple[np.ndarray, float, str], record_id: str = "pat001") -> SignalRecord:
    values, sample_rate, digest = data
    duration = float(values[-1, 0] - values[0, 0])
    return SignalRecord(
        id=record_id, dataset_id="FiSaV", source_case_id=record_id, case_id=f"fisav:{record_id}",
        file_name=f"{record_id}.csv", source_sha256=digest, source_url=SOURCE_URL,
        sample_rate_hz=sample_rate, duration_sec=duration,
        channel_units={channel: "source-value (physical unit unspecified)" for channel in CHANNELS},
        channels=list(CHANNELS), sample_count=int(values.shape[0]),
        limitations=[
            "This view covers one source recording; no pooled cohort calculations are shown.",
            "Sensor calibration and physical units are not provided in this view.",
            "No stenosis label, classifier, patient-disjoint validation or diagnostic interpretation is exposed.",
            "The occlusion field is not interpreted as a stenosis outcome.",
        ],
    )


def case_record(data: tuple[np.ndarray, float, str], record_id: str = "pat001") -> Case:
    return Case(id=f"fisav:{record_id}", module="fistulaguard", dataset_id="FiSaV",
                source_case_id=record_id, reference_kind="research", status="ready",
                label=f"FiSaV · {record_id} · source signal")


def _window(values: np.ndarray, channel: str, start_sec: float, duration_sec: float):
    if channel not in CHANNEL_INDEX:
        raise ValueError("Unsupported FiSaV signal channel")
    # Select against actual source timestamps, preserving time alignment.
    times = values[:, 0]
    indices = np.flatnonzero((times >= start_sec) & (times < start_sec + duration_sec))
    if not len(indices):
        raise ValueError("Requested signal window contains no source samples")
    return indices, values[indices, CHANNEL_INDEX[channel]]


def waveform(data: tuple[np.ndarray, float, str], channel: str, start_sec: float, duration_sec: float,
             record_id: str = "pat001") -> SignalWindow:
    values, sample_rate, digest = data
    if channel not in CHANNEL_INDEX:
        raise ValueError("Unsupported FiSaV signal channel")
    indices, signal = _window(values, channel, start_sec, duration_sec)
    limit = 2000
    if len(indices) > limit:
        # Min/max envelope preserves narrow peaks while keeping the API payload bounded.
        bins = np.array_split(np.arange(len(indices)), limit // 2)
        chosen = np.array([part[k] for part in bins for k in sorted({int(np.argmin(signal[part])), int(np.argmax(signal[part]))})])
        indices, signal = indices[chosen], signal[chosen]
    samples = [{"time_sec": float(values[index, 0]), "value": float(value)} for index, value in zip(indices, signal)]
    duration = float(samples[-1]["time_sec"] - samples[0]["time_sec"])
    return SignalWindow(case_id=f"fisav:{record_id}", channel=channel,
        channel_unit="source-value (physical unit unspecified)", source_sha256=digest,
        source_sample_rate_hz=sample_rate, start_sec=start_sec, duration_sec=duration,
        original_sample_count=int(np.count_nonzero((values[:, 0] >= start_sec) & (values[:, 0] < start_sec + duration_sec))),
        samples=samples, method="Source-aligned measured samples; min/max envelope used only when display points exceed 2,000.")


def spectrum(data: tuple[np.ndarray, float, str], channel: str, start_sec: float, duration_sec: float,
             record_id: str = "pat001") -> SignalSpectrum:
    values, sample_rate, digest = data
    indices, signal = _window(values, channel, start_sec, duration_sec)
    segment_size = min(int(round(sample_rate)), len(signal))
    if segment_size < 8:
        raise ValueError("Selected source window is too short for a spectrum")
    step = max(1, segment_size // 2)
    window = np.hanning(segment_size)
    scale = sample_rate * float(np.sum(window ** 2))
    spectra = []
    for offset in range(0, len(signal) - segment_size + 1, step):
        segment = signal[offset:offset + segment_size]
        power = np.abs(np.fft.rfft((segment - np.mean(segment)) * window)) ** 2 / scale
        if segment_size % 2 == 0:
            power[1:-1] *= 2
        else:
            power[1:] *= 2
        spectra.append(power)
    mean_power = np.mean(spectra, axis=0)
    frequencies = np.fft.rfftfreq(segment_size, 1.0 / sample_rate)
    return SignalSpectrum(case_id=f"fisav:{record_id}", channel=channel,
        source_sha256=digest, source_sample_rate_hz=sample_rate,
        start_sec=start_sec, duration_sec=float(values[indices[-1], 0] - values[indices[0], 0]),
        window_samples=segment_size, frequencies_hz=frequencies.tolist(),
        power_per_hz=mean_power.tolist(), unit="source-value²/Hz (physical unit unspecified)",
        method=f"Welch periodogram from source samples; {segment_size}-sample Hann window, 50% overlap, mean detrending.")


def spectrogram(data: tuple[np.ndarray, float, str], channel: str, start_sec: float, duration_sec: float,
                record_id: str = "pat001") -> SignalSpectrogram:
    values, sample_rate, digest = data
    indices, signal = _window(values, channel, start_sec, duration_sec)
    window_samples = min(max(16, int(round(sample_rate * 0.1))), 8192, len(signal))
    if window_samples < 8:
        raise ValueError("Selected source window is too short for a spectrogram")
    hop_samples = max(1, window_samples // 2)
    offsets = np.arange(0, len(signal) - window_samples + 1, hop_samples, dtype=np.int64)
    if len(offsets) > 160:
        offsets = offsets[np.linspace(0, len(offsets) - 1, 160, dtype=np.int64)]
    taper = np.hanning(window_samples)
    scale = sample_rate * float(np.sum(taper ** 2))
    frames = []
    for offset in offsets:
        segment = signal[offset:offset + window_samples]
        power = np.abs(np.fft.rfft((segment - np.mean(segment)) * taper)) ** 2 / scale
        if window_samples % 2 == 0:
            power[1:-1] *= 2
        else:
            power[1:] *= 2
        frames.append(power)
    frequencies = np.fft.rfftfreq(window_samples, 1.0 / sample_rate)
    frame_grid = np.stack(frames, axis=1)
    frequency_groups = np.array_split(np.arange(len(frequencies)), min(128, len(frequencies)))
    reduced_frequencies = np.asarray([np.mean(frequencies[group]) for group in frequency_groups])
    power_grid = np.stack([np.mean(frame_grid[group, :], axis=0) for group in frequency_groups])
    centers = np.minimum(offsets + window_samples // 2, len(indices) - 1)
    source_times = values[indices[centers], 0]
    return SignalSpectrogram(
        case_id=f"fisav:{record_id}", channel=channel, source_sha256=digest,
        source_sample_rate_hz=sample_rate, start_sec=float(values[indices[0], 0]),
        duration_sec=float(values[indices[-1], 0] - values[indices[0], 0]),
        window_samples=window_samples, hop_samples=hop_samples,
        frequencies_hz=reduced_frequencies.tolist(), times_sec=source_times.tolist(),
        power_per_hz=power_grid.tolist(), unit="source-value²/Hz (physical unit unspecified)",
        method=(f"Single-sided Hann-window PSD with mean detrending; {window_samples}-sample window, "
                f"{hop_samples}-sample hop. Adjacent linear frequency bins are averaged to at most 128 "
                "display bands and time frames are evenly sampled to at most 160."),
    )


def features(data: tuple[np.ndarray, float, str], channel: str, start_sec: float, duration_sec: float,
             record_id: str = "pat001") -> SignalFeatures:
    values, sample_rate, digest = data
    indices, signal = _window(values, channel, start_sec, duration_sec)
    signal = np.asarray(signal, dtype=np.float64)
    selected_times = values[indices, 0]
    interval_differences = np.diff(selected_times)
    interval_tolerance = 0.001
    nominal_step = 1.0 / sample_rate
    interval_deviations = int(np.count_nonzero(
        np.abs(interval_differences - nominal_step) > nominal_step * interval_tolerance
    ))
    finite = np.isfinite(signal)
    mean = float(np.mean(signal))
    return SignalFeatures(
        case_id=f"fisav:{record_id}", channel=channel, source_sha256=digest,
        source_sample_rate_hz=sample_rate, start_sec=start_sec,
        duration_sec=float(values[indices[-1], 0] - values[indices[0], 0]), sample_count=int(len(signal)),
        finite_sample_count=int(np.count_nonzero(finite)), nonfinite_sample_count=int(len(signal) - np.count_nonzero(finite)),
        timestamp_interval_count=int(len(interval_differences)),
        timestamp_interval_deviation_count=interval_deviations,
        timestamp_interval_tolerance_fraction=interval_tolerance,
        constant_signal=bool(np.ptp(signal) == 0),
        unit="source-value (physical unit unspecified)", mean=mean,
        median=float(np.median(signal)), standard_deviation=float(np.std(signal)),
        rms=float(np.sqrt(np.mean(np.square(signal)))),
        peak_to_peak=float(np.max(signal) - np.min(signal)),
        zero_fraction=float(np.mean(signal == 0)),
        adjacent_repeat_fraction=float(np.mean(np.diff(signal) == 0)) if len(signal) > 1 else 0.0,
        method="Descriptive statistics calculated directly from the selected measured samples; no quality threshold or clinical interpretation is applied.",
    )
