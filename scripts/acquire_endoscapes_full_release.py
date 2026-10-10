"""Install the complete official Endoscapes2023 frame release for local research.

The release is a ZIP of sampled still frames and annotations, not playable MP4
videos. This installer verifies the pinned archive size/ETag, ZIP integrity,
safe member paths, and file hashes. Raw research assets remain local and ignored
by Git; the downloaded ZIP is removed after successful extraction to save space.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import posixpath
from pathlib import Path, PurePosixPath
import shutil
import stat
import tempfile
import time
from urllib.request import Request, urlopen
from zipfile import ZipFile

URL = "https://s3.unistra.fr/camma_public/datasets/endoscapes/endoscapes.zip"
EXPECTED_SIZE = 6_285_499_749
EXPECTED_ETAG = '"445795b0639cc3fce825ed197fa3949c-750"'
EXPECTED_ENTRIES = 160_001
EXPECTED_UNCOMPRESSED = 7_279_043_034
MIN_FREE_AFTER_EXTRACT = 1_000_000_000
CHUNK_SIZE = 8 * 1024 * 1024
ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "data" / "endoscapes"
ARCHIVE = DATA_ROOT / ".endoscapes-source-archive.zip"
PARTIAL = DATA_ROOT / ".endoscapes-source-archive.zip.part"
MANIFEST = DATA_ROOT / "medforge-full-release-manifest.json"


def remote_headers() -> tuple[int, str]:
    with urlopen(Request(URL, method="HEAD", headers={"User-Agent": "HealthCure-local-research/1.0"}), timeout=60) as response:
        size = int(response.headers.get("Content-Length", "-1"))
        etag = response.headers.get("ETag", "")
        ranges = response.headers.get("Accept-Ranges", "")
    if size != EXPECTED_SIZE or etag != EXPECTED_ETAG or "bytes" not in ranges.lower():
        raise RuntimeError(f"Official archive identity changed: size={size}, etag={etag!r}, ranges={ranges!r}")
    return size, etag


def download(size: int, etag: str) -> str:
    if ARCHIVE.exists():
        if ARCHIVE.stat().st_size != size:
            raise RuntimeError("Existing official archive has the wrong size; refusing to replace it")
        source = ARCHIVE
    else:
        start = PARTIAL.stat().st_size if PARTIAL.exists() else 0
        if start > size:
            raise RuntimeError("Partial archive exceeds the pinned source size")
        headers = {"User-Agent": "HealthCure-local-research/1.0", "If-Match": etag}
        if start:
            headers["Range"] = f"bytes={start}-"
        request = Request(URL, headers=headers)
        with urlopen(request, timeout=120) as response:
            if start and response.status != 206:
                raise RuntimeError("Archive server did not resume the existing partial download")
            if not start and response.status != 200:
                raise RuntimeError(f"Unexpected archive response status: {response.status}")
            response_etag = response.headers.get("ETag", "")
            if response_etag != etag:
                raise RuntimeError("Official archive ETag differs from the pinned release")
            content_range = response.headers.get("Content-Range", "")
            if start and not content_range.startswith(f"bytes {start}-"):
                raise RuntimeError("Resumed response does not start at the requested byte")
            mode = "ab" if start else "wb"
            written = start
            last_print = start
            with PARTIAL.open(mode) as output:
                while chunk := response.read(CHUNK_SIZE):
                    output.write(chunk)
                    written += len(chunk)
                    if written - last_print >= 256 * 1024 * 1024:
                        print(f"Downloaded {written:,}/{size:,} bytes", flush=True)
                        last_print = written
                output.flush()
                os.fsync(output.fileno())
        if PARTIAL.stat().st_size != size:
            raise RuntimeError(f"Short archive download: {PARTIAL.stat().st_size:,}/{size:,} bytes")
        os.replace(PARTIAL, ARCHIVE)
        source = ARCHIVE

    digest = hashlib.sha256()
    with source.open("rb") as stream:
        for chunk in iter(lambda: stream.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_and_hash(archive: ZipFile) -> tuple[list[dict], int]:
    infos = archive.infolist()
    uncompressed = sum(item.file_size for item in infos)
    if len(infos) != EXPECTED_ENTRIES or uncompressed != EXPECTED_UNCOMPRESSED:
        raise RuntimeError(f"Unexpected archive inventory: {len(infos)} entries / {uncompressed:,} bytes")
    regular_infos = [item for item in infos if not item.is_dir() and info_kind(item) != stat.S_IFLNK]
    links = [item for item in infos if not item.is_dir() and info_kind(item) == stat.S_IFLNK]
    missing_bytes = sum(
        item.file_size
        for item in regular_infos
        if not DATA_ROOT.joinpath(*PurePosixPath(item.filename).parts[1:]).exists()
    )
    free = shutil.disk_usage(DATA_ROOT).free
    if free < missing_bytes + MIN_FREE_AFTER_EXTRACT:
        raise RuntimeError(f"Insufficient extraction space: {free:,} free, {missing_bytes:,} missing file bytes plus reserve required")

    # The official ZIP uses relative symlinks for convenience folders such as
    # `all/` and stride-specific aliases. Validate all targets before creating
    # any of them, then verify resolution after extracting regular files.
    link_targets: list[tuple[Path, str, str]] = []
    archive_paths = {PurePosixPath(item.filename).as_posix() for item in infos}
    for info in links:
        member = PurePosixPath(info.filename)
        target = archive.read(info).decode("utf-8")
        if not target or PurePosixPath(target).is_absolute():
            raise RuntimeError(f"Unsafe symbolic link target in official ZIP: {info.filename!r} -> {target!r}")
        normalized = posixpath.normpath(posixpath.join(member.parent.as_posix(), target))
        if normalized == ".." or normalized.startswith("../") or not normalized.startswith("endoscapes/"):
            raise RuntimeError(f"Symbolic link escapes dataset root: {info.filename!r} -> {target!r}")
        if normalized not in archive_paths:
            raise RuntimeError(f"Symbolic link target is absent from archive: {info.filename!r} -> {normalized!r}")
        link_targets.append((DATA_ROOT.joinpath(*member.parts[1:]), target, normalized))

    manifest_path = DATA_ROOT / ".endoscapes-full-release-files.jsonl.part"
    records: list[dict] = []
    total = 0
    started = time.monotonic()
    with manifest_path.open("w", encoding="utf8") as manifest:
        for index, info in enumerate(infos, start=1):
            member = PurePosixPath(info.filename)
            if member.is_absolute() or ".." in member.parts or not member.parts or member.parts[0] != "endoscapes":
                raise RuntimeError(f"Unsafe path in official ZIP: {info.filename!r}")
            if info_kind(info) == stat.S_IFLNK:
                continue
            destination = DATA_ROOT.joinpath(*member.parts[1:])
            if info.is_dir():
                destination.mkdir(parents=True, exist_ok=True)
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            digest = hashlib.sha256()
            crc = 0
            size = 0
            existing = destination.exists()
            temporary = None
            output = None
            if not existing:
                fd, temporary = tempfile.mkstemp(prefix=f".{destination.name}.", dir=destination.parent)
                output = os.fdopen(fd, "wb")
            try:
                with archive.open(info, "r") as source:
                    while chunk := source.read(CHUNK_SIZE):
                        digest.update(chunk)
                        crc = __import__("binascii").crc32(chunk, crc)
                        size += len(chunk)
                        if output is not None:
                            output.write(chunk)
                if output is not None:
                    output.flush()
                    os.fsync(output.fileno())
                    output.close()
                    output = None
                if size != info.file_size or crc & 0xFFFFFFFF != info.CRC:
                    raise RuntimeError(f"ZIP CRC/size validation failed: {info.filename}")
                if existing:
                    if destination.stat().st_size != size or _sha256_file(destination) != digest.hexdigest():
                        raise RuntimeError(f"Refusing to replace mismatched existing file: {destination}")
                else:
                    os.replace(temporary, destination)
                    temporary = None
            finally:
                if output is not None:
                    output.close()
                if temporary and os.path.exists(temporary):
                    os.unlink(temporary)
            record = {"path": str(member), "size_bytes": size, "crc32": f"{crc & 0xFFFFFFFF:08x}", "sha256": digest.hexdigest()}
            manifest.write(json.dumps(record, separators=(",", ":")) + "\n")
            records.append(record)
            total += size
            if index % 5000 == 0 or index == len(infos):
                print(f"Verified/extracted {index:,}/{len(infos):,} archive entries ({total:,} file bytes)", flush=True)
        for destination, target, _normalized in link_targets:
            destination.parent.mkdir(parents=True, exist_ok=True)
            if destination.is_symlink():
                if os.readlink(destination) != target:
                    raise RuntimeError(f"Refusing to replace mismatched symbolic link: {destination}")
            elif destination.exists():
                raise RuntimeError(f"Refusing to replace existing non-link with archive symbolic link: {destination}")
            else:
                destination.symlink_to(target)
            resolved = destination.resolve(strict=True)
            try:
                resolved.relative_to(DATA_ROOT.resolve())
            except ValueError as error:
                raise RuntimeError(f"Resolved symbolic link escapes dataset root: {destination}") from error
            if not resolved.exists():
                raise RuntimeError(f"Symbolic link does not resolve to an installed path: {destination}")
        print(f"Validated/created {len(link_targets):,} safe internal dataset aliases", flush=True)
        manifest.flush()
        os.fsync(manifest.fileno())
    os.replace(manifest_path, DATA_ROOT / "medforge-full-release-files.jsonl")
    print(f"Extraction finished in {time.monotonic() - started:.1f}s", flush=True)
    return records, total


def info_kind(info) -> int:
    return info.external_attr >> 16 & 0o170000


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    size, etag = remote_headers()
    print(f"Pinned official Endoscapes release: {size:,} bytes · {etag}", flush=True)
    archive_sha256 = download(size, etag)
    with ZipFile(ARCHIVE) as archive:
        symlink_count = sum(1 for info in archive.infolist() if info_kind(info) == stat.S_IFLNK)
        records, payload_bytes = extract_and_hash(archive)
    file_manifest_path = DATA_ROOT / "medforge-full-release-files.jsonl"
    manifest = {
        "schema": "medforge.source-manifest.endoscapes-full-release.v1",
        "dataset": "Endoscapes2023",
        "source_url": "https://github.com/CAMMA-public/Endoscapes",
        "archive_url": URL,
        "citation": "Murali A, et al. The Endoscapes Dataset for Surgical Scene Segmentation, Object Detection, and Critical View of Safety Assessment. arXiv:2312.12429 (2023).",
        "license": "CC BY-NC-SA 4.0; non-commercial scientific research purposes",
        "archive_size_bytes": size,
        "archive_etag": etag,
        "archive_sha256": archive_sha256,
        "archive_entries": EXPECTED_ENTRIES,
        "installed_files": len(records),
        "installed_uncompressed_bytes": payload_bytes,
        "installed_internal_symlinks": symlink_count,
        "file_manifest": file_manifest_path.name,
        "file_manifest_sha256": _sha256_file(file_manifest_path),
        "media_scope": "Sampled still frames and source annotations; not encoded continuous video.",
        "archive_retained": False,
    }
    temporary = MANIFEST.with_suffix(".json.part")
    temporary.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    os.replace(temporary, MANIFEST)
    ARCHIVE.unlink()
    print(f"Installed full Endoscapes frame release; archive SHA-256 {archive_sha256}", flush=True)


if __name__ == "__main__":
    main()
