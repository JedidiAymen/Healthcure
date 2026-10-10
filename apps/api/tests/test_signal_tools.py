"""FistulaGuard teaching tools on visibly synthetic signals: filters, ECG beats, occlusion marker, annotations."""
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np
from fastapi.testclient import TestClient
import pytest

from app import signal_processing as sp
from app.main import create_app
from helpers import auth_headers

FS = 10_000.0


def _tone(freq: float, seconds: float = 2.0) -> np.ndarray:
    t = np.arange(int(seconds * FS)) / FS
    return np.sin(2 * np.pi * freq * t)


def _band_power(signal: np.ndarray, freq: float) -> float:
    spectrum = np.abs(np.fft.rfft(signal * np.hanning(len(signal))))
    freqs = np.fft.rfftfreq(len(signal), 1 / FS)
    return float(spectrum[np.argmin(np.abs(freqs - freq))])


def _synthetic_ecg(seconds: float, bpm: float) -> np.ndarray:
    t = np.arange(int(seconds * FS)) / FS
    ecg = 0.02 * np.random.default_rng(7).standard_normal(len(t))
    for beat in np.arange(0.3, seconds, 60 / bpm):
        ecg += np.exp(-((t - beat) ** 2) / (2 * 0.008 ** 2))
    return ecg


def test_bandpass_keeps_the_passband_and_attenuates_outside_it():
    mixed = _tone(5) + _tone(200)
    filtered = sp.apply_filter(mixed, FS, sp.FilterSpec(mode='bandpass', low_hz=50, high_hz=500))
    assert _band_power(filtered, 200) / _band_power(mixed, 200) > 0.9
    assert _band_power(filtered, 5) / _band_power(mixed, 5) < 0.05


def test_notch_removes_mains_hum_and_keeps_neighbours():
    mixed = _tone(50) + _tone(120)
    filtered = sp.apply_filter(mixed, FS, sp.FilterSpec(mode='notch', notch_hz=50, q=30))
    assert _band_power(filtered, 50) / _band_power(mixed, 50) < 0.05
    assert _band_power(filtered, 120) / _band_power(mixed, 120) > 0.9


def test_filter_parameters_are_validated():
    with pytest.raises(ValueError, match='low'):
        sp.FilterSpec(mode='bandpass', low_hz=500, high_hz=50).validate(FS)
    with pytest.raises(ValueError, match='Nyquist'):
        sp.FilterSpec(mode='bandpass', low_hz=10, high_hz=6000).validate(FS)
    with pytest.raises(ValueError, match='notch'):
        sp.FilterSpec(mode='notch', notch_hz=0).validate(FS)


def test_r_peak_detection_recovers_a_known_heart_rate():
    ecg = _synthetic_ecg(10, 75)
    peaks = sp.detect_r_peaks(ecg, FS)
    assert len(peaks) == 13
    rr = np.diff(peaks) / FS
    assert np.allclose(rr, 0.8, atol=0.002)


def test_beat_features_measure_each_beat_on_another_channel():
    seconds, bpm = 6, 60
    ecg = _synthetic_ecg(seconds, bpm)
    t = np.arange(int(seconds * FS)) / FS
    channel = np.zeros_like(t)
    for number, beat in enumerate(np.arange(0.3, seconds, 1.0)):
        channel += (number + 1) * np.exp(-((t - beat - 0.1) ** 2) / (2 * 0.02 ** 2))
    peaks = sp.detect_r_peaks(ecg, FS)
    beats, ensemble = sp.beat_features(channel, peaks, FS)
    complete = [beat for beat in beats if beat['peak_to_peak'] is not None]
    assert [round(beat['peak_to_peak']) for beat in complete] == list(range(1, len(complete) + 1))
    assert len(ensemble['time_sec']) == len(ensemble['mean']) <= 400


