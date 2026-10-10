"""Simulated-device telemetry: frame codec, CRC and sequence integrity, and the live window API."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import telemetry
from app.main import create_app

FS = 2000


def _frame(seq, t0=0.0):
    t = t0 + seq * 0.1 + np.arange(200) / FS
    sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'workers' / 'sim-device'))
    import simulator
    return telemetry.encode_frame(seq, int(t[0] * 1e6), FS, simulator.synthetic_block(t, 72, np.random.default_rng(seq)))


def test_frame_roundtrip_and_crc_detection():
    payload = _frame(3)
    frame = telemetry.decode_frame(payload)
    assert frame.seq == 3 and frame.fs_hz == FS and frame.samples.shape == (2, 200)
    with pytest.raises(telemetry.FrameError, match='CRC32'):
        telemetry.decode_frame(payload[:-1] + bytes([payload[-1] ^ 0xFF]))
    with pytest.raises(telemetry.FrameError):
        telemetry.decode_frame(b'short')


def test_device_state_counts_gaps_out_of_order_and_crc_failures():
    state = telemetry.DeviceState('sim-1')
    for seq in (0, 1, 2, 5, 4):
        state.ingest(_frame(seq))
    broken = _frame(6)
    state.ingest(broken[:-1] + bytes([broken[-1] ^ 1]))
    assert state.frames_received == 4 and state.missing_frames == 2 and state.out_of_order == 1 and state.crc_failures == 1


def test_window_api_reports_simulated_label_heart_rate_and_integrity(monkeypatch, tmp_path):
    monkeypatch.delenv('MEDFORGE_MQTT_HOST', raising=False)
    monkeypatch.delenv('MEDFORGE_OPENKBP_CASE_DIR', raising=False)
    monkeypatch.setenv('MEDFORGE_DB_PATH', str(tmp_path / 'telemetry.sqlite3'))
    app = create_app()
    hub = app.state.telemetry
    for seq in range(80):
        hub.ingest('medforge/sim/sim-wrist-01/frames', _frame(seq))
    hub.ingest('not/a/medforge/topic', _frame(81))
    client = TestClient(app)
    status = client.get('/api/v1/telemetry/devices').json()
    assert [d['device_id'] for d in status['devices']] == ['sim-wrist-01']
    assert status['devices'][0]['simulated'] is True and 'not patient data' in status['label']
    window = client.get('/api/v1/telemetry/devices/sim-wrist-01/window?seconds=6').json()
    assert window['integrity']['integrity_ok'] is True and window['integrity']['frames_received'] == 80
    assert window['heart_rate_bpm'] == pytest.approx(72, abs=2)
    assert client.get('/api/v1/telemetry/devices/unknown/window').status_code == 404
