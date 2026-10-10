"""Teaching-grade signal processing for measured FiSaV windows.

Methods are standard and documented so learners can inspect them: Butterworth band-pass and
IIR notch filters applied forward and backward (zero phase), and an R-peak detector in the
style of Pan and Tompkins (band-pass, derivative, squaring, moving integration, peak picking).
None of this is a diagnostic method or a validated clinical algorithm.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
from scipy import signal as sps

FILTER_ORDER = 4
ENSEMBLE_POINTS = 400


@dataclass(frozen=True)
class FilterSpec:
    mode: Literal['bandpass', 'notch']
    low_hz: float | None = None
    high_hz: float | None = None
    notch_hz: float | None = None
    q: float = 30.0

    def validate(self, fs: float) -> None:
        nyquist = fs / 2
        if self.mode == 'bandpass':
            if self.low_hz is None or self.high_hz is None or self.low_hz <= 0:
                raise ValueError('A band-pass filter needs a positive low cutoff and a high cutoff')
            if self.low_hz >= self.high_hz:
                raise ValueError('The low cutoff must be below the high cutoff')
            if self.high_hz >= nyquist:
                raise ValueError(f'The high cutoff must be below the Nyquist frequency ({nyquist:g} Hz)')
        elif self.mode == 'notch':
            if self.notch_hz is None or not 0 < self.notch_hz < nyquist:
                raise ValueError(f'The notch frequency must be between 0 and the Nyquist frequency ({nyquist:g} Hz)')
            if self.q <= 0:
                raise ValueError('The notch quality factor must be positive')
        else:
            raise ValueError('Unsupported filter mode')

    @property
    def method(self) -> str:
        if self.mode == 'bandpass':
            return f'Butterworth band-pass (order {FILTER_ORDER}), applied forward and backward (zero phase)'
        return 'IIR notch, applied forward and backward (zero phase)'


def apply_filter(values: np.ndarray, fs: float, spec: FilterSpec) -> np.ndarray:
    spec.validate(fs)
    if spec.mode == 'bandpass':
        sos = sps.butter(FILTER_ORDER, [spec.low_hz, spec.high_hz], btype='bandpass', fs=fs, output='sos')
        return sps.sosfiltfilt(sos, values)
    b, a = sps.iirnotch(spec.notch_hz, spec.q, fs=fs)
    return sps.filtfilt(b, a, values)


def detect_r_peaks(ecg: np.ndarray, fs: float, min_rr_sec: float = 0.3) -> np.ndarray:
    """Return R-peak sample indices. Works for either ECG polarity."""
    if len(ecg) < int(fs):
        return np.array([], dtype=int)
    sos = sps.butter(2, [5, 20], btype='bandpass', fs=fs, output='sos')
    band = sps.sosfiltfilt(sos, ecg - np.median(ecg))
    energy = np.gradient(band) ** 2
    window = max(1, int(0.12 * fs))
    integrated = np.convolve(energy, np.ones(window) / window, mode='same')
    threshold = 0.3 * np.percentile(integrated, 99.5)
    candidates, _ = sps.find_peaks(integrated, height=threshold, distance=int(min_rr_sec * fs))
    # Refine each candidate to the largest band-passed deflection nearby.
    radius = int(0.075 * fs)
    refined = []
    for index in candidates:
        lo, hi = max(0, index - radius), min(len(band), index + radius)
        refined.append(lo + int(np.argmax(np.abs(band[lo:hi]))))
    peaks = np.unique(np.asarray(refined, dtype=int))
    keep = [peaks[0]] if len(peaks) else []
    for index in peaks[1:]:
        if index - keep[-1] >= int(min_rr_sec * fs):
            keep.append(index)
    return np.asarray(keep, dtype=int)


def beat_features(channel: np.ndarray, peaks: np.ndarray, fs: float, pre_sec: float = 0.2, post_sec: float = 0.6):
    """Per-beat peak-to-peak and RMS of a channel around each R peak, plus the ensemble average."""
    pre, post = int(pre_sec * fs), int(post_sec * fs)
    beats, segments = [], []
    for number, index in enumerate(peaks):
        rr = None if number == 0 else float((index - peaks[number - 1]) / fs)
        if index - pre < 0 or index + post > len(channel):
            beats.append({'index': number, 'sample': int(index), 'rr_sec': rr, 'peak_to_peak': None, 'rms': None})
            continue
        segment = channel[index - pre:index + post]
        segments.append(segment)
        centred = segment - segment.mean()
        beats.append({'index': number, 'sample': int(index), 'rr_sec': rr,
                      'peak_to_peak': float(segment.max() - segment.min()), 'rms': float(np.sqrt(np.mean(centred ** 2)))})
    ensemble = {'time_sec': [], 'mean': [], 'sd': [], 'beats_used': len(segments)}
    if segments:
        stack = np.vstack(segments)
        bins = np.array_split(np.arange(stack.shape[1]), min(ENSEMBLE_POINTS, stack.shape[1]))
        times = (np.arange(stack.shape[1]) - pre) / fs
        ensemble['time_sec'] = [float(times[part].mean()) for part in bins]
        ensemble['mean'] = [float(stack[:, part].mean()) for part in bins]
        ensemble['sd'] = [float(stack[:, part].mean(axis=1).std()) for part in bins]
    return beats, ensemble


def envelope(times: np.ndarray, values: np.ndarray, limit: int = 2000) -> tuple[list[float], list[float]]:
    """Bounded min/max envelope that keeps narrow peaks visible."""
    if len(values) <= limit:
        return times.tolist(), values.tolist()
    bins = np.array_split(np.arange(len(values)), limit // 2)
    chosen = np.array([part[k] for part in bins for k in sorted({int(np.argmin(values[part])), int(np.argmax(values[part]))})])
    return times[chosen].tolist(), values[chosen].tolist()


def marker_intervals(times: np.ndarray, flags: np.ndarray) -> list[list[float]]:
    """Contiguous runs where a 0/1 marker column equals 1, as [start, end) in source seconds."""
    active = flags > 0.5
    if not active.any():
        return []
    edges = np.diff(active.astype(int))
    starts = list(np.flatnonzero(edges == 1) + 1)
    ends = list(np.flatnonzero(edges == -1) + 1)
    if active[0]:
        starts.insert(0, 0)
    intervals = []
    for number, start in enumerate(starts):
        end_time = float(times[ends[number]]) if number < len(ends) else float(times[-1])
        intervals.append([round(float(times[start]), 6), round(end_time, 6)])
    return intervals


QUALITY_THRESHOLDS = {
    'finite_fraction': 1.0,
    'timestamp_deviation_fraction': 0.001,
    'clipping_fraction': 0.001,
    'adjacent_repeat_fraction': 0.2,
    'min_beats': 3,
    'rr_cv_max': 0.25,
}


def quality_checks(times: np.ndarray, signal: np.ndarray, ecg: np.ndarray, fs: float) -> tuple[list[dict], bool]:
    """Named, rule-based checks on one measured window. Each check reports its measured value,
    threshold and pass or fail; the window is usable only if every check passes."""
    finite = np.isfinite(signal)
    steps = np.diff(times)
    median_step = float(np.median(steps)) if len(steps) else 0.0
    deviation = float(np.mean(np.abs(steps - median_step) > 0.001 * median_step)) if median_step > 0 else 1.0
    clean = signal[finite]
    # Clipping shows as runs of at least 3 consecutive samples stuck at the window extreme;
    # a smooth periodic signal touching its peak once per cycle is not clipping.
    extreme = 1.0
    if clean.size:
        at_edge = (clean == clean.max()) | (clean == clean.min())
        runs = np.convolve(at_edge.astype(int), np.ones(3, dtype=int), mode='valid') == 3
        extreme = float(np.mean(np.convolve(runs.astype(int), np.ones(3, dtype=int), mode='full')[:clean.size] > 0))
    repeats = float(np.mean(np.diff(clean) == 0)) if clean.size > 1 else 1.0
    peaks = detect_r_peaks(np.nan_to_num(ecg), fs) if len(ecg) else np.array([], dtype=int)
    rr = np.diff(peaks) / fs
    rr_cv = float(np.std(rr) / np.mean(rr)) if len(rr) >= 2 and np.mean(rr) > 0 else float('inf')
    t = QUALITY_THRESHOLDS
    checks = [
        {'name': 'Finite samples', 'measured': float(np.mean(finite)), 'threshold': f">= {t['finite_fraction']}", 'passed': bool(np.mean(finite) >= t['finite_fraction'])},
        {'name': 'Regular timestamps', 'measured': deviation, 'threshold': f"<= {t['timestamp_deviation_fraction']} of intervals off the median by more than 0.1%", 'passed': deviation <= t['timestamp_deviation_fraction']},
        {'name': 'No clipping', 'measured': extreme, 'threshold': f"<= {t['clipping_fraction']} of samples in runs of 3 or more at the window minimum or maximum", 'passed': extreme <= t['clipping_fraction']},
        {'name': 'Not flat or stuck', 'measured': repeats, 'threshold': f"<= {t['adjacent_repeat_fraction']} adjacent repeated values", 'passed': repeats <= t['adjacent_repeat_fraction']},
        {'name': 'Heartbeats detected on ECG', 'measured': float(len(peaks)), 'threshold': f">= {t['min_beats']} beats", 'passed': len(peaks) >= t['min_beats']},
        {'name': 'Plausible heart rhythm regularity', 'measured': rr_cv if np.isfinite(rr_cv) else -1.0, 'threshold': f"RR coefficient of variation <= {t['rr_cv_max']}", 'passed': bool(np.isfinite(rr_cv) and rr_cv <= t['rr_cv_max'])},
    ]
    return checks, all(check['passed'] for check in checks)
