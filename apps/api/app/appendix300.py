"""Verified access to the optional public Appendix300 video excerpt."""
from __future__ import annotations

from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
from typing import Any

SOURCE_URL = "https://doi.org/10.25532/OPARA-1173"
PAPER_URL = "https://doi.org/10.1038/s41597-026-07593-6"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
ROOT = Path(__file__).resolve().parents[3]


def root_dir() -> Path | None:
    configured = os.environ.get("MEDFORGE_APPENDIX300_ROOT", "").strip()
    if configured:
        root = Path(configured).expanduser().resolve()
        return root if root.is_dir() else None
    shared = ROOT.parent / "medforge" / "data" / "appendix300"
    local = ROOT / "data" / "appendix300"
    for root in (shared, local):
        if root.is_dir():
            return root.resolve()
    return None


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@lru_cache(maxsize=8)
def _load_record(signature: tuple[Any, ...]) -> tuple[dict[str, Any], Path] | None:
    manifest_path = Path(signature[0])
    root = manifest_path.parent
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf8"))
        if manifest.get("schema") != "medforge.source-manifest.appendix300-single-clip.v1":
            return None
        if manifest.get("dataset") != "Appendix300" or manifest.get("license_url") != LICENSE_URL:
            return None
        relative = PurePosixPath(manifest.get("video_relative_path", ""))
        if relative.is_absolute() or not relative.parts or ".." in relative.parts:
            return None
        path = (root / Path(*relative.parts)).resolve(strict=True)
        path.relative_to(root.resolve())
        if not path.is_file() or path.stat().st_size != manifest.get("video_size_bytes"):
            return None
        if _sha256(path) != manifest.get("video_sha256"):
            return None
        record = {
            "clip_id": manifest["clip_id"],
            "dataset_id": "Appendix300",
            "procedure_label": manifest["procedure_label"],
            "media_kind": "native_video",
            "duration_sec": manifest.get("video_duration_seconds"),
            "asset_uri": f"/api/v1/surgivision/clips/{manifest['clip_id']}/video",
            "source_url": SOURCE_URL,
            "license_label": "CC BY 4.0",
            "citation": manifest["citation"],
            "sha256": manifest["video_sha256"],
            "limitations": [
                "This is laparoscopic appendectomy footage, not cholecystectomy.",
                "This excerpt has no instrument masks or phase labels.",
                "Only the locally checksum-verified public clip is installed.",
            ],
        }
        return record, path
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError, RuntimeError):
        return None


def _current() -> tuple[dict[str, Any], Path] | None:
    root = root_dir()
    if root is None:
        return None
    manifest = root / "medforge-source-manifest.json"
    if not manifest.is_file():
        return None
    file_path = ""
    try:
        body = json.loads(manifest.read_text(encoding="utf8"))
        file_path = str(root / body.get("video_relative_path", ""))
        path = Path(file_path)
        stats = path.stat()
        manifest_stat = manifest.stat()
        signature = (str(manifest), manifest_stat.st_size, manifest_stat.st_mtime_ns,
                     str(path), stats.st_size, stats.st_mtime_ns)
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return None
    return _load_record(signature)


def clip_record() -> dict[str, Any] | None:
    record = _current()
    return record[0] if record else None


def video_path(clip_id: str) -> Path | None:
    record = _current()
    if record is None or record[0]["clip_id"] != clip_id:
        return None
    return record[1]
