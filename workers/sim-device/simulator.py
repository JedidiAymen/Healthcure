"""SIMULATED acquisition device: publishes ECG and pulse-vibration frames over MQTT.

Signals are generated, not measured. They are not FiSaV data and not patient data. Optional
fault injection (dropped and corrupted frames) exercises the receiver's frame integrity checks.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import random
import sys
import time

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'apps' / 'api'))
from app.telemetry_frames import TOPIC_PREFIX, encode_frame  # noqa: E402


def synthetic_block(t: np.ndarray, bpm: float, rng: np.random.Generator) -> np.ndarray:
    period = 60 / bpm
    phase = np.mod(t, period)
    ecg = 1.2 * np.exp(-((phase - 0.2) ** 2) / (2 * 0.012 ** 2)) - 0.15 * np.exp(-((phase - 0.17) ** 2) / (2 * 0.01 ** 2))
    ecg += 0.25 * np.exp(-((phase - 0.45) ** 2) / (2 * 0.04 ** 2)) + 0.02 * rng.standard_normal(len(t))
    pulse = np.exp(-((phase - 0.32) ** 2) / (2 * 0.05 ** 2)) + 0.4 * np.exp(-((phase - 0.5) ** 2) / (2 * 0.07 ** 2))
    pulse += 0.03 * rng.standard_normal(len(t))
    return np.round(np.vstack([ecg, pulse]) / 1e-3).clip(-32768, 32767).astype(np.int16)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--host', default='mqtt')
    parser.add_argument('--port', type=int, default=1883)
    parser.add_argument('--device-id', default='sim-wrist-01')
    parser.add_argument('--fs', type=int, default=2000)
    parser.add_argument('--frame-ms', type=int, default=100)
    parser.add_argument('--bpm', type=float, default=72)
    parser.add_argument('--drop-rate', type=float, default=0.01, help='fraction of frames deliberately not sent')
    parser.add_argument('--corrupt-rate', type=float, default=0.005, help='fraction of frames sent with a broken CRC')
    args = parser.parse_args()

    import paho.mqtt.client as mqtt
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f'medforge-sim-{args.device_id}')
    client.connect(args.host, args.port, keepalive=30)
    client.loop_start()
    rng, chooser = np.random.default_rng(7), random.Random(7)
    count = args.fs * args.frame_ms // 1000
    topic = f'{TOPIC_PREFIX}{args.device_id}/frames'
    start, seq = time.time(), 0
    print(f'Publishing SIMULATED frames to {topic} at {args.fs} Hz', flush=True)
    while True:
        t = seq * count / args.fs + np.arange(count) / args.fs
        frame = encode_frame(seq, int((start + t[0]) * 1e6), args.fs, synthetic_block(t, args.bpm, rng))
        roll = chooser.random()
        if roll >= args.drop_rate:
            if roll < args.drop_rate + args.corrupt_rate:
                frame = frame[:-1] + bytes([frame[-1] ^ 0xFF])
            client.publish(topic, frame, qos=0)
        seq += 1
        time.sleep(max(0.0, start + seq * args.frame_ms / 1000 - time.time()))


if __name__ == '__main__':
    main()
