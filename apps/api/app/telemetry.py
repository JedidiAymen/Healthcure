"""Telemetry from a SIMULATED acquisition device over MQTT, with measurement-frame integrity checks.

The simulator (workers/sim-device) publishes compact binary frames. Each frame carries a magic
number, version, sequence number, microsecond timestamp, sample rate and int16 samples, followed by
a CRC32 over everything before it. The API verifies every frame and counts CRC failures, sequence
gaps and out-of-order frames, so integrity problems are visible instead of silently smoothed.

Everything here is labelled simulated: it is not FiSaV data, not patient data, and no model is
applied to it. State is kept in memory for the local demo.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
import os
import threading

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, ConfigDict

from .signal_processing import detect_r_peaks, envelope
from .telemetry_frames import CHANNELS, SCALE, TOPIC_PREFIX, FrameError, decode_frame, encode_frame  # noqa: F401

LABEL = 'SIMULATED DEVICE: synthetic signals, not FiSaV, not patient data, no model applied.'


@dataclass
class DeviceState:
    device_id: str
    fs_hz: int = 0
    frames_received: int = 0
    crc_failures: int = 0
    malformed: int = 0
    missing_frames: int = 0
    out_of_order: int = 0
    last_seq: int | None = None
    last_seen: str | None = None
    times: deque = field(default_factory=lambda: deque(maxlen=2000 * 30))
    values: list = field(default_factory=lambda: [deque(maxlen=2000 * 30) for _ in CHANNELS])

    def ingest(self, payload: bytes) -> None:
        try:
            frame = decode_frame(payload)
        except FrameError as error:
            if 'CRC32' in str(error):
                self.crc_failures += 1
            else:
                self.malformed += 1
            return
        if self.last_seq is not None:
            if frame.seq <= self.last_seq:
                self.out_of_order += 1
                return
            self.missing_frames += frame.seq - self.last_seq - 1
        self.last_seq, self.fs_hz = frame.seq, frame.fs_hz
        self.frames_received += 1
        self.last_seen = datetime.now(timezone.utc).isoformat()
        count = frame.samples.shape[1]
        self.times.extend(frame.t0_us / 1e6 + np.arange(count) / frame.fs_hz)
        for channel, buffer in enumerate(self.values):
            buffer.extend(frame.samples[channel] * SCALE)


class TelemetryHub:
    def __init__(self) -> None:
        self.devices: dict[str, DeviceState] = {}
        self.lock = threading.Lock()
        self.broker: str | None = None
        self.connected = False

    def ingest(self, topic: str, payload: bytes) -> None:
        parts = topic.split('/')
        if not topic.startswith(TOPIC_PREFIX) or len(parts) != 4 or parts[3] != 'frames':
            return
        with self.lock:
            self.devices.setdefault(parts[2], DeviceState(parts[2])).ingest(payload)

    def start_mqtt(self, host: str, port: int = 1883) -> None:
        import paho.mqtt.client as mqtt
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id='medforge-api-telemetry')

        def on_connect(c, userdata, flags, reason_code, properties):
            self.connected = not reason_code.is_failure
            c.subscribe(TOPIC_PREFIX + '+/frames', qos=0)

        def on_disconnect(c, userdata, flags, reason_code, properties):
            self.connected = False

        client.on_connect, client.on_disconnect = on_connect, on_disconnect
        client.on_message = lambda c, userdata, message: self.ingest(message.topic, message.payload)
        self.broker = f'{host}:{port}'
        client.connect_async(host, port, keepalive=30)
        client.loop_start()


class TelemetryIntegrity(BaseModel):
    model_config = ConfigDict(extra='forbid')
    frames_received: int
    crc_failures: int
    malformed: int
    missing_frames: int
    out_of_order: int
    integrity_ok: bool


class TelemetryDevice(BaseModel):
    model_config = ConfigDict(extra='forbid')
    device_id: str
    simulated: bool
    label: str
    sample_rate_hz: int
    last_seen: str | None
    integrity: TelemetryIntegrity


class TelemetryStatus(BaseModel):
    model_config = ConfigDict(extra='forbid')
    broker: str | None
    connected: bool
    devices: list[TelemetryDevice]
    label: str


class TelemetryWindow(BaseModel):
    model_config = ConfigDict(extra='forbid')
    device_id: str
    label: str
    channels: list[str]
    time_sec: list[list[float]]
    values: list[list[float]]
    seconds: float
    heart_rate_bpm: float | None
    heart_rate_method: str
    integrity: TelemetryIntegrity


def _integrity(state: DeviceState) -> TelemetryIntegrity:
    return TelemetryIntegrity(frames_received=state.frames_received, crc_failures=state.crc_failures, malformed=state.malformed,
                              missing_frames=state.missing_frames, out_of_order=state.out_of_order,
                              integrity_ok=state.crc_failures == state.malformed == state.missing_frames == state.out_of_order == 0)


def register_telemetry_routes(app: FastAPI, hub: TelemetryHub) -> None:
    app.state.telemetry = hub
    host = os.environ.get('MEDFORGE_MQTT_HOST', '').strip()
    if host:
        hub.start_mqtt(host, int(os.environ.get('MEDFORGE_MQTT_PORT', '1883')))

    @app.get('/api/v1/telemetry/devices', response_model=TelemetryStatus)
    def telemetry_devices():
        with hub.lock:
            devices = [TelemetryDevice(device_id=s.device_id, simulated=True, label=LABEL, sample_rate_hz=s.fs_hz,
                                       last_seen=s.last_seen, integrity=_integrity(s)) for s in hub.devices.values()]
        return TelemetryStatus(broker=hub.broker, connected=hub.connected, devices=devices, label=LABEL)

    @app.get('/api/v1/telemetry/devices/{device_id}/window', response_model=TelemetryWindow)
    def telemetry_window(device_id: str, seconds: float = Query(5, gt=0, le=30)):
        with hub.lock:
            state = hub.devices.get(device_id)
            if state is None or not state.times:
                raise HTTPException(404, detail={'code': 'DEVICE_NOT_STREAMING', 'message': 'No frames received from this simulated device'})
            times = np.array(state.times)
            values = [np.array(buffer) for buffer in state.values]
            fs, integrity = state.fs_hz, _integrity(state)
        keep = times >= times[-1] - seconds
        traces = [envelope(times[keep], channel[keep]) for channel in values]
        peaks = detect_r_peaks(values[0][keep], fs) if fs else np.array([])
        rate = float(60 * fs / np.median(np.diff(peaks))) if len(peaks) >= 3 else None
        return TelemetryWindow(device_id=device_id, label=LABEL, channels=list(CHANNELS), seconds=seconds,
                               time_sec=[t for t, _ in traces], values=[v for _, v in traces], heart_rate_bpm=rate,
                               heart_rate_method='Rule-based R-peak detector on the simulated ECG channel (same method as FistulaGuard).',
                               integrity=integrity)
