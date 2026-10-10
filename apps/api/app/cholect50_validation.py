"""Verified access to the public CholecT50 challenge-validation images and labels."""
from __future__ import annotations

from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import struct
from typing import Any

from .schemas import CholecT50FrameRecord, CholecT50TripletAnnotation, CholecT50VideoRecord

SOURCE_URL = "https://github.com/CAMMA-public/cholect50/blob/master/docs/README-Downloads.md"
CITATION = "Nwoye et al., Rendezvous: Attention Mechanisms for the Recognition of Surgical Action Triplets in Endoscopic Videos, Medical Image Analysis 78 (2022), 102433. doi:10.1016/j.media.2022.102433"
LICENSE = "CC BY-NC-SA 4.0"
MANIFEST_SCHEMA = "medforge.source-manifest.cholect50-challenge-validation.v1"
ROOT = Path(__file__).resolve().parents[3]


def root_dir() -> Path | None:
    configured = os.environ.get("MEDFORGE_CHOLECT50_VALIDATION_ROOT", "").strip()
    root = Path(configured).expanduser().resolve() if configured else ROOT / "data" / "cholect50" / "challenge-validation"
    return root if root.is_dir() else None


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


@lru_cache(maxsize=4096)
def _cached_sha256(path_string: str, size: int, modified_ns: int) -> str:
    del size, modified_ns
    return _sha256(Path(path_string))


def _manifest_signature(root: Path) -> tuple[Any, ...] | None:
    path = root / "medforge-source-manifest.json"
    try:
        stat = path.stat()
    except OSError:
        return None
    return str(path), stat.st_size, stat.st_mtime_ns


@lru_cache(maxsize=4)
def _load_install(signature: tuple[Any, ...]) -> dict[str, Any] | None:
    manifest_path = Path(signature[0])
    root = manifest_path.parent
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (manifest.get("schema") != MANIFEST_SCHEMA
                or manifest.get("dataset") != "CholecT50 Challenge Validation"
                or manifest.get("license") != LICENSE
                or manifest.get("sampling_fps") != 1):
            return None
        archive_sha = manifest.get("archive_sha256")
        if not isinstance(archive_sha, str) or not re.fullmatch(r"[a-f0-9]{64}", archive_sha):
            return None
        archive_path = root.parent / "challenge-validation.zip"
        archive_size = manifest.get("archive_size_bytes")
        archive_stat = archive_path.stat()
        if (not isinstance(archive_size, int) or archive_stat.st_size != archive_size
                or _cached_sha256(str(archive_path), archive_stat.st_size, archive_stat.st_mtime_ns) != archive_sha):
            return None
        raw_files = manifest.get("files")
        if not isinstance(raw_files, list):
            return None
        files: dict[str, dict[str, Any]] = {}
        for entry in raw_files:
            if not isinstance(entry, dict):
                return None
            relative = PurePosixPath(entry.get("path", ""))
            digest = entry.get("sha256")
            size = entry.get("size_bytes")
            if (relative.is_absolute() or ".." in relative.parts or not relative.parts
                    or relative.parts[0] != "cholect50-challenge-val"
                    or not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest)
                    or not isinstance(size, int) or size < 0 or relative.as_posix() in files):
                return None
            path = root.joinpath(*relative.parts).resolve(strict=True)
            path.relative_to(root.resolve())
            if not path.is_file() or path.stat().st_size != size:
                return None
            files[relative.as_posix()] = {"path": path, "sha256": digest, "size_bytes": size}
        dataset_root = (root / "cholect50-challenge-val").resolve(strict=True)
        if dataset_root.parent != root.resolve():
            return None
        label_paths = sorted(dataset_root.glob("labels/VID*.json"))
        if len(label_paths) != 5:
            return None
        videos: dict[str, dict[str, Any]] = {}
        for label_path in label_paths:
            video_id = label_path.stem
            if not re.fullmatch(r"VID\d{2}", video_id):
                return None
            label_key = label_path.relative_to(root).as_posix()
            label_file = files.get(label_key)
            if label_file is None or _sha256(label_file["path"]) != label_file["sha256"]:
                return None
            source = json.loads(label_path.read_text(encoding="utf-8"))
            if source.get("video") != int(video_id[3:]) or source.get("fps") != 1:
                return None
            categories = source.get("categories")
            annotations = source.get("annotations")
            if not isinstance(categories, dict) or not isinstance(annotations, dict):
                return None
            triplets = categories.get("triplet")
            phases = categories.get("phase")
            if not isinstance(triplets, dict) or not isinstance(phases, dict):
                return None
            frame_dir = dataset_root / "videos" / video_id
            frame_files = sorted(frame_dir.glob("[0-9][0-9][0-9][0-9][0-9][0-9].png"))
            if not frame_files:
                return None
            inventory: dict[int, dict[str, Any]] = {}
            for frame_path in frame_files:
                frame_number = int(frame_path.stem)
                frame_key = frame_path.relative_to(root).as_posix()
                entry = files.get(frame_key)
                if entry is None:
                    return None
                inventory[frame_number] = entry
            for frame_key, rows in annotations.items():
                if not isinstance(frame_key, str) or not frame_key.isdigit() or int(frame_key) not in inventory:
                    return None
                if not isinstance(rows, list):
                    return None
                for row in rows:
                    if not isinstance(row, list) or len(row) != 15:
                        return None
            videos[video_id] = {
                "source": source,
                "label_path": label_file["path"],
                "label_sha256": label_file["sha256"],
                "triplets": triplets,
                "phases": phases,
                "annotations": annotations,
                "frame_inventory": inventory,
                "archive_sha256": archive_sha,
            }
        return {"root": root, "dataset_root": dataset_root, "files": files, "videos": videos, "manifest": manifest}
    except (OSError, ValueError, TypeError, KeyError, RuntimeError, json.JSONDecodeError):
        return None


