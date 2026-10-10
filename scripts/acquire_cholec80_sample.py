#!/usr/bin/env python3
"""Fetch one licensed Cholec80 MP4 and its official phase track via HTTP ranges.

The upstream ZIP is about 75 GB. This downloader reads its ZIP64 directory and
retrieves only video01 and its phase annotation; it never downloads the archive.
Assets remain local under data/ and are excluded from Git.
"""
from __future__ import annotations

import argparse
import binascii
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import urllib.request
import zlib

ARCHIVE_URL = "https://s3.unistra.fr/camma_public/datasets/cholec80/cholec80.zip"
DATASET_URL = "https://camma.unistra.fr/datasets/"
LICENSE_URL = "https://creativecommons.org/licenses/by-nc-sa/4.0/"
CITATION = (
    "A.P. Twinanda, S. Shehata, D. Mutter, J. Marescaux, M. de Mathelin, "
    "N. Padoy, EndoNet: A Deep Architecture for Recognition Tasks on "
    "Laparoscopic Videos, IEEE Transactions on Medical Imaging 36(1), 2017, "
    "doi:10.1109/TMI.2016.2593957."
)
EXPECTED_ARCHIVE_BYTES = 74_916_858_781
EXPECTED_ARCHIVE_ETAG = '"e860230581a7d8e4ec05d8e711ff8ba1-8931"'
CHUNK_BYTES = 4 * 1024 * 1024


def request_range(url: str, start: int, end: int, total: int) -> bytes:
    request = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}"})
    with urllib.request.urlopen(request, timeout=30) as response:
        content_range = response.headers.get("Content-Range", "")
        if response.status != 206 or not content_range.startswith(f"bytes {start}-{end}/"):
            raise RuntimeError(f"Upstream did not honor exact byte range {start}-{end}: {content_range!r}")
        if not content_range.endswith(f"/{total}"):
            raise RuntimeError(f"Upstream archive size changed: {content_range!r}")
        payload = response.read()
    if len(payload) != end - start + 1:
        raise RuntimeError(f"Incomplete byte range {start}-{end}: got {len(payload)} bytes")
    return payload


def zip64_directory(total: int) -> bytes:
    tail_start = max(0, total - 65_557)
    tail = request_range(ARCHIVE_URL, tail_start, total - 1, total)
    locator_at = tail.rfind(b"PK\x06\x07")
    if locator_at < 0:
        raise RuntimeError("ZIP64 locator is missing")
    _, disk, zip64_offset, disks = struct.unpack_from("<4sIQI", tail, locator_at)
    if disk != 0 or disks != 1:
        raise RuntimeError("Unexpected multi-disk ZIP archive")
    header = request_range(ARCHIVE_URL, zip64_offset, zip64_offset + 55, total)
    fields = struct.unpack_from("<4sQHHIIQQQQ", header)
    _, _, _, _, disk_number, directory_disk, _, entry_count, directory_size, directory_offset = fields
    if disk_number != 0 or directory_disk != 0 or entry_count > 10_000 or directory_size > 16_000_000:
        raise RuntimeError("ZIP64 directory has unexpected bounds")
    return request_range(ARCHIVE_URL, directory_offset, directory_offset + directory_size - 1, total)


def directory_entries(directory: bytes) -> dict[str, dict[str, int]]:
    result: dict[str, dict[str, int]] = {}
    position = 0
    while position < len(directory):
        fields = struct.unpack_from("<4s6H3I5H2I", directory, position)
        signature, _, _, _, method, _, _, crc, compressed, uncompressed, name_len, extra_len, comment_len, _, _, _, local_offset = fields
        if signature != b"PK\x01\x02":
            raise RuntimeError(f"Bad central-directory record at {position}")
        name_at = position + 46
        name = directory[name_at:name_at + name_len].decode("utf-8")
        extra = directory[name_at + name_len:name_at + name_len + extra_len]
        if compressed == 0xFFFFFFFF or uncompressed == 0xFFFFFFFF or local_offset == 0xFFFFFFFF:
            extra_position = 0
            zip64_values: list[int] = []
            while extra_position + 4 <= len(extra):
                tag, length = struct.unpack_from("<HH", extra, extra_position)
                payload = extra[extra_position + 4:extra_position + 4 + length]
                extra_position += 4 + length
                if tag == 1:
                    cursor = 0
                    for missing in (uncompressed == 0xFFFFFFFF, compressed == 0xFFFFFFFF, local_offset == 0xFFFFFFFF):
                        if missing:
                            zip64_values.append(struct.unpack_from("<Q", payload, cursor)[0])
                            cursor += 8
            values = iter(zip64_values)
            uncompressed = next(values) if uncompressed == 0xFFFFFFFF else uncompressed
            compressed = next(values) if compressed == 0xFFFFFFFF else compressed
            local_offset = next(values) if local_offset == 0xFFFFFFFF else local_offset
        result[name] = {"method": method, "crc32": crc, "compressed": compressed, "uncompressed": uncompressed, "offset": local_offset}
        position = name_at + name_len + extra_len + comment_len
    if position != len(directory):
        raise RuntimeError("ZIP64 directory length does not match its records")
    return result


