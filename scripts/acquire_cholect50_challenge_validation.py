#!/usr/bin/env python3
"""Install the public CholecT50 challenge-validation frame and label bundle."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "data" / "cholect50"
INSTALL_ROOT = DATA_ROOT / "challenge-validation"
ARCHIVE = DATA_ROOT / "challenge-validation.zip"
SOURCE_URL = "https://s3.unistra.fr/camma_public/datasets/cholect50/CholecT50-Challenge-Validation.zip"
SOURCE_ETAG = '"e790290b46b26225460159a6c804b46f-39"'
SOURCE_SIZE = 322_635_563
LICENSE = "CC BY-NC-SA 4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by-nc-sa/4.0/"
SOURCE_PAGE = "https://github.com/CAMMA-public/cholect50/blob/master/docs/README-Downloads.md"
EXPECTED_TOP = "cholect50-challenge-val"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def inspect_source() -> None:
    request = urllib.request.Request(SOURCE_URL, method="HEAD")
    with urllib.request.urlopen(request, timeout=30) as response:
        etag = response.headers.get("ETag")
        size = int(response.headers.get("Content-Length", "0"))
    if etag != SOURCE_ETAG or size != SOURCE_SIZE:
        raise SystemExit(f"Official source changed: expected ETag/size {SOURCE_ETAG}/{SOURCE_SIZE}, got {etag}/{size}")


def download() -> None:
    if ARCHIVE.is_file() and ARCHIVE.stat().st_size == SOURCE_SIZE:
        return
    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    partial = ARCHIVE.with_suffix(".zip.part")
    request = urllib.request.Request(SOURCE_URL, headers={"If-Match": SOURCE_ETAG})
    try:
        with urllib.request.urlopen(request, timeout=120) as response, partial.open("wb") as out:
            if response.headers.get("ETag") != SOURCE_ETAG:
                raise SystemExit("The downloaded archive ETag does not match the official pinned release.")
            while block := response.read(1024 * 1024):
                out.write(block)
        if partial.stat().st_size != SOURCE_SIZE:
            raise SystemExit("The downloaded archive size does not match the official release.")
        os.replace(partial, ARCHIVE)
    finally:
        partial.unlink(missing_ok=True)


def install() -> None:
    inspect_source()
    download()
    archive_sha256 = sha256(ARCHIVE)
    temporary = INSTALL_ROOT.with_name(f"{INSTALL_ROOT.name}.extracting")
    if temporary.exists():
        import shutil
        shutil.rmtree(temporary)
    temporary.mkdir(parents=True)
    files: list[dict[str, object]] = []
    with zipfile.ZipFile(ARCHIVE) as bundle:
        bad = bundle.testzip()
        if bad:
            raise SystemExit(f"ZIP CRC validation failed for {bad}")
        for info in bundle.infolist():
            member = PurePosixPath(info.filename)
            if member.is_absolute() or ".." in member.parts or not member.parts or member.parts[0] != EXPECTED_TOP:
                raise SystemExit(f"Unexpected archive path: {info.filename}")
            if info.is_dir():
                continue
            if (info.external_attr >> 16) & 0o170000 == 0o120000:
                raise SystemExit(f"Refusing symbolic link in archive: {info.filename}")
            target = temporary.joinpath(*member.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with bundle.open(info) as source, target.open("wb") as out:
                while block := source.read(1024 * 1024):
                    out.write(block)
            files.append({
                "path": member.as_posix(),
                "size_bytes": target.stat().st_size,
                "sha256": sha256(target),
            })
    source_root = temporary / EXPECTED_TOP
    labels = sorted(source_root.glob("labels/VID*.json"))
    if len(labels) != 5 or not all((source_root / "videos" / path.stem).is_dir() for path in labels):
        raise SystemExit("The official validation set does not contain all five labeled video sequences.")
    manifest = {
        "schema": "medforge.source-manifest.cholect50-challenge-validation.v1",
        "dataset": "CholecT50 Challenge Validation",
        "source_url": SOURCE_PAGE,
        "archive_url": SOURCE_URL,
        "archive_etag": SOURCE_ETAG,
        "archive_size_bytes": SOURCE_SIZE,
        "archive_sha256": archive_sha256,
        "license": LICENSE,
        "license_url": LICENSE_URL,
        "citation": "Nwoye et al., Rendezvous: Attention Mechanisms for the Recognition of Surgical Action Triplets in Endoscopic Videos, Medical Image Analysis 78 (2022), 102433. doi:10.1016/j.media.2022.102433",
        "sampling_fps": 1,
        "video_count": len(labels),
        "files": files,
    }
    (temporary / "medforge-source-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    if INSTALL_ROOT.exists():
        import shutil
        shutil.rmtree(INSTALL_ROOT)
    os.replace(temporary, INSTALL_ROOT)
    print(f"Installed {len(files)} verified files for {len(labels)} CholecT50 validation sequences.")
    print(f"Archive SHA-256: {archive_sha256}")
    print(f"Installed source: {INSTALL_ROOT / EXPECTED_TOP}")


if __name__ == "__main__":
    argparse.ArgumentParser(description=__doc__).parse_args()
    install()
