"""Checksum-verified local access to the one-video Cholec80 sample."""
from __future__ import annotations

from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
from typing import Any

LICENSE_URL = "https://creativecommons.org/licenses/by-nc-sa/4.0/"
DATASET_URL = "https://camma.unistra.fr/datasets/"
ROOT = Path(__file__).resolve().parents[3]
ALLOWED_PHASES = {
    "Preparation", "CalotTriangleDissection", "ClippingCutting",
    "GallbladderDissection", "GallbladderRetraction", "CleaningCoagulation",
    "GallbladderPackaging",
}


def root_dir() -> Path | None:
    configured = os.environ.get("MEDFORGE_CHOLECT80_ROOT", "").strip()
    if configured:
        root = Path(configured).expanduser().resolve()
        return root if root.is_dir() else None
    local = ROOT / "data" / "cholec80"
    return local.resolve() if local.is_dir() else None


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_file(root: Path, relative_value: Any) -> Path:
    relative = PurePosixPath(relative_value if isinstance(relative_value, str) else "")
    if relative.is_absolute() or not relative.parts or ".." in relative.parts:
        raise ValueError("Unsafe relative path")
    path = (root / Path(*relative.parts)).resolve(strict=True)
    path.relative_to(root.resolve())
    if not path.is_file():
        raise ValueError("Source asset is not a file")
    return path


def _phase_intervals(path: Path, expected_frames: int) -> list[dict[str, int | str]]:
    intervals: list[dict[str, int | str]] = []
    previous_phase: str | None = None
    first_frame = 0
    last_frame = -1
    with path.open("r", encoding="utf8", newline="") as stream:
        header = stream.readline().rstrip("\r\n").split("\t")
        if header != ["Frame", "Phase"]:
            raise ValueError("Unexpected Cholec80 phase annotation header")
        for line_number, line in enumerate(stream, start=2):
            fields = line.rstrip("\r\n").split("\t")
            if len(fields) != 2:
                raise ValueError(f"Malformed phase annotation at line {line_number}")
            frame = int(fields[0])
            phase = fields[1]
            if frame != last_frame + 1 or phase not in ALLOWED_PHASES:
                raise ValueError(f"Invalid frame order or phase at line {line_number}")
            if previous_phase is not None and phase != previous_phase:
                intervals.append({"first_frame": first_frame, "last_frame": last_frame, "phase": previous_phase})
                first_frame = frame
            previous_phase = phase
            last_frame = frame
    if last_frame != expected_frames - 1 or previous_phase is None:
        raise ValueError("The source phase track does not cover the complete video frame range")
    intervals.append({"first_frame": first_frame, "last_frame": last_frame, "phase": previous_phase})
    return intervals


@lru_cache(maxsize=8)
def _load_record(signature: tuple[Any, ...]) -> tuple[dict[str, Any], Path] | None:
    manifest_path = Path(signature[0])
    root = manifest_path.parent
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf8"))
        if manifest.get("schema") != "medforge.source-manifest.cholect80-single-video.v1":
            return None
        if manifest.get("dataset") != "Cholec80" or manifest.get("license_url") != LICENSE_URL:
            return None
        clip_id = manifest.get("clip_id")
        if clip_id != "cholect80-video01":
            return None
        video = _safe_file(root, manifest.get("video_relative_path"))
        phase = _safe_file(root, manifest.get("phase_relative_path"))
        if video.stat().st_size != manifest.get("video_size_bytes") or _sha256(video) != manifest.get("video_sha256"):
            return None
        if phase.stat().st_size != manifest.get("phase_size_bytes") or _sha256(phase) != manifest.get("phase_sha256"):
            return None
        fps = float(manifest.get("video_fps") or 0)
        frame_count = int(manifest.get("video_frame_count") or 0)
        width = int(manifest.get("video_width") or 0)
        height = int(manifest.get("video_height") or 0)
        duration = float(manifest.get("video_duration_seconds") or 0)
        if fps != 25 or frame_count <= 0 or width <= 0 or height <= 0 or duration <= 0:
            return None
        track = _phase_intervals(phase, frame_count)
        record = {
            "clip_id": clip_id,
            "dataset_id": "Cholec80",
            "procedure_label": "Laparoscopic cholecystectomy",
            "media_kind": "native_video",
            "duration_sec": duration,
            "asset_uri": f"/api/v1/surgivision/clips/{clip_id}/video",
            "source_url": DATASET_URL,
            "license_label": "CC BY-NC-SA 4.0",
            "citation": manifest["citation"],
            "sha256": manifest["video_sha256"],
            "source_annotation": None,
            "frames_per_second": fps,
            "phase_track_sha256": manifest["phase_sha256"],
            "phase_track": track,
            "limitations": manifest.get("limitations", []),
        }
        return record, video
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError, RuntimeError):
        return None


def _current() -> tuple[dict[str, Any], Path] | None:
    root = root_dir()
    if root is None:
        return None
    manifest = root / "medforge-source-manifest.json"
    if not manifest.is_file():
        return None
    try:
        body = json.loads(manifest.read_text(encoding="utf8"))
        video = _safe_file(root, body.get("video_relative_path"))
        phase = _safe_file(root, body.get("phase_relative_path"))
        manifest_stat = manifest.stat()
        signature = (
            str(manifest), manifest_stat.st_size, manifest_stat.st_mtime_ns,
            str(video), video.stat().st_size, video.stat().st_mtime_ns,
            str(phase), phase.stat().st_size, phase.stat().st_mtime_ns,
        )
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return None
    return _load_record(signature)


def clip_record() -> dict[str, Any] | None:
    current = _current()
    return current[0] if current else None


def video_path(clip_id: str) -> Path | None:
    current = _current()
    if current is None or current[0]["clip_id"] != clip_id:
        return None
    return current[1]