def extract_entry(name: str, info: dict[str, int], total: int, destination: Path) -> dict[str, int | str]:
    if info["method"] != 8:
        raise RuntimeError(f"Unexpected compression method for {name}")
    offset = info["offset"]
    header = request_range(ARCHIVE_URL, offset, offset + 29, total)
    signature, _, flags, method, _, _, _, _, _, name_len, extra_len = struct.unpack("<IHHHHHIIIHH", header)
    if signature != 0x04034B50 or method != 8 or flags & 1:
        raise RuntimeError(f"Unexpected local ZIP header for {name}")
    data_start = offset + 30 + name_len + extra_len
    compressed = info["compressed"]
    decompressor = zlib.decompressobj(-15)
    digest = hashlib.sha256()
    crc = 0
    uncompressed = 0
    temporary = destination.with_suffix(destination.suffix + ".partial")
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with temporary.open("wb") as output:
            cursor = 0
            while cursor < compressed:
                size = min(CHUNK_BYTES, compressed - cursor)
                data = request_range(ARCHIVE_URL, data_start + cursor, data_start + cursor + size - 1, total)
                block = decompressor.decompress(data)
                if block:
                    output.write(block)
                    digest.update(block)
                    crc = binascii.crc32(block, crc)
                    uncompressed += len(block)
                cursor += size
                print(f"{name}: {cursor:,}/{compressed:,} compressed bytes", flush=True)
            block = decompressor.flush()
            if block:
                output.write(block)
                digest.update(block)
                crc = binascii.crc32(block, crc)
                uncompressed += len(block)
            output.flush()
            os.fsync(output.fileno())
        if uncompressed != info["uncompressed"] or (crc & 0xFFFFFFFF) != info["crc32"]:
            raise RuntimeError(f"ZIP size/CRC verification failed for {name}")
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    return {"sha256": digest.hexdigest(), "size_bytes": uncompressed, "crc32": f"{crc & 0xFFFFFFFF:08x}"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "cholec80")
    args = parser.parse_args()
    root = args.root.expanduser().resolve()
    request = urllib.request.Request(ARCHIVE_URL, method="HEAD")
    with urllib.request.urlopen(request, timeout=30) as response:
        total = int(response.headers.get("Content-Length", "0"))
        etag = response.headers.get("ETag", "")
    if total != EXPECTED_ARCHIVE_BYTES:
        raise RuntimeError(f"Pinned Cholec80 archive size changed: expected {EXPECTED_ARCHIVE_BYTES}, got {total}")
    if etag != EXPECTED_ARCHIVE_ETAG:
        raise RuntimeError(f"Pinned Cholec80 archive ETag changed: expected {EXPECTED_ARCHIVE_ETAG}, got {etag!r}")
    free = shutil.disk_usage(root.parent if root.parent.exists() else Path.cwd()).free
    needed = 1_100_000_000
    if free < needed:
        raise RuntimeError(f"Need at least {needed:,} bytes free; only {free:,} available")
    if (root / "medforge-source-manifest.json").exists():
        raise RuntimeError(f"A Cholec80 sample is already installed at {root}; inspect it before replacing")

    entries = directory_entries(zip64_directory(total))
    video_name = "videos/video01.mp4"
    phase_name = "phase_annotations/video01-phase.txt"
    if video_name not in entries or phase_name not in entries:
        raise RuntimeError("Pinned Cholec80 archive does not contain the expected video and phase track")
    video = extract_entry(video_name, entries[video_name], total, root / "video01.mp4")
    phase = extract_entry(phase_name, entries[phase_name], total, root / "video01-phase.txt")

    probe = subprocess.run([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
        "stream=codec_name,width,height,r_frame_rate,nb_frames,duration", "-of", "json", str(root / "video01.mp4"),
    ], capture_output=True, text=True, check=True)
    stream = json.loads(probe.stdout)["streams"][0]
    if stream.get("r_frame_rate") != "25/1" or int(stream.get("width", 0)) < 1 or int(stream.get("height", 0)) < 1:
        raise RuntimeError(f"Unexpected video stream metadata: {stream}")
    manifest = {
        "schema": "medforge.source-manifest.cholect80-single-video.v1",
        "dataset": "Cholec80",
        "clip_id": "cholect80-video01",
        "procedure_label": "Laparoscopic cholecystectomy",
        "archive_url": ARCHIVE_URL,
        "archive_size_bytes": total,
        "archive_etag": etag,
        "dataset_url": DATASET_URL,
        "license": "CC BY-NC-SA 4.0",
        "license_url": LICENSE_URL,
        "citation": CITATION,
        "video_relative_path": "video01.mp4",
        "phase_relative_path": "video01-phase.txt",
        "video_sha256": video["sha256"],
        "video_size_bytes": video["size_bytes"],
        "video_crc32": video["crc32"],
        "phase_sha256": phase["sha256"],
        "phase_size_bytes": phase["size_bytes"],
        "phase_crc32": phase["crc32"],
        "video_duration_seconds": float(stream["duration"]),
        "video_fps": 25,
        "video_frame_count": int(stream["nb_frames"]),
        "video_width": int(stream["width"]),
        "video_height": int(stream["height"]),
        "phase_labels_fps": 25,
        "limitations": [
            "One locally acquired Cholec80 video only; this is not the full dataset.",
            "The displayed phase is the dataset's source label for the exact current frame, not model output or surgical guidance.",
            "Tool-presence labels are sampled at 1 fps and are not shown as continuous-frame labels.",
            "Non-commercial attribution and share-alike terms apply; see the linked source and license.",
        ],
    }
    root.mkdir(parents=True, exist_ok=True)
    (root / "medforge-source-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Cholec80 acquisition failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
