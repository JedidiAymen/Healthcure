"""Range-extract authentic FiSaV patient CSVs from the official OSF archive."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import tempfile
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from zipfile import ZipFile
import zlib

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "data" / "fisav"
URL = "https://osf.io/download/m6syv/"
OSF_ARCHIVE_SHA256 = "6d9f65aa69ff3fa145f0443ee7c0f34ab916a79c2d3f377be3fca6c635911c75"
ENTRY_ROOT = "FiSaV_Dataset_CSV/"


class RemoteRangeFile(io.RawIOBase):
    def __init__(self, url: str):
        self.url = url
        with urlopen(Request(url, method="HEAD"), timeout=90) as response:
            self.size = int(response.headers["Content-Length"])
            self.etag = response.headers.get("ETag", "")
        # OSF redirects to a short-lived signed object URL. Resolve it once and
        # reuse that URL for bounded ranges so archive parsing stays consistent.
        self._refresh_download_url()
        self.position = 0

    def _refresh_download_url(self) -> None:
        with urlopen(Request(self.url, headers={"Range": "bytes=0-0"}), timeout=90) as response:
            if response.status != 206 or response.headers.get("Content-Range") != f"bytes 0-0/{self.size}":
                raise RuntimeError("OSF did not provide a bounded range for the archive")
            self.download_url = response.geturl()

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.position

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        if whence == io.SEEK_SET:
            target = offset
        elif whence == io.SEEK_CUR:
            target = self.position + offset
        elif whence == io.SEEK_END:
            target = self.size + offset
        else:
            raise ValueError("invalid seek mode")
        if target < 0:
            raise ValueError("negative seek position")
        self.position = target
        return target

    def read(self, count: int = -1) -> bytes:
        if count < 0:
            count = self.size - self.position
        end = min(self.size, self.position + count) - 1
        if end < self.position:
            return b""
        for attempt in range(3):
            request = Request(self.download_url, headers={"Range": f"bytes={self.position}-{end}"})
            try:
                with urlopen(request, timeout=180) as response:
                    content_range = response.headers.get("Content-Range", "")
                    if response.status != 206 or not content_range.startswith(f"bytes {self.position}-"):
                        raise RuntimeError("OSF file server did not honor a bounded byte-range request")
                    payload = response.read()
                break
            except HTTPError as error:
                if error.code not in (400, 403, 410) or attempt == 2:
                    raise
                self._refresh_download_url()
        if len(payload) != end - self.position + 1:
            raise RuntimeError("OSF returned an incomplete byte range")
        self.position += len(payload)
        return payload


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hash_and_crc_file(path: Path) -> tuple[str, int]:
    digest = hashlib.sha256()
    crc = 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
            crc = zlib.crc32(chunk, crc)
    return digest.hexdigest(), crc & 0xFFFFFFFF


def stream_immutable(archive: ZipFile, entry, path: Path, previous: dict) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    old = previous.get(path.name, {})
    if path.exists() and path.stat().st_size == entry.file_size:
        digest, crc = hash_and_crc_file(path)
        if old.get("sha256") and digest != old["sha256"]:
            raise RuntimeError(f"Refusing to replace a local file that differs from its saved manifest: {path}")
        if crc == entry.CRC:
            print(f"Already verified {path.name} ({entry.file_size:,} bytes)", flush=True)
            return {"file_name": path.name, "source_entry": entry.filename,
                    "uncompressed_bytes": entry.file_size, "sha256": digest}
        if old.get("sha256"):
            raise RuntimeError(f"Refusing to replace a local file that differs from its saved manifest: {path}")

    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    digest = hashlib.sha256()
    written = 0
    try:
        with archive.open(entry, "r") as source, os.fdopen(fd, "wb") as output:
            for chunk in iter(lambda: source.read(8 * 1024 * 1024), b""):
                output.write(chunk)
                digest.update(chunk)
                written += len(chunk)
            output.flush()
            os.fsync(output.fileno())
        if written != entry.file_size:
            raise RuntimeError(f"Unexpected uncompressed size for {entry.filename}: {written}")
        sha = digest.hexdigest()
        if path.exists():
            if hash_file(path) != sha:
                raise RuntimeError(f"Refusing to replace a different local source file: {path}")
            os.unlink(tmp)
        else:
            os.replace(tmp, path)
        return {"file_name": path.name, "source_entry": entry.filename,
                "uncompressed_bytes": written, "sha256": sha}
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all-recordings", action="store_true",
                        help="extract all 59 CSV recordings; demographics workbooks are never extracted")
    args = parser.parse_args()
    previous_manifest_path = DATA_ROOT / "medforge-source-manifest.json"
    try:
        previous_manifest = json.loads(previous_manifest_path.read_text(encoding="utf8"))
        previous_records = {row["file_name"]: row for row in previous_manifest.get("records", [])}
        if "pat001.csv" not in previous_records and previous_manifest.get("sample_file"):
            previous_records["pat001.csv"] = previous_manifest["sample_file"]
    except (OSError, ValueError, TypeError):
        previous_manifest, previous_records = {}, {}

    remote = RemoteRangeFile(URL)
    if remote.size != 2_273_696_503:
        raise RuntimeError(f"Unexpected official archive size: {remote.size}")
    with ZipFile(remote) as archive:
        entries = [entry for entry in archive.infolist()
                   if entry.filename.startswith(ENTRY_ROOT) and entry.filename.lower().endswith(".csv") and not entry.is_dir()]
        entries.sort(key=lambda entry: entry.filename)
        if len(entries) != 59 or sum(entry.file_size for entry in entries) != 8_144_854_743:
            raise RuntimeError("Unexpected FiSaV CSV inventory; refusing to install unrecognized archive contents")
        if not args.all_recordings:
            entries = [entry for entry in entries if entry.filename == f"{ENTRY_ROOT}pat001.csv"]
        records = []
        for index, entry in enumerate(entries, start=1):
            filename = Path(entry.filename).name
            if not filename.startswith("pat") or not filename.endswith(".csv") or not filename[3:-4].isdigit():
                raise RuntimeError(f"Unexpected patient recording member path: {entry.filename}")
            record = stream_immutable(archive, entry, DATA_ROOT / filename, previous_records)
            record["patient_code"] = Path(filename).stem
            records.append(record)
            checkpoint_records = sorted(
                {row["file_name"]: row for row in [*previous_records.values(), *records]}.values(),
                key=lambda row: row["file_name"],
            )
            checkpoint = {
                "schema": "medforge.source-manifest.fisav.v1",
                "dataset": "FiSaV Dataset", "dataset_doi": "10.17605/OSF.IO/HYPFR",
                "dataset_url": "https://osf.io/hypfr/", "paper_doi": "10.1038/s41597-026-08242-8",
                "license": "CC BY 4.0", "license_url": "https://creativecommons.org/licenses/by/4.0/",
                "license_file": "LICENSE_CC_BY.txt", "archive_name": "FiSaV_Dataset_CSV.zip",
                "archive_url": URL, "archive_sha256_osf": OSF_ARCHIVE_SHA256,
                "archive_size_bytes": remote.size, "archive_etag": remote.etag,
                "archive_member_paths": [row["source_entry"] for row in checkpoint_records],
                "sample_file": next(row for row in checkpoint_records if row["file_name"] == "pat001.csv"),
                "records": checkpoint_records, "recording_count": len(checkpoint_records),
                "complete_csv_cohort": len(checkpoint_records) == 59, "not_for_git": True,
                "privacy_note": "Research waveform source only. No demographics workbook is extracted. The occlusion field is not interpreted as a stenosis outcome.",
            }
            temp_manifest = DATA_ROOT / ".medforge-source-manifest.tmp"
            temp_manifest.write_text(json.dumps(checkpoint, indent=2, sort_keys=True) + "\n", encoding="utf8")
            os.replace(temp_manifest, DATA_ROOT / "medforge-source-manifest.json")
            print(f"Verified {index}/{len(entries)} · {filename} · {entry.file_size:,} bytes · SHA-256 {record['sha256']}", flush=True)
    all_records = sorted(
        {row["file_name"]: row for row in [*previous_records.values(), *records]}.values(),
        key=lambda row: row["file_name"],
    )
    manifest = {
        "schema": "medforge.source-manifest.fisav.v1",
        "dataset": "FiSaV Dataset",
        "dataset_doi": "10.17605/OSF.IO/HYPFR",
        "dataset_url": "https://osf.io/hypfr/",
        "paper_doi": "10.1038/s41597-026-08242-8",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "license_file": "LICENSE_CC_BY.txt",
        "archive_name": "FiSaV_Dataset_CSV.zip",
        "archive_url": URL,
        "archive_sha256_osf": OSF_ARCHIVE_SHA256,
        "archive_size_bytes": remote.size,
        "archive_etag": remote.etag,
        "archive_member_paths": [row["source_entry"] for row in all_records],
        "sample_file": next(row for row in all_records if row["file_name"] == "pat001.csv"),
        "records": all_records,
        "recording_count": len(all_records),
        "complete_csv_cohort": len(all_records) == 59,
        "not_for_git": True,
        "privacy_note": "Research waveform source only. No demographics workbook is extracted. The occlusion field is not interpreted as a stenosis outcome.",
    }
    manifest_path = DATA_ROOT / "medforge-source-manifest.json"
    encoded = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode()
    manifest_path.write_bytes(encoded)
    print(json.dumps({"path": str(DATA_ROOT), "recordings": len(all_records),
                      "recording_bytes": sum(row["uncompressed_bytes"] for row in all_records),
                      "archive_bytes": remote.size, "complete_csv_cohort": len(all_records) == 59,
                      "manifest": str(manifest_path)}, indent=2))


if __name__ == "__main__":
    main()
