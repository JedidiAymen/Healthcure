"""Range-extract one public 100-second Appendix300 video snippet from OPARA.

The 80 GB public ZIP is not downloaded in full. HTTP ranges fetch its ZIP
directory and one selected MP4 only. Source identity, license, ZIP CRC, and
the extracted file SHA-256 are recorded locally; raw data stays out of Git.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tempfile
from urllib.request import Request, urlopen
from zipfile import ZipFile

ITEM_ID = "07d6dbbe-e21f-4878-a87c-861d5a428523"
BITSTREAM_ID = "8a6fcaa0-9026-4744-9f6f-883fe6be78a0"
ARCHIVE_SIZE = 80_773_037_109
ARCHIVE_ETAG = '"d8f7eacd7bddffbec63b9bfd177d7e88"'
ARCHIVE_URL = f"https://opara.zih.tu-dresden.de/server/api/core/bitstreams/{BITSTREAM_ID}/content"
ITEM_API = f"https://opara.zih.tu-dresden.de/server/api/core/items/{ITEM_ID}"
ROOT = Path(__file__).resolve().parents[1]
SHARED_DATA = ROOT.parent / "medforge" / "data"
DATA_ROOT = (SHARED_DATA if SHARED_DATA.is_dir() else ROOT / "data") / "appendix300"
CHUNK_SIZE = 2 * 1024 * 1024
RANGE_CHUNK_SIZE = 2 * 1024 * 1024
MIN_FREE_AFTER = 500_000_000


def fetch_json(url: str) -> dict:
    request = Request(url, headers={"User-Agent": "HealthCure local research dataset acquisition/1.0"})
    with urlopen(request, timeout=60) as response:
        return json.load(response)


class RangeFile(io.RawIOBase):
    """Small seekable file view backed by ETag-pinned HTTP range requests."""

    def __init__(self) -> None:
        super().__init__()
        self.position = 0
        self.cache: dict[int, bytes] = {}
        self.cache_order: list[int] = []
        self.bytes_received = 0

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.position

    def seek(self, offset: int, whence: int = os.SEEK_SET) -> int:
        if whence == os.SEEK_SET:
            position = offset
        elif whence == os.SEEK_CUR:
            position = self.position + offset
        elif whence == os.SEEK_END:
            position = ARCHIVE_SIZE + offset
        else:
            raise ValueError(f"Invalid seek mode: {whence}")
        if position < 0:
            raise ValueError("Negative seek position")
        self.position = position
        return position

    def _range(self, index: int) -> bytes:
        if index in self.cache:
            self.cache_order.remove(index)
            self.cache_order.append(index)
            return self.cache[index]
        start = index * RANGE_CHUNK_SIZE
        end = min(ARCHIVE_SIZE, start + RANGE_CHUNK_SIZE) - 1
        request = Request(ARCHIVE_URL, headers={
            "User-Agent": "HealthCure local research dataset acquisition/1.0",
            "If-Range": ARCHIVE_ETAG,
            "Range": f"bytes={start}-{end}",
        })
        with urlopen(request, timeout=120) as response:
            content_range = response.headers.get("Content-Range", "")
            etag = response.headers.get("ETag", "")
            data = response.read()
        if response.status != 206 or etag != ARCHIVE_ETAG or content_range != f"bytes {start}-{end}/{ARCHIVE_SIZE}":
            raise RuntimeError(f"Unpinned OPARA range response: status={response.status}, range={content_range!r}, etag={etag!r}")
        self.cache[index] = data
        self.cache_order.append(index)
        self.bytes_received += len(data)
        while len(self.cache_order) > 8:
            self.cache.pop(self.cache_order.pop(0), None)
        return data

    def read(self, size: int = -1) -> bytes:
        if size is None or size < 0:
            size = max(0, ARCHIVE_SIZE - self.position)
        end_position = min(ARCHIVE_SIZE, self.position + size)
        output = bytearray()
        while self.position < end_position:
            index = self.position // RANGE_CHUNK_SIZE
            block = self._range(index)
            offset = self.position - index * RANGE_CHUNK_SIZE
            take = min(end_position - self.position, len(block) - offset)
            if take <= 0:
                break
            output.extend(block[offset:offset + take])
            self.position += take
        return bytes(output)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe_duration(path: Path) -> float:
    if shutil.which("ffprobe") is None:
        raise SystemExit("ffprobe (part of FFmpeg) is required to verify the clip duration. Install FFmpeg or put ffprobe on PATH, then rerun.")
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        check=True, capture_output=True, text=True,
    )
    duration = float(json.loads(result.stdout)["format"]["duration"])
    if duration <= 0:
        raise RuntimeError(f"Invalid MP4 duration: {duration}")
    return duration


def main() -> None:
    argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    if shutil.which("ffprobe") is None:
        raise SystemExit("ffprobe (part of FFmpeg) is required to verify the clip duration. Install FFmpeg or put ffprobe on PATH, then rerun.")
    item = fetch_json(ITEM_API)
    license_uris = [entry.get("value") for entry in item.get("metadata", {}).get("dc.rights.uri", [])]
    if "http://creativecommons.org/licenses/by/4.0/" not in license_uris:
        raise RuntimeError(f"OPARA item does not confirm the expected CC BY 4.0 license: {license_uris!r}")
    bundles_url = item["_links"]["bundles"]["href"]
    bundles = fetch_json(bundles_url)["_embedded"]["bundles"]
    original = next((bundle for bundle in bundles if bundle.get("name") == "ORIGINAL"), None)
    if original is None:
        raise RuntimeError("The OPARA item has no ORIGINAL bundle")
    bitstreams_url = original["_links"]["bitstreams"]["href"]
    bitstreams = fetch_json(bitstreams_url)["_embedded"]["bitstreams"]
    archive = next((stream for stream in bitstreams if stream.get("uuid") == BITSTREAM_ID), None)
    if archive is None or archive.get("name") != "Appendix300_Video_Snippets.zip" or archive.get("sizeBytes") != ARCHIVE_SIZE:
        raise RuntimeError("The OPARA video-snippet archive identity differs from the pinned release")

    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    range_file = RangeFile()
    with ZipFile(range_file) as source:
        candidates = [
            info for info in source.infolist()
            if not info.is_dir()
            and info.filename.startswith("Video_Snippets/")
            and info.filename.lower().endswith(".mp4")
        ]
        if not candidates:
            raise RuntimeError("No MP4 snippets found in the official OPARA ZIP")
        selected = min(candidates, key=lambda info: (info.file_size, info.filename))
        member = PurePosixPath(selected.filename)
        if member.is_absolute() or ".." in member.parts or len(member.parts) < 3:
            raise RuntimeError(f"Unsafe video member path in OPARA ZIP: {selected.filename!r}")
        destination = DATA_ROOT.joinpath(*member.parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            free = shutil.disk_usage(DATA_ROOT).free
            if free < selected.file_size + MIN_FREE_AFTER:
                raise RuntimeError(f"Insufficient space for selected clip: {free:,} free, {selected.file_size:,} bytes plus reserve required")
            fd, temporary_name = tempfile.mkstemp(prefix=f".{destination.name}.", dir=destination.parent)
            temporary = Path(temporary_name)
            digest = hashlib.sha256()
            written = 0
            try:
                with os.fdopen(fd, "wb") as output, source.open(selected, "r") as video:
                    while chunk := video.read(CHUNK_SIZE):
                        output.write(chunk)
                        digest.update(chunk)
                        written += len(chunk)
                if written != selected.file_size:
                    raise RuntimeError("Unexpected extracted video size")
                os.replace(temporary, destination)
            finally:
                temporary.unlink(missing_ok=True)
            clip_sha256 = digest.hexdigest()
        else:
            if destination.stat().st_size != selected.file_size:
                raise RuntimeError(f"Refusing to replace mismatched existing video: {destination}")
            clip_sha256 = sha256(destination)

        duration = probe_duration(destination)
        clip_id = "appendix300-center1-014"
        manifest = {
            "schema": "medforge.source-manifest.appendix300-single-clip.v1",
            "dataset": "Appendix300",
            "dataset_doi": "https://doi.org/10.25532/OPARA-1173",
            "paper_doi": "https://doi.org/10.1038/s41597-026-07593-6",
            "citation": "Kolbinger FR, et al. Appendix300: Surgical video and patient metadata of 330 laparoscopic appendectomy cases from five institutions. Scientific Data 13, 886 (2026). https://doi.org/10.1038/s41597-026-07593-6",
            "license": "CC BY 4.0",
            "license_url": "https://creativecommons.org/licenses/by/4.0/",
            "opara_item_id": ITEM_ID,
            "opara_item_handle": "123456789/2223",
            "archive_bitstream_id": BITSTREAM_ID,
            "archive_url": ARCHIVE_URL,
            "archive_size_bytes": ARCHIVE_SIZE,
            "archive_etag": ARCHIVE_ETAG,
            "archive_full_sha256": None,
            "archive_integrity_note": "The official 80 GB archive was not downloaded in full. Its ETag and size were pinned; the selected ZIP member passed its ZIP CRC check and its extracted SHA-256 is recorded.",
            "video_member": selected.filename,
            "video_relative_path": str(destination.relative_to(DATA_ROOT)),
            "clip_id": clip_id,
            "procedure_label": "Laparoscopic appendectomy",
            "video_size_bytes": selected.file_size,
            "video_crc32": f"{selected.CRC:08x}",
            "video_sha256": clip_sha256,
            "video_duration_seconds": duration,
            "video_duration_verified_by": "ffprobe",
            "video_scope": "De-identified laparoscopic appendectomy excerpt; not cholecystectomy footage and not annotated with instrument masks.",
            "selected_by": "smallest MP4 in the official Video_Snippets directory",
            "zip_directory_bytes_fetched": range_file.bytes_received,
        }
        manifest_path = DATA_ROOT / "medforge-source-manifest.json"
        temporary_manifest = manifest_path.with_suffix(".json.part")
        temporary_manifest.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
        os.replace(temporary_manifest, manifest_path)
        print(json.dumps({"video": str(destination), "bytes": selected.file_size, "sha256": clip_sha256, "member": selected.filename, "directory_bytes_fetched": range_file.bytes_received}, indent=2))


if __name__ == "__main__":
    main()
