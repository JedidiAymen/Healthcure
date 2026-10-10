"""FistulaGuard teaching routes: filtered windows, ECG beat analysis, occlusion-test marker, educator annotations.

All outputs describe measured FiSaV source windows. Sensor units are uncalibrated, so amplitudes
are not comparable across recordings, and nothing here is a stenosis classifier.
"""
from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from typing import Callable, Literal
import uuid

import numpy as np
from fastapi import Depends, FastAPI, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field

from . import fisav
from . import audit
from .auth import require_role
from .signal_processing import FILTER_ORDER, FilterSpec, apply_filter, beat_features, detect_r_peaks, envelope, marker_intervals, quality_checks

CHANNEL_PATTERN = '^(ECG|raw PZT1|raw PZT2|raw PZT3|raw PZT4)$'
PAD_SEC = 0.5
UNCALIBRATED = 'Sensor units are uncalibrated; compare shapes and timing within one recording, not amplitudes across recordings.'
OCCLUSION_MEANING = ('Protocol marker for the occlusion test performed during this recording '
                     '(FiSaV patient sheet: OCCLUSION TEST). It is not a stenosis label or a diagnosis.')


class _Model(BaseModel):
    model_config = ConfigDict(extra='forbid')


class SignalTrace(_Model):
    time_sec: list[float]
    values: list[float]


class SignalFilterParameters(_Model):
    mode: Literal['bandpass', 'notch']
    low_hz: float | None
    high_hz: float | None
    notch_hz: float | None
    q: float | None
    order: int
    method: str


class SignalFilterResult(_Model):
    record_id: str
    channel: str
    start_sec: float
    duration_sec: float
    sample_rate_hz: float
    source_sha256: str
    filter: SignalFilterParameters
    raw: SignalTrace
    filtered: SignalTrace
    limitations: list[str]


class HeartRateSummary(_Model):
    mean: float | None
    min: float | None
    max: float | None


class BeatMeasurement(_Model):
    index: int
    r_peak_sec: float
    rr_sec: float | None
    peak_to_peak: float | None
    rms: float | None


class EnsembleAverage(_Model):
    time_sec: list[float]
    mean: list[float]
    sd: list[float]
    beats_used: int


class OcclusionTestMarker(_Model):
    intervals: list[list[float]]
    overlaps_window: bool
    meaning: str


class BeatAnalysis(_Model):
    record_id: str
    channel: str
    start_sec: float
    duration_sec: float
    source_sha256: str
    r_peaks_sec: list[float]
    heart_rate_bpm: HeartRateSummary
    beats: list[BeatMeasurement]
    ensemble: EnsembleAverage
    occlusion_test: OcclusionTestMarker
    method: str
    limitations: list[str]


class QualityCheck(_Model):
    name: str
    measured: float
    threshold: str
    passed: bool


class SignalQuality(_Model):
    record_id: str
    channel: str
    start_sec: float
    duration_sec: float
    source_sha256: str
    usable: bool
    status: Literal['usable', 'insufficient quality, not scored']
    checks: list[QualityCheck]
    provenance_kind: Literal['RULE_BASED_METHOD'] = 'RULE_BASED_METHOD'
    limitations: list[str]


class SignalAnnotationCreate(_Model):
    channel: str = Field(pattern=CHANNEL_PATTERN)
    start_sec: float = Field(ge=0)
    end_sec: float = Field(gt=0)
    label: str = Field(min_length=1, max_length=200)
    note: str = Field(default='', max_length=2000)


class SignalAnnotation(SignalAnnotationCreate):
    id: str
    record_id: str
    source_sha256: str
    created_at: str


def _loaded(record_id: str):
    loaded = fisav.record(record_id)
    if loaded is None:
        raise HTTPException(404, detail={'code': 'FISAV_RECORD_NOT_INSTALLED', 'message': 'No verified local FiSaV recording matches this ID'})
    return loaded


def _check_window(values: np.ndarray, fs: float, start_sec: float, duration_sec: float) -> None:
    duration = float(values[-1, 0] - values[0, 0])
    if start_sec + duration_sec > duration + 1 / fs:
        raise HTTPException(422, detail={'code': 'WINDOW_OUT_OF_RANGE', 'message': f'Requested window exceeds the {duration:.2f} second source recording'})


@lru_cache(maxsize=8)
def _occlusion_intervals(path_text: str, size: int, modified_ns: int) -> tuple[tuple[float, float], ...]:
    del size, modified_ns  # Cache key only: a changed file is re-read.
    data = np.loadtxt(path_text, delimiter=',', skiprows=1, usecols=(0, 6), dtype=np.float64)
    return tuple(tuple(item) for item in marker_intervals(data[:, 0], data[:, 1]))


