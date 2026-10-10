#!/usr/bin/env python3
"""Acquire the upstream research checkpoint with validated HTTP byte ranges."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import math
import os
import re
import shutil
import time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
URL = "https://seafile.unistra.fr/f/10bad1a5ee2642e3be49/?dl=1"
DESTINATION = ROOT / "data/models/cvs-adaptnet/CVSAdaptNet.pth"
PARTIAL = DESTINATION.with_suffix(".pth.partial")
CHUNKS = DESTINATION.parent / ".chunks"
EXPECTED_SIZE = 1_596_737_924
CHUNK_COUNT = 8


def ranged_get(start: int, end: int, path: Path, resume: int = 0) -> None:
    first = start + resume
    request = Request(URL, headers={"Range": f"bytes={first}-{end}"})
    for attempt in range(4):
        try:
            with urlopen(request, timeout=90) as response:
                if response.status != 206:
                    raise RuntimeError(f"Expected HTTP 206, received {response.status}")
                content_range = response.headers.get("Content-Range", "")
                match = re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)", content_range)
                if not match or tuple(map(int, match.groups())) != (first, end, EXPECTED_SIZE):
                    raise RuntimeError(f"Unexpected Content-Range: {content_range!r}")
                mode = "ab" if resume else "wb"
                with path.open(mode) as output:
                    shutil.copyfileobj(response, output, length=1024 * 1024)
            expected = end - start + 1
            if path.stat().st_size != expected:
                raise RuntimeError(f"Range file has {path.stat().st_size} bytes; expected {expected}")
            return
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2**attempt)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    if DESTINATION.exists():
        if DESTINATION.stat().st_size != EXPECTED_SIZE:
            raise SystemExit("Existing checkpoint has the wrong size; move it aside before reacquiring.")
        print(f"Checkpoint already present: {sha256(DESTINATION)}")
        return

    CHUNKS.mkdir(parents=True, exist_ok=True)
    chunk_size = math.ceil(EXPECTED_SIZE / CHUNK_COUNT)
    ranges = [
        (index * chunk_size, min(EXPECTED_SIZE - 1, (index + 1) * chunk_size - 1))
        for index in range(CHUNK_COUNT)
    ]

    existing_prefix = PARTIAL.stat().st_size if PARTIAL.exists() else 0
    if existing_prefix > ranges[0][1] - ranges[0][0] + 1:
        raise SystemExit("Partial download is larger than the resumable first range.")

    def prepare(item: tuple[int, tuple[int, int]]) -> str:
        index, (start, end) = item
        part = CHUNKS / f"part-{index:02d}.bin"
        expected = end - start + 1
        if part.exists() and part.stat().st_size == expected:
            return f"range {index + 1}/{CHUNK_COUNT}: already complete"
        part.unlink(missing_ok=True)

        resume = 0
        if index == 0 and existing_prefix:
            shutil.copyfile(PARTIAL, part)
            resume = existing_prefix
        if resume < expected:
            ranged_get(start, end, part, resume)
        return f"range {index + 1}/{CHUNK_COUNT}: complete"

    with concurrent.futures.ThreadPoolExecutor(max_workers=CHUNK_COUNT) as pool:
        futures = [pool.submit(prepare, item) for item in enumerate(ranges)]
        for future in concurrent.futures.as_completed(futures):
            print(future.result(), flush=True)

    assembled = DESTINATION.with_suffix(".pth.assembling")
    with assembled.open("wb") as output:
        for index, (start, end) in enumerate(ranges):
            part = CHUNKS / f"part-{index:02d}.bin"
            if part.stat().st_size != end - start + 1:
                raise SystemExit(f"Range {index} failed its final size check.")
            with part.open("rb") as source:
                shutil.copyfileobj(source, output, length=8 * 1024 * 1024)
    if assembled.stat().st_size != EXPECTED_SIZE:
        raise SystemExit(f"Assembled checkpoint has the wrong size: {assembled.stat().st_size}")

    digest = sha256(assembled)
    os.replace(assembled, DESTINATION)
    PARTIAL.unlink(missing_ok=True)
    shutil.rmtree(CHUNKS)
    manifest = {
        "model": "CVS-AdaptNet",
        "checkpoint": DESTINATION.name,
        "source_url": URL,
        "source_repository": "https://github.com/CAMMA-public/CVS-AdaptNet",
        "source_revision": "bb21ffbd781b6f943be0daaeeccf1567c21e691d",
        "source_license": "CC BY-NC-SA 4.0; third-party model terms remain separately applicable",
        "size_bytes": EXPECTED_SIZE,
        "sha256": digest,
        "publisher_sha256": None,
        "integrity_note": "HTTP byte ranges and exact published file size verified; the publisher does not publish a SHA-256 checksum.",
        "use_scope": "local non-commercial scientific research and education only",
    }
    (DESTINATION.parent / "medforge-checkpoint-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Installed {EXPECTED_SIZE} bytes; SHA-256 {digest}")


if __name__ == "__main__":
    main()
