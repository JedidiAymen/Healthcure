"""Acquire all official Endoscapes-BBox201 keyframes for local research use.

The multi-gigabyte ZIP is read through bounded HTTP byte ranges. Only the
three COCO split files and the annotated keyframe JPEGs are saved locally.
The upstream data license restricts use to non-commercial scientific research;
this script does not redistribute data or download unlabeled video frames.
"""
from __future__ import annotations

import argparse
import binascii
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import io
import json
import os
from pathlib import Path
import struct
import tempfile
from urllib.request import Request, urlopen
import zipfile
from zipfile import ZipFile

URL = "https://s3.unistra.fr/camma_public/datasets/endoscapes/endoscapes.zip"
ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "data" / "endoscapes"
SPLITS = ("train", "val", "test")
CHUNK_BYTES = 1024 * 1024
MAX_CACHED_CHUNKS = 16
IMAGE_WORKERS = 24


class RemoteRangeFile(io.RawIOBase):
    """Seekable HTTP range reader with a small chunk cache for ZIP access."""

    def __init__(self, url: str):
        self.url = url
        with urlopen(Request(url, method="HEAD"), timeout=60) as response:
            self.size = int(response.headers["Content-Length"])
            self.etag = response.headers.get("ETag", "")
            if "bytes" not in response.headers.get("Accept-Ranges", "").lower():
                raise RuntimeError("Official archive server does not advertise byte-range access")
        self.position = 0
        self._chunks: OrderedDict[int, bytes] = OrderedDict()

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.position

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        if whence == io.SEEK_SET:
            next_position = offset
        elif whence == io.SEEK_CUR:
            next_position = self.position + offset
        elif whence == io.SEEK_END:
            next_position = self.size + offset
        else:
            raise ValueError("invalid seek origin")
        if next_position < 0:
            raise ValueError("negative seek position")
        self.position = next_position
        return self.position

    def _chunk(self, start: int) -> bytes:
        cached = self._chunks.get(start)
        if cached is not None:
            self._chunks.move_to_end(start)
            return cached
        end = min(self.size, start + CHUNK_BYTES) - 1
        headers = {"Range": f"bytes={start}-{end}"}
        if self.etag:
            headers["If-Match"] = self.etag
        with urlopen(Request(self.url, headers=headers), timeout=120) as response:
            content_range = response.headers.get("Content-Range", "")
            if response.status != 206 or not content_range.startswith(f"bytes {start}-"):
                raise RuntimeError("Archive host did not honor a bounded byte-range request")
            remote_etag = response.headers.get("ETag", "")
            if self.etag and remote_etag and remote_etag != self.etag:
                raise RuntimeError("Official archive changed during acquisition")
            payload = response.read()
        if len(payload) != end - start + 1:
            raise RuntimeError(f"Short range response at byte {start}")
        self._chunks[start] = payload
        if len(self._chunks) > MAX_CACHED_CHUNKS:
            self._chunks.popitem(last=False)
        return payload

    def read(self, count: int = -1) -> bytes:
        if count < 0:
            count = self.size - self.position
        count = min(count, self.size - self.position)
        if count <= 0:
            return b""
        output = bytearray(count)
        written = 0
        while written < count:
            start = (self.position // CHUNK_BYTES) * CHUNK_BYTES
            chunk = self._chunk(start)
            offset = self.position - start
            take = min(count - written, len(chunk) - offset)
            output[written:written + take] = chunk[offset:offset + take]
            self.position += take
            written += take
        return bytes(output)


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_bounded(url: str, start: int, stop: int, etag: str) -> bytes:
    headers = {"Range": f"bytes={start}-{stop}"}
    if etag:
        headers["If-Match"] = etag
    with urlopen(Request(url, headers=headers), timeout=120) as response:
        content_range = response.headers.get("Content-Range", "")
        if response.status != 206 or not content_range.startswith(f"bytes {start}-"):
            raise RuntimeError(f"Archive host rejected bounded range bytes {start}-{stop}")
        remote_etag = response.headers.get("ETag", "")
        if etag and remote_etag and remote_etag != etag:
            raise RuntimeError("Official archive changed during acquisition")
        payload = response.read()
    if len(payload) != stop - start + 1:
        raise RuntimeError(f"Short range response at byte {start}")
    return payload


def read_member(archive: ZipFile, info, member_name: str) -> bytes:
    """Read and CRC-check one ZIP member using independent bounded ranges."""
    remote = archive.fp
    url = getattr(remote, "url", None)
    if not url:
        return archive.read(info)
    etag = getattr(remote, "etag", "")
    header_start = info.header_offset
    header = read_bounded(url, header_start, header_start + 1023, etag)
    if len(header) < 30:
        raise RuntimeError(f"Short local ZIP header for {member_name}")
    fields = struct.unpack("<IHHHHHIIIHH", header[:30])
    signature, flags, compression = fields[0], fields[2], fields[3]
    file_name_length, extra_length = fields[-2:]
    if signature != 0x04034B50 or flags & 0x1:
        raise RuntimeError(f"Invalid or encrypted ZIP member: {member_name}")
    file_name_bytes = header[30:30 + file_name_length]
    encoding = "utf-8" if flags & 0x800 else "cp437"
    if file_name_bytes.decode(encoding) != member_name or compression != info.compress_type:
        raise RuntimeError(f"ZIP local and central directories disagree for {member_name}")
    data_start = header_start + 30 + file_name_length + extra_length
    initial_offset = data_start - header_start
    initial = header[initial_offset:]
    initial = initial[:info.compress_size]
    if len(initial) < info.compress_size:
        remainder_start = data_start + len(initial)
        compressed = initial + read_bounded(url, remainder_start,
                                            data_start + info.compress_size - 1, etag)
    else:
        compressed = initial
    decompressor = zipfile._get_decompressor(info.compress_type)
    if decompressor is None:
        payload = compressed
    else:
        payload = decompressor.decompress(compressed)
        if hasattr(decompressor, "flush"):
            payload += decompressor.flush()
    if len(payload) != info.file_size or binascii.crc32(payload) & 0xFFFFFFFF != info.CRC:
        raise RuntimeError(f"ZIP size or CRC validation failed for {member_name}")
    return payload


def save_immutable(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != payload:
            raise RuntimeError(f"Refusing to replace different source content: {path}")
        return
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as output:
            output.write(payload)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def _records_for_split(archive: ZipFile, split: str) -> dict:
    annotation_member = f"endoscapes/{split}/annotation_coco.json"
    raw_json = archive.read(archive.getinfo(annotation_member))
    coco = json.loads(raw_json)
    images_by_id = {item.get("id"): item for item in coco.get("images", [])}
    annotations_by_image: dict[int, list[dict]] = {}
    for annotation in coco.get("annotations", []):
        image_id = annotation.get("image_id")
        if isinstance(image_id, int):
            annotations_by_image.setdefault(image_id, []).append(annotation)

    images = coco.get("images", [])

    def acquire(image: dict) -> dict:
        file_name = image.get("file_name")
        image_id = image.get("id")
        if not isinstance(file_name, str) or Path(file_name).name != file_name or not file_name.endswith(".jpg"):
            raise RuntimeError(f"Unsafe or unsupported COCO image name in {split}: {file_name!r}")
        if not isinstance(image_id, int) or image_id not in images_by_id:
            raise RuntimeError(f"Invalid COCO image identity in {split}: {file_name}")
        width, height, video_id = image.get("width"), image.get("height"), image.get("video_id")
        if not all(isinstance(value, int) and value > 0 for value in (width, height, video_id)):
            raise RuntimeError(f"Invalid image dimensions or video identity for {split}/{file_name}")
        member = f"endoscapes/{split}/{file_name}"
        info = archive.getinfo(member)
        image_path = DATA_ROOT / split / file_name
        if image_path.exists():
            raw_image = image_path.read_bytes()
            if len(raw_image) != info.file_size or binascii.crc32(raw_image) & 0xFFFFFFFF != info.CRC:
                raise RuntimeError(f"Installed image differs from the official ZIP member: {image_path}")
        else:
            raw_image = read_member(archive, info, member)
            save_immutable(image_path, raw_image)
        annotations = annotations_by_image.get(image_id, [])
        return {
            "file_name": file_name,
            "image_id": image_id,
            "video_id": video_id,
            "frame_number_from_filename": int(Path(file_name).stem.split("_")[1]),
            "width": width,
            "height": height,
            "size_bytes": len(raw_image),
            "sha256": sha256(raw_image),
            "annotations_count": len(annotations),
            "segmentation_count": sum(isinstance(item.get("segmentation"), dict) for item in annotations),
        }

    records = []
    with ThreadPoolExecutor(max_workers=IMAGE_WORKERS) as executor:
        futures = [executor.submit(acquire, image) for image in images]
        for future in as_completed(futures):
            records.append(future.result())
            if len(records) % 50 == 0 or len(records) == len(images):
                print(f"{split}: acquired {len(records)}/{len(images)} annotated keyframes", flush=True)
    annotation_path = DATA_ROOT / split / "annotation_coco.json"
    save_immutable(annotation_path, raw_json)
    return {
        "annotation_member_path": annotation_member,
        "annotation_sha256": sha256(raw_json),
        "annotation_size_bytes": len(raw_json),
        "image_count": len(records),
        "images": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", choices=(*SPLITS, "all"), default="all")
    parser.add_argument("--archive", type=Path, help="Use an already-downloaded official ZIP instead of HTTP byte ranges")
    args = parser.parse_args()
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    previous_path = DATA_ROOT / "medforge-source-manifest.json"
    previous = json.loads(previous_path.read_text(encoding="utf8")) if previous_path.exists() else {}
    selected = SPLITS if args.split == "all" else (args.split,)

    archive_path = args.archive or DATA_ROOT / "endoscapes-source-archive.zip"
    if archive_path.is_file():
        remote = archive_path
        archive_etag = previous.get("archive_etag", "")
        archive_size = archive_path.stat().st_size
        archive_sha256 = sha256_file(archive_path)
    else:
        remote = RemoteRangeFile(URL)
        archive_etag = remote.etag
        archive_size = remote.size
        archive_sha256 = previous.get("archive_sha256")
    previous_etag = previous.get("archive_etag")
    if previous_etag and previous_etag != archive_etag:
        raise RuntimeError("Official archive ETag changed; use a new versioned data root for the new release")

    with ZipFile(remote) as archive:
        split_records = dict(previous.get("splits", {}))
        for split in selected:
            split_records[split] = _records_for_split(archive, split)

    manifest = {
        "schema": "medforge.source-manifest.endoscapes.v3",
        "dataset": "Endoscapes-BBox201",
        "release": "Endoscapes2023",
        "source_url": "https://github.com/CAMMA-public/Endoscapes",
        "citation": "Murali A, et al. The Endoscapes Dataset for Surgical Scene Segmentation, Object Detection, and Critical View of Safety Assessment: Official Splits and Benchmark. arXiv:2312.12429 (2023).",
        "citation_url": "https://arxiv.org/abs/2312.12429",
        "archive_url": URL,
        "archive_etag": archive_etag,
        "archive_size_bytes": archive_size,
        "archive_sha256": archive_sha256,
        "license": "CC BY-NC-SA 4.0; non-commercial scientific research purposes",
        "not_for_redistribution": True,
        "splits": split_records,
    }
    temporary = previous_path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf8")
    os.replace(temporary, previous_path)
    print(json.dumps({
        "manifest": str(previous_path),
        "archive_etag": archive_etag,
        "splits": {split: {"frames": len(split_records[split]["images"]),
                           "annotation_sha256": split_records[split]["annotation_sha256"]}
                   for split in selected},
        "total_installed_frames": sum(len(value["images"]) for value in split_records.values()),
    }, indent=2))


if __name__ == "__main__":
    main()