def _synthetic_record(root: Path) -> None:
    seconds = 8
    t = np.arange(int(seconds * FS)) / FS
    ecg = _synthetic_ecg(seconds, 75)
    pzt1 = np.sin(2 * np.pi * 200 * t) + 0.5 * np.sin(2 * np.pi * 50 * t)
    occlusion = ((t >= 3) & (t < 5)).astype(int)
    rows = ['Time,ECG,raw PZT1,raw PZT2,raw PZT3,raw PZT4,Occlusion']
    rows += [f'{t[i]:.4f},{ecg[i]:.6f},{pzt1[i]:.6f},0.1,0.2,0,{occlusion[i]}' for i in range(len(t))]
    payload = ('\n'.join(rows) + '\n').encode()
    (root / 'pat001.csv').write_bytes(payload)
    record = {'file_name': 'pat001.csv', 'uncompressed_bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}
    (root / 'medforge-source-manifest.json').write_text(json.dumps({
        'dataset_doi': '10.17605/OSF.IO/HYPFR', 'license': 'CC BY 4.0', 'sample_file': record, 'records': [record]}), encoding='utf8')


@pytest.fixture(scope='module')
def fisav_root(tmp_path_factory):
    root = tmp_path_factory.mktemp('fisav-synthetic')
    _synthetic_record(root)
    return root


@pytest.fixture
def client(monkeypatch, tmp_path, fisav_root):
    monkeypatch.setenv('MEDFORGE_FISAV_ROOT', str(fisav_root))
    monkeypatch.delenv('MEDFORGE_OPENKBP_CASE_DIR', raising=False)
    monkeypatch.delenv('MEDFORGE_ENDOSCAPES_ROOT', raising=False)
    monkeypatch.setenv('MEDFORGE_DB_PATH', str(tmp_path / 'signals.sqlite3'))
    return TestClient(create_app())


BASE = '/api/v1/fistulaguard/records/pat001'


def test_filtered_window_returns_raw_and_filtered_traces_with_visible_parameters(client):
    response = client.get(f'{BASE}/filtered', params={'channel': 'raw PZT1', 'start_sec': 1, 'duration_sec': 2, 'mode': 'notch', 'notch_hz': 50, 'q': 30})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body['filter'] == {'mode': 'notch', 'low_hz': None, 'high_hz': None, 'notch_hz': 50.0, 'q': 30.0, 'order': 4,
                              'method': 'IIR notch, applied forward and backward (zero phase)'}
    assert len(body['raw']['values']) <= 2000 and len(body['filtered']['values']) <= 2000
    assert body['raw']['time_sec'][0] >= 1 and body['raw']['time_sec'][-1] < 3
    assert max(abs(v) for v in body['filtered']['values']) < max(abs(v) for v in body['raw']['values'])
    assert body['source_sha256'] and any('uncalibrated' in note for note in body['limitations'])
    assert client.get(f'{BASE}/filtered', params={'channel': 'raw PZT1', 'start_sec': 0, 'duration_sec': 2, 'mode': 'bandpass', 'low_hz': 500, 'high_hz': 50}).status_code == 422
    assert client.get(f'{BASE}/filtered', params={'channel': 'raw PZT1', 'start_sec': 0, 'duration_sec': 60, 'mode': 'notch', 'notch_hz': 50}).status_code == 422


def test_beats_endpoint_detects_ecg_beats_and_reports_occlusion_overlap(client):
    body = client.get(f'{BASE}/beats', params={'channel': 'raw PZT1', 'start_sec': 0, 'duration_sec': 8}).json()
    assert body['heart_rate_bpm']['mean'] == pytest.approx(75, abs=1)
    assert len(body['r_peaks_sec']) == 10
    assert body['beats'][0]['rr_sec'] is None and body['beats'][1]['rr_sec'] == pytest.approx(0.8, abs=0.002)
    assert body['occlusion_test']['intervals'] == [[3.0, 5.0]]
    assert body['occlusion_test']['overlaps_window'] is True
    assert 'not a stenosis label' in body['occlusion_test']['meaning']
    quiet = client.get(f'{BASE}/beats', params={'channel': 'raw PZT1', 'start_sec': 5.5, 'duration_sec': 2}).json()
    assert quiet['occlusion_test']['overlaps_window'] is False


def test_educator_annotations_keep_source_hash_and_window(client):
    educator = auth_headers(client, 'teacher', 'educator')
    student = auth_headers(client, 'learner', 'student')
    payload = {'channel': 'raw PZT1', 'start_sec': 3.0, 'end_sec': 5.0, 'label': 'Occlusion test window', 'note': 'Compare the PSD before and during.'}
    assert client.post(f'{BASE}/annotations', json=payload).status_code == 401
    assert client.post(f'{BASE}/annotations', json=payload, headers=student).status_code == 403
    created = client.post(f'{BASE}/annotations', json=payload, headers=educator)
    assert created.status_code == 201, created.text
    annotation = created.json()
    assert annotation['source_sha256'] and annotation['record_id'] == 'pat001' and annotation['end_sec'] == 5.0
    assert client.post(f'{BASE}/annotations', json={**payload, 'end_sec': 2.0}, headers=educator).status_code == 422
    assert client.post(f'{BASE}/annotations', json={**payload, 'end_sec': 99.0}, headers=educator).status_code == 422
    listed = client.get(f'{BASE}/annotations', headers=educator).json()
    assert [item['id'] for item in listed] == [annotation['id']]
    other = auth_headers(client, 'other-teacher', 'educator')
    assert client.get(f'{BASE}/annotations', headers=other).json() == []
    assert client.delete(f"/api/v1/fistulaguard/annotations/{annotation['id']}", headers=other).status_code == 404
    assert client.delete(f"/api/v1/fistulaguard/annotations/{annotation['id']}", headers=educator).status_code == 204
    assert client.get(f'{BASE}/annotations', headers=educator).json() == []