def occlusion_intervals(record_id: str) -> list[list[float]]:
    located = fisav._record_entry(record_id)
    if located is None:
        return []
    root, entry = located
    path = (root / entry['file_name']).resolve()
    try:
        stat = path.stat()
        return [list(item) for item in _occlusion_intervals(str(path), stat.st_size, stat.st_mtime_ns)]
    except (OSError, ValueError, IndexError):
        return []


def register_fistulaguard_tool_routes(app: FastAPI, db: Callable) -> None:
    educator = require_role('educator')

    @app.get('/api/v1/fistulaguard/records/{record_id}/filtered', response_model=SignalFilterResult)
    def fistulaguard_filtered(record_id: str, channel: str = Query('raw PZT1', pattern=CHANNEL_PATTERN),
                              start_sec: float = Query(0, ge=0), duration_sec: float = Query(2, gt=0, le=20),
                              mode: Literal['bandpass', 'notch'] = 'bandpass',
                              low_hz: float | None = Query(None, gt=0), high_hz: float | None = Query(None, gt=0),
                              notch_hz: float | None = Query(None, gt=0), q: float = Query(30, gt=0, le=200)):
        values, fs, digest = _loaded(record_id)
        _check_window(values, fs, start_sec, duration_sec)
        spec = FilterSpec(mode=mode, low_hz=low_hz, high_hz=high_hz, notch_hz=notch_hz, q=q)
        try:
            spec.validate(fs)
        except ValueError as error:
            raise HTTPException(422, detail={'code': 'FILTER_INVALID', 'message': str(error)}) from error
        times = values[:, 0]
        column = fisav.CHANNEL_INDEX[channel]
        # Filter a padded span, then crop, so edge transients stay outside the shown window.
        padded = np.flatnonzero((times >= start_sec - PAD_SEC) & (times < start_sec + duration_sec + PAD_SEC))
        filtered_all = apply_filter(values[padded, column], fs, spec)
        inside = (times[padded] >= start_sec) & (times[padded] < start_sec + duration_sec)
        window_times, raw_values, filtered_values = times[padded][inside], values[padded, column][inside], filtered_all[inside]
        raw_t, raw_v = envelope(window_times, raw_values)
        filt_t, filt_v = envelope(window_times, filtered_values)
        return SignalFilterResult(
            record_id=record_id, channel=channel, start_sec=start_sec, duration_sec=duration_sec, sample_rate_hz=fs, source_sha256=digest,
            filter=SignalFilterParameters(mode=mode, low_hz=low_hz if mode == 'bandpass' else None, high_hz=high_hz if mode == 'bandpass' else None,
                                          notch_hz=notch_hz if mode == 'notch' else None, q=q if mode == 'notch' else None,
                                          order=FILTER_ORDER, method=spec.method),
            raw=SignalTrace(time_sec=raw_t, values=raw_v), filtered=SignalTrace(time_sec=filt_t, values=filt_v),
            limitations=[UNCALIBRATED, 'Filtering changes what is shown; the source file is never modified.'],
        )

    @app.get('/api/v1/fistulaguard/records/{record_id}/beats', response_model=BeatAnalysis)
    def fistulaguard_beats(record_id: str, channel: str = Query('raw PZT1', pattern=CHANNEL_PATTERN),
                           start_sec: float = Query(0, ge=0), duration_sec: float = Query(10, ge=2, le=30)):
        values, fs, digest = _loaded(record_id)
        _check_window(values, fs, start_sec, duration_sec)
        times = values[:, 0]
        indices = np.flatnonzero((times >= start_sec) & (times < start_sec + duration_sec))
        ecg = values[indices, fisav.CHANNEL_INDEX['ECG']]
        peaks = detect_r_peaks(ecg, fs)
        beats, ensemble = beat_features(values[indices, fisav.CHANNEL_INDEX[channel]], peaks, fs)
        rr = [beat['rr_sec'] for beat in beats if beat['rr_sec']]
        rates = [60 / value for value in rr]
        intervals = occlusion_intervals(record_id)
        window_end = start_sec + duration_sec
        return BeatAnalysis(
            record_id=record_id, channel=channel, start_sec=start_sec, duration_sec=duration_sec, source_sha256=digest,
            r_peaks_sec=[float(times[indices[p]]) for p in peaks],
            heart_rate_bpm=HeartRateSummary(mean=float(np.mean(rates)) if rates else None, min=min(rates) if rates else None, max=max(rates) if rates else None),
            beats=[BeatMeasurement(index=beat['index'], r_peak_sec=float(times[indices[beat['sample']]]), rr_sec=beat['rr_sec'],
                                   peak_to_peak=beat['peak_to_peak'], rms=beat['rms']) for beat in beats],
            ensemble=EnsembleAverage(**ensemble),
            occlusion_test=OcclusionTestMarker(intervals=intervals, overlaps_window=any(a < window_end and b > start_sec for a, b in intervals), meaning=OCCLUSION_MEANING),
            method='R peaks from the concurrent ECG lead: 5 to 20 Hz band-pass, derivative, squaring, 120 ms moving integration, peaks at least 300 ms apart. Beat windows run from 200 ms before to 600 ms after each R peak.',
            limitations=[UNCALIBRATED, 'Automatic beat detection can miss or add beats in noisy windows; check the marked peaks against the trace.',
                         'Heart rate here describes this window only and is not a clinical measurement.'],
        )

    @app.get('/api/v1/fistulaguard/records/{record_id}/quality', response_model=SignalQuality)
    def fistulaguard_quality(record_id: str, channel: str = Query('raw PZT1', pattern=CHANNEL_PATTERN),
                             start_sec: float = Query(0, ge=0), duration_sec: float = Query(10, ge=2, le=30)):
        values, fs, digest = _loaded(record_id)
        _check_window(values, fs, start_sec, duration_sec)
        times = values[:, 0]
        indices = np.flatnonzero((times >= start_sec) & (times < start_sec + duration_sec))
        checks, usable = quality_checks(times[indices], values[indices, fisav.CHANNEL_INDEX[channel]], values[indices, fisav.CHANNEL_INDEX['ECG']], fs)
        return SignalQuality(record_id=record_id, channel=channel, start_sec=start_sec, duration_sec=duration_sec, source_sha256=digest,
                             usable=usable, status='usable' if usable else 'insufficient quality, not scored', checks=checks,
                             limitations=[UNCALIBRATED, 'These are signal-quality checks, not a clinical adequacy grade. Any future index must abstain when a check fails.'])

    @app.get('/api/v1/fistulaguard/records/{record_id}/annotations', response_model=list[SignalAnnotation])
    def fistulaguard_annotations(record_id: str, user: dict = Depends(educator)):
        with db() as conn:
            rows = conn.execute('''SELECT id,record_id,source_sha256,channel,start_sec,end_sec,label,note,created_at
                FROM signal_annotations WHERE created_by=? AND record_id=? ORDER BY start_sec,created_at''', (user['id'], record_id)).fetchall()
        return [SignalAnnotation(id=r[0], record_id=r[1], source_sha256=r[2], channel=r[3], start_sec=r[4], end_sec=r[5], label=r[6], note=r[7], created_at=r[8]) for r in rows]

    @app.post('/api/v1/fistulaguard/records/{record_id}/annotations', response_model=SignalAnnotation, status_code=201)
    def fistulaguard_annotation_create(record_id: str, request: SignalAnnotationCreate, user: dict = Depends(educator)):
        values, fs, digest = _loaded(record_id)
        if request.end_sec <= request.start_sec:
            raise HTTPException(422, detail={'code': 'ANNOTATION_WINDOW_INVALID', 'message': 'The annotation must end after it starts'})
        _check_window(values, fs, request.start_sec, request.end_sec - request.start_sec)
        annotation = SignalAnnotation(**request.model_dump(), id=f'ann_{uuid.uuid4().hex}', record_id=record_id, source_sha256=digest,
                                      created_at=datetime.now(timezone.utc).isoformat())
        with db() as conn:
            conn.execute('''INSERT INTO signal_annotations(id,record_id,source_sha256,channel,start_sec,end_sec,label,note,created_by,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)''', (annotation.id, record_id, digest, annotation.channel, annotation.start_sec, annotation.end_sec,
                                                   annotation.label, annotation.note, user['id'], annotation.created_at))
            audit.append(conn, action='signal_annotation.create', target_kind='signal_annotation', target_id=annotation.id, actor=user,
                         owner_id=user['id'], details={'record_id': record_id, 'source_sha256': digest,
                                                       'window': [annotation.start_sec, annotation.end_sec], 'channel': annotation.channel})
        return annotation

    @app.delete('/api/v1/fistulaguard/annotations/{annotation_id}', status_code=204)
    def fistulaguard_annotation_delete(annotation_id: str, user: dict = Depends(educator)):
        with db() as conn:
            deleted = conn.execute('DELETE FROM signal_annotations WHERE id=? AND created_by=?', (annotation_id, user['id'])).rowcount
            if deleted:
                audit.append(conn, action='signal_annotation.delete', target_kind='signal_annotation', target_id=annotation_id,
                             actor=user, owner_id=user['id'])
        if not deleted:
            raise HTTPException(404, detail={'code': 'ANNOTATION_NOT_FOUND', 'message': 'No annotation of yours matches this ID'})
        return Response(status_code=204)
