"""Binary measurement-frame codec shared by the simulated device and the API (numpy, struct, zlib only).

Layout: magic b'MFS1', version, sequence number, microsecond timestamp, sample rate, samples per
channel, channel count, int16 little-endian samples, then a CRC32 over everything before it.
"""
from __future__ import annotations

from dataclasses import dataclass
import struct
import zlib

import numpy as np

MAGIC = b'MFS1'
VERSION = 1
HEADER = struct.Struct('<4sHIQHHB')  # magic, version, seq, t0_us, fs_hz, samples_per_channel, channels
CHANNELS = ('ECG (simulated)', 'Pulse vibration (simulated)')
SCALE = 1e-3  # int16 counts to arbitrary simulated units
TOPIC_PREFIX = 'medforge/sim/'


class FrameError(ValueError):
    pass


@dataclass(frozen=True)
class Frame:
    seq: int
    t0_us: int
    fs_hz: int
    samples: np.ndarray  # shape (channels, n)


def encode_frame(seq: int, t0_us: int, fs_hz: int, samples: np.ndarray) -> bytes:
    channels, count = samples.shape
    body = HEADER.pack(MAGIC, VERSION, seq, t0_us, fs_hz, count, channels) + np.asarray(samples, dtype='<i2').tobytes(order='C')
    return body + struct.pack('<I', zlib.crc32(body))


def decode_frame(payload: bytes) -> Frame:
    if len(payload) < HEADER.size + 4:
        raise FrameError('frame shorter than its header')
    body, (crc,) = payload[:-4], struct.unpack('<I', payload[-4:])
    if zlib.crc32(body) != crc:
        raise FrameError('CRC32 mismatch')
    magic, version, seq, t0_us, fs_hz, count, channels = HEADER.unpack_from(body)
    if magic != MAGIC or version != VERSION:
        raise FrameError('unknown frame magic or version')
    expected = HEADER.size + count * channels * 2
    if len(body) != expected or channels != len(CHANNELS) or fs_hz <= 0:
        raise FrameError('frame length or layout does not match its header')
    samples = np.frombuffer(body, dtype='<i2', offset=HEADER.size).reshape(channels, count)
    return Frame(seq, t0_us, fs_hz, samples)