def _current() -> dict[str, Any] | None:
    root = root_dir()
    signature = _manifest_signature(root) if root else None
    return _load_install(signature) if signature else None


def video_records() -> list[CholecT50VideoRecord]:
    install = _current()
    if install is None:
        return []
    records = []
    for video_id, data in sorted(install["videos"].items()):
        inventory = data["frame_inventory"]
        records.append(CholecT50VideoRecord(
            video_id=video_id,
            dataset_id="CholecT50 Challenge Validation",
            procedure_label="Laparoscopic cholecystectomy",
            sampling_fps=1.0,
            sampled_frame_count=len(inventory),
            annotated_frame_count=len(data["annotations"]),
            first_frame_number=min(inventory),
            last_frame_number=max(inventory),
            source_url=SOURCE_URL,
            license_label=LICENSE,
            citation=CITATION,
            sha256=data["archive_sha256"],
            limitations=[
                "The official validation bundle contains selected 1 fps still frames, not continuous video footage.",
                "Boxes and action labels are source reference annotations, not model predictions.",
                "Frame samples can be sparse; only published frame IDs are shown and no missing frames or timestamps are interpolated.",
                "Non-commercial use only; redistribute derivatives under CC BY-NC-SA 4.0 with attribution.",
            ],
        ))
    return records


def frame_records(video_id: str) -> list[CholecT50FrameRecord] | None:
    install = _current()
    if install is None or not re.fullmatch(r"VID\d{2}", video_id):
        return None
    video = install["videos"].get(video_id)
    if video is None:
        return None
    source = video["source"]
    fps = float(source["fps"])
    frame_records: list[CholecT50FrameRecord] = []
    for frame_number, image_entry in sorted(video["frame_inventory"].items()):
        image_path = image_entry["path"]
        image_stat = image_path.stat()
        image_hash = _cached_sha256(str(image_path), image_stat.st_size, image_stat.st_mtime_ns)
        if image_hash != image_entry["sha256"]:
            return None
        with image_path.open("rb") as stream:
            header = stream.read(24)
        if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
            return None
        width, height = struct.unpack(">II", header[16:24])
        raw_rows = video["annotations"].get(str(frame_number), [])
        annotations: list[CholecT50TripletAnnotation] = []
        phase_label: str | None = None
        for row in raw_rows:
            triplet_id = int(row[0])
            if triplet_id < 0:
                continue
            triplet_label = video["triplets"].get(str(triplet_id))
            if not isinstance(triplet_label, str):
                return None
            components = [item.strip() for item in triplet_label.split(",")]
            if len(components) != 3 or not all(components):
                return None
            phase_id = int(row[14])
            if phase_id >= 0:
                candidate_phase = video["phases"].get(str(phase_id))
                if not isinstance(candidate_phase, str):
                    return None
                phase_label = candidate_phase
            bbox: tuple[float, float, float, float] | None = None
            coordinates = [float(value) for value in row[3:7]]
            if all(value >= 0 for value in coordinates):
                x, y, box_width, box_height = coordinates
                # A few published boxes cross the source image edge by about one percent.
                # Preserve their exact source coordinates; the SVG viewport clips the visible edge.
                if (x > 1 or y > 1 or box_width <= 0 or box_height <= 0
                        or x + box_width > 1.02 or y + box_height > 1.02):
                    return None
                bbox = (x * width, y * height, box_width * width, box_height * height)
            score = float(row[2])
            if not 0 <= score <= 1:
                return None
            annotations.append(CholecT50TripletAnnotation(
                triplet_id=triplet_id,
                triplet_label=triplet_label,
                instrument_label=components[0],
                verb_label=components[1],
                target_label=components[2],
                confidence=score,
                bbox_xywh_px=bbox,
            ))
        frame_records.append(CholecT50FrameRecord(
            frame_id=f"{video_id}:{frame_number}",
            video_id=video_id,
            frame_number=frame_number,
            sample_time_sec=frame_number / fps,
            sampling_fps=fps,
            width=width,
            height=height,
            image_sha256=image_hash,
            annotation_sha256=video["label_sha256"],
            image_url=f"/api/v1/surgivision/cholect50/{video_id}/frames/{frame_number}/image",
            phase_label=phase_label,
            annotations=annotations,
        ))
    return frame_records


def image_path(video_id: str, frame_number: int) -> Path | None:
    install = _current()
    if install is None or not re.fullmatch(r"VID\d{2}", video_id):
        return None
    video = install["videos"].get(video_id)
    entry = video["frame_inventory"].get(frame_number) if video else None
    if entry is None:
        return None
    path = entry["path"]
    stat = path.stat()
    if _cached_sha256(str(path), stat.st_size, stat.st_mtime_ns) != entry["sha256"]:
        return None
    return path
