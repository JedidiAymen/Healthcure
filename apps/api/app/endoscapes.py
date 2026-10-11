"""Validated access to locally installed Endoscapes research frames."""
from __future__ import annotations

import copy
from functools import lru_cache
import hashlib
import json
import math
import os
from pathlib import Path
import re
import threading
import time
from typing import Any
from urllib.parse import unquote

from .schemas import Case, SurgicalAnnotation, SurgicalFrameRecord

SOURCE_URL = "https://github.com/CAMMA-public/Endoscapes"
CVS_CRITERIA = (
    ("two_structures", "Two structures visualized"),
    ("hepatocystic_triangle", "Hepatocystic triangle cleared"),
    ("cystic_plate", "Cystic plate visualized"),
)


def root_dir() -> Path | None:
    value = os.environ.get("MEDFORGE_ENDOSCAPES_ROOT", "").strip()
    if not value:
        return None
    root = Path(value).expanduser().resolve()
    return root if root.is_dir() else None


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@lru_cache(maxsize=10000)
def _cached_sha256(path_string: str, size: int, modified_ns: int) -> str:
    """Hash each local image once per observed file version."""
    del size, modified_ns  # Included in the cache key so edits invalidate the entry.
    return _sha256(Path(path_string))


def _manifest_signature(root: Path) -> tuple[Any, ...] | None:
    manifest_path = root / "medforge-source-manifest.json"
    if not manifest_path.is_file():
        return None
    manifest_stat = manifest_path.stat()
    annotations = []
    for annotation_path in sorted(root.glob("*/annotation_coco.json")):
        stat = annotation_path.stat()
        annotations.append((str(annotation_path), stat.st_size, stat.st_mtime_ns))
    return (str(manifest_path), manifest_stat.st_size, manifest_stat.st_mtime_ns, tuple(annotations))


@lru_cache(maxsize=6)
def _load_index(signature: tuple[Any, ...]) -> dict[str, Any] | None:
    manifest_path = Path(signature[0])
    root = manifest_path.parent
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf8"))
        if manifest.get("dataset") != "Endoscapes-BBox201":
            return None
        split_manifests = manifest.get("splits")
        if not isinstance(split_manifests, dict):
            # Read existing v2 curated installs while they are upgraded.
            split = manifest.get("split")
            if split not in ("train", "val", "test"):
                return None
            image_meta = manifest.get("images")
            if not isinstance(image_meta, list):
                old_image = manifest.get("image")
                image_meta = [old_image] if isinstance(old_image, dict) else []
            split_manifests = {split: {"images": image_meta,
                                       "annotation_sha256": manifest.get("annotation_sha256")
                                       or (manifest.get("image") or {}).get("annotation_sha256")}}
        result: dict[str, Any] = {"root": root, "splits": {}}
        for split, split_meta in split_manifests.items():
            if split not in ("train", "val", "test") or not isinstance(split_meta, dict):
                continue
            split_dir = (root / split).resolve()
            if split_dir.parent != root.resolve():
                continue
            annotation_path = (split_dir / "annotation_coco.json").resolve()
            if annotation_path.parent != split_dir or not annotation_path.is_file():
                continue
            expected_annotation_hash = split_meta.get("annotation_sha256")
            if not isinstance(expected_annotation_hash, str) or _sha256(annotation_path) != expected_annotation_hash:
                continue
            coco = json.loads(annotation_path.read_text(encoding="utf8"))
            images = {item.get("id"): item for item in coco.get("images", []) if isinstance(item, dict)}
            categories = {item.get("id"): item.get("name") for item in coco.get("categories", []) if isinstance(item, dict)}
            annotations: dict[int, list[dict]] = {}
            for item in coco.get("annotations", []):
                if isinstance(item, dict) and isinstance(item.get("image_id"), int):
                    annotations.setdefault(item["image_id"], []).append(item)
            metas = split_meta.get("images")
            if not isinstance(metas, list):
                continue
            by_name: dict[str, dict[str, Any]] = {}
            for meta in metas:
                if not isinstance(meta, dict):
                    continue
                name, image_id = meta.get("file_name"), meta.get("image_id")
                if not isinstance(name, str) or Path(name).name != name or not name.endswith(".jpg"):
                    continue
                if not isinstance(image_id, int) or image_id in images and images[image_id].get("file_name") != name:
                    continue
                image = images.get(image_id)
                if not isinstance(image, dict) or image.get("file_name") != name:
                    continue
                if (image.get("width"), image.get("height")) != (meta.get("width"), meta.get("height")):
                    continue
                if image.get("video_id") != meta.get("video_id"):
                    continue
                by_name[name] = {"split": split, "meta": meta, "image": image,
                                 "annotations": annotations.get(image_id, []),
                                 "categories": categories,
                                 "annotation_sha256": expected_annotation_hash,
                                 "split_dir": split_dir}
            result["splits"][split] = by_name
        return result
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError):
        return None


def _index() -> dict[str, Any] | None:
    root = root_dir()
    if root is None:
        return None
    signature = _manifest_signature(root)
    return _load_index(signature) if signature else None


def _sampled_signature(root: Path) -> tuple[Any, ...] | None:
    manifest_path = root / "medforge-full-release-manifest.json"
    file_manifest = root / "medforge-full-release-files.jsonl"
    if not manifest_path.is_file() or not file_manifest.is_file():
        return None
    watched = [manifest_path, file_manifest]
    watched.extend(sorted(root.glob("*/annotation_coco_vid.json")))
    stats = tuple((str(path), path.stat().st_size, path.stat().st_mtime_ns) for path in watched)
    return stats


@lru_cache(maxsize=4)
def _load_sampled_index(signature: tuple[Any, ...]) -> dict[str, Any] | None:
    """Load the complete 1 fps inventory only from the sealed full-release manifest."""
    manifest_path = Path(signature[0][0])
    root = manifest_path.parent
    file_manifest_path = Path(signature[1][0])
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf8"))
        if manifest.get("schema") != "medforge.source-manifest.endoscapes-full-release.v1":
            return None
        if manifest.get("file_manifest") != file_manifest_path.name:
            return None
        if _sha256(file_manifest_path) != manifest.get("file_manifest_sha256"):
            return None
        if manifest.get("media_scope") != "Sampled still frames and source annotations; not encoded continuous video.":
            return None

        files: dict[str, dict[str, Any]] = {}
        records_by_path: dict[str, dict[str, Any]] = {}
        line_count = 0
        with file_manifest_path.open("r", encoding="utf8") as stream:
            for line in stream:
                item = json.loads(line)
                member = item.get("path")
                if not isinstance(member, str) or not member.startswith("endoscapes/"):
                    return None
                line_count += 1
                records_by_path[member] = item
                parts = Path(member).parts
                if len(parts) == 3 and parts[1] in ("train", "val", "test") and parts[2].endswith(".jpg"):
                    if not isinstance(item.get("size_bytes"), int) or not isinstance(item.get("sha256"), str):
                        return None
                    files[f"{parts[1]}/{parts[2]}"] = item
        if line_count != manifest.get("installed_files"):
            return None

        result: dict[str, Any] = {"root": root, "splits": {}}
        for split in ("train", "val", "test"):
            annotation_path = root / split / "annotation_coco_vid.json"
            if not annotation_path.is_file():
                continue
            annotation_record = records_by_path.get(f"endoscapes/{split}/annotation_coco_vid.json")
            if annotation_record is None or _sha256(annotation_path) != annotation_record.get("sha256"):
                continue
            coco = json.loads(annotation_path.read_text(encoding="utf8"))
            source_fps = {}
            for video in coco.get("videos", []):
                if not isinstance(video, dict):
                    continue
                try:
                    candidate_id = int(video.get("id"))
                    candidate_fps = float(video.get("fps"))
                except (TypeError, ValueError):
                    continue
                if candidate_id > 0 and math.isfinite(candidate_fps) and candidate_fps > 0:
                    source_fps[candidate_id] = candidate_fps
            videos: dict[int, list[dict[str, Any]]] = {}
            for image in coco.get("images", []):
                if not isinstance(image, dict):
                    continue
                name, video_id = image.get("file_name"), image.get("video_id")
                if not isinstance(name, str) or Path(name).name != name or not name.endswith(".jpg"):
                    continue
                if isinstance(video_id, bool) or not isinstance(video_id, int) or video_id <= 0:
                    continue
                if any(not isinstance(image.get(key), int) or image[key] <= 0 for key in ("width", "height")):
                    continue
                file_record = files.get(f"{split}/{name}")
                if file_record is None:
                    continue
                try:
                    frame_number = int(Path(name).stem.split("_")[1])
                except (ValueError, IndexError):
                    continue
                videos.setdefault(video_id, []).append({
                    "file_name": name,
                    "video_id": video_id,
                    "sampling_fps": source_fps.get(video_id),
                    "frame_number": frame_number,
                    "width": image["width"],
                    "height": image["height"],
                    "size_bytes": file_record["size_bytes"],
                    "sha256": file_record["sha256"],
                    "annotation_sha256": annotation_record["sha256"],
                    "split": split,
                })
            for frames in videos.values():
                frames.sort(key=lambda item: item["frame_number"])
            result["splits"][split] = videos
        return result
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError):
        return None


def _sampled_index() -> dict[str, Any] | None:
    root = root_dir()
    if root is None:
        return None
    signature = _sampled_signature(root)
    return _load_sampled_index(signature) if signature else None


def sampled_frame_count(split: str, video_id: int) -> int:
    index = _sampled_index()
    if index is None or split not in ("train", "val", "test"):
        return 0
    return len(index["splits"].get(split, {}).get(video_id, []))


def sampled_video_catalog() -> list[dict[str, Any]]:
    """Return source-validated 1 fps video summaries without hashing every frame."""
    index = _sampled_index()
    if index is None:
        return []
    catalog = []
    for split in ("train", "val", "test"):
        for video_id, frames in index["splits"].get(split, {}).items():
            if not frames:
                continue
            catalog.append({
                "split": split,
                "video_id": video_id,
                "sampling_fps": frames[0].get("sampling_fps"),
                "frame_count": len(frames),
                "first_frame_id": f"endoscapes:{split}:{Path(frames[0]['file_name']).stem}",
                "last_frame_id": f"endoscapes:{split}:{Path(frames[-1]['file_name']).stem}",
            })
    return catalog


def sampled_sequence_frames(split: str, video_id: int) -> list[dict[str, Any]]:
    """Return the official sampled-frame inventory for one video, with 1 fps semantics."""
    index = _sampled_index()
    if index is None or split not in ("train", "val", "test"):
        return []
    frames = index["splits"].get(split, {}).get(video_id, [])
    result = []
    for position, frame in enumerate(frames):
        image_path = index["root"] / split / frame["file_name"]
        if not image_path.is_file():
            continue
        stat = image_path.stat()
        if stat.st_size != frame["size_bytes"] or _cached_sha256(str(image_path), stat.st_size, stat.st_mtime_ns) != frame["sha256"]:
            continue
        result.append({
            "id": f"endoscapes:{split}:{Path(frame['file_name']).stem}",
            "split": split,
            "video_id": video_id,
            "sequence_position": position,
            "frame_number": frame["frame_number"],
            "width": frame["width"],
            "height": frame["height"],
            "image_sha256": frame["sha256"],
        })
    return result


def _sampled_frame(frame_id: str) -> SurgicalFrameRecord | None:
    try:
        frame_id = unquote(frame_id, errors="strict")
    except UnicodeDecodeError:
        return None
    match = re.fullmatch(r"endoscapes:(train|val|test):(\d+_\d+)", frame_id)
    if match is None:
        return None
    split, stem = match.groups()
    index = _sampled_index()
    if index is None:
        return None
    for frames in index["splits"].get(split, {}).values():
        frame = next((item for item in frames if Path(item["file_name"]).stem == stem), None)
        if frame is None:
            continue
        image_path = index["root"] / split / frame["file_name"]
        if not image_path.is_file():
            return None
        stat = image_path.stat()
        image_hash = _cached_sha256(str(image_path), stat.st_size, stat.st_mtime_ns)
        if stat.st_size != frame["size_bytes"] or image_hash != frame["sha256"]:
            return None
        return SurgicalFrameRecord(
            id=frame_id, dataset_id="Endoscapes2023", split=split,
            video_id=frame["video_id"], frame_number=frame["frame_number"],
            file_name=frame["file_name"], width=frame["width"], height=frame["height"],
            image_sha256=image_hash, annotation_sha256=frame["annotation_sha256"],
            annotations=[], cvs_criteria=(), image_path=str(image_path),
        )
    return None


def _valid_image(entry: dict[str, Any]) -> tuple[Path, str] | None:
    split_dir: Path = entry["split_dir"]
    file_name = entry["meta"].get("file_name")
    if not isinstance(file_name, str) or Path(file_name).name != file_name:
        return None
    image_path = (split_dir / file_name).resolve()
    if image_path.parent != split_dir or not image_path.is_file():
        return None
    try:
        stat = image_path.stat()
        expected_size = entry["meta"].get("size_bytes")
        if isinstance(expected_size, int) and stat.st_size != expected_size:
            return None
        image_hash = _cached_sha256(str(image_path), stat.st_size, stat.st_mtime_ns)
        if image_hash != entry["meta"].get("sha256"):
            return None
        return image_path, image_hash
    except OSError:
        return None


def _safe_annotations(entry: dict[str, Any], width: int, height: int) -> list[SurgicalAnnotation] | None:
    safe: list[SurgicalAnnotation] = []
    try:
        for item in entry["annotations"]:
            box = item.get("bbox")
            if not isinstance(box, list) or len(box) != 4:
                return None
            x, y, box_width, box_height = (float(value) for value in box)
            if not all(0 <= value < 100000 for value in (x, y, box_width, box_height)):
                return None
            if x + box_width > width + 1 or y + box_height > height + 1:
                return None
            category_id = int(item["category_id"])
            category_name = entry["categories"].get(category_id)
            if not isinstance(category_name, str):
                return None
            safe.append(SurgicalAnnotation(
                id=int(item["id"]), category_id=category_id,
                category_name=category_name, bbox=(x, y, box_width, box_height),
                segmentation=item.get("segmentation"),
            ))
        return safe
    except (ValueError, KeyError, TypeError, IndexError):
        return None


def _record(entry: dict[str, Any]) -> SurgicalFrameRecord | None:
    validated = _valid_image(entry)
    if validated is None:
        return None
    image_path, image_hash = validated
    image = entry["image"]
    try:
        width, height = int(image["width"]), int(image["height"])
        frame_number = int(image_path.stem.split("_")[1])
        video_id = int(image["video_id"])
        cvs = tuple(float(value) for value in image.get("ds", []))
    except (ValueError, KeyError, TypeError, IndexError):
        return None
    annotations = _safe_annotations(entry, width, height)
    if annotations is None:
        return None
    return SurgicalFrameRecord(
        id=f"endoscapes:{entry['split']}:{image_path.stem}", dataset_id="Endoscapes-BBox201",
        split=entry["split"], video_id=video_id, frame_number=frame_number,
        file_name=image_path.name, width=width, height=height, image_sha256=image_hash,
        annotation_sha256=entry["annotation_sha256"], annotations=annotations,
        cvs_criteria=cvs, image_path=str(image_path),
    )


def _installed_frames_uncached() -> list[SurgicalFrameRecord]:
    index = _index()
    if index is None:
        return []
    result = []
    for split in ("train", "val", "test"):
        for entry in index["splits"].get(split, {}).values():
            record = _record(entry)
            if record is not None:
                result.append(record)
    return sorted(result, key=lambda frame: (frame.video_id, frame.frame_number))


def _cvs_label_coverage_uncached() -> dict[str, Any] | None:
    index = _index()
    if index is None:
        return None

    def blank_counts() -> list[dict[str, Any]]:
        return [
            {
                "criterion_id": criterion_id,
                "criterion_label": label,
                "labelled_frames": 0,
                "mean_zero_frames": 0,
                "fractional_mean_frames": 0,
                "mean_one_frames": 0,
            }
            for criterion_id, label in CVS_CRITERIA
        ]

    totals = blank_counts()
    splits: list[dict[str, Any]] = []
    total_verified = 0
    total_complete = 0
    for split in ("train", "val", "test"):
        entries = index["splits"].get(split, {})
        if not entries:
            continue
        verified = 0
        complete = 0
        criterion_counts = blank_counts()
        annotation_hash = next(iter(entries.values()))["annotation_sha256"]
        for entry in entries.values():
            if _valid_image(entry) is None:
                continue
            verified += 1
            values = entry["image"].get("ds")
            if not isinstance(values, list) or len(values) != len(CVS_CRITERIA):
                continue
            valid = True
            for value in values:
                if (
                    isinstance(value, bool)
                    or not isinstance(value, (int, float))
                    or not math.isfinite(value)
                    or not 0 <= value <= 1
                ):
                    valid = False
                    break
            if not valid:
                continue
            complete += 1
            for counts, value in zip(criterion_counts, values, strict=True):
                counts["labelled_frames"] += 1
                counts["mean_zero_frames" if value == 0 else "mean_one_frames" if value == 1 else "fractional_mean_frames"] += 1

        total_verified += verified
        total_complete += complete
        for total, current in zip(totals, criterion_counts, strict=True):
            for key in ("labelled_frames", "mean_zero_frames", "fractional_mean_frames", "mean_one_frames"):
                total[key] += current[key]
        splits.append({
            "split": split,
            "verified_frames": verified,
            "complete_label_frames": complete,
            "annotation_sha256": annotation_hash,
            "criteria": criterion_counts,
        })

    if not splits:
        return None
    return {
        "dataset_id": "Endoscapes-BBox201",
        "source_url": SOURCE_URL,
        "verified_frames": total_verified,
        "complete_label_frames": total_complete,
        "criteria": totals,
        "splits": splits,
        "interpretation_note": (
            "Official Endoscapes documentation defines each image-level CVS value as the mean of three annotators; "
            "fractional means indicate disagreement. These aggregate counts do not expose individual votes or indicate surgical clearance."
        ),
    }


def installed_frame(frame_id: str | None = None) -> SurgicalFrameRecord | None:
    """Validate one selected frame without hashing or materializing its neighbors."""
    index = _index()
    if index is None:
        return _sampled_frame(frame_id or "")
    selected_split = None
    selected_name = frame_id
    if frame_id:
        try:
            frame_id = unquote(frame_id, errors="strict")
        except UnicodeDecodeError:
            return None
        full_id = re.fullmatch(r"endoscapes:(train|val|test):(\d+_\d+)", frame_id)
        split_id = re.fullmatch(r"(train|val|test):(\d+_\d+)", frame_id)
        bare_id = re.fullmatch(r"\d+_\d+", frame_id)
        if full_id:
            selected_split, selected_name = full_id.groups()
            selected_name = f"{selected_name}.jpg"
        elif split_id:
            selected_split, selected_name = split_id.groups()
            frame_id = f"endoscapes:{selected_split}:{selected_name}"
            selected_name = f"{selected_name}.jpg"
        elif bare_id:
            selected_name = f"{frame_id}.jpg"
        else:
            return None
    if selected_name:
        splits = [selected_split] if selected_split in ("train", "val", "test") else ("train", "val", "test")
        for split in splits:
            entry = index["splits"].get(split, {}).get(selected_name)
            if entry:
                return _record(entry)
        return _sampled_frame(frame_id or "")
    for split in ("train", "val", "test"):
        for entry in index["splits"].get(split, {}).values():
            record = _record(entry)
            if record is not None:
                return record
    return None


# Listing and summarising re-stat every image, which is slow on Docker Desktop bind mounts (about
# 10 to 20 s for 1,933 frames). Results are cached per manifest signature and served immediately;
# once older than the TTL they are refreshed in the background. Opening a single frame still
# re-verifies its path, size and SHA-256 through _record().
CASE_LIST_TTL_SECONDS = 300.0
_swr_cache: dict[str, tuple[Any, float, Any]] = {}
_swr_lock = threading.Lock()
_swr_refreshing: set[str] = set()


def _current_signature() -> tuple[Any, ...] | None:
    root = root_dir()
    return _manifest_signature(root) if root is not None else None


def _refresh(name: str, build, signature: tuple[Any, ...], background: bool) -> Any:
    try:
        value = build()
        with _swr_lock:
            _swr_cache[name] = (signature, time.monotonic(), value)
        return value
    finally:
        if background:
            with _swr_lock:
                _swr_refreshing.discard(name)


def _cached(name: str, build, empty: Any) -> Any:
    signature = _current_signature()
    if signature is None:
        return empty
    with _swr_lock:
        cached = _swr_cache.get(name)
        fresh_signature = cached is not None and cached[0] == signature
        start_refresh = (fresh_signature and time.monotonic() - cached[1] >= CASE_LIST_TTL_SECONDS
                         and name not in _swr_refreshing)
        if start_refresh:
            _swr_refreshing.add(name)
    if fresh_signature:
        if start_refresh:
            threading.Thread(target=_refresh, args=(name, build, signature, True), name=f"endoscapes-{name}-refresh", daemon=True).start()
        return cached[2]
    # Cold start or a changed manifest: build now.
    return _refresh(name, build, signature, False)


def clear_caches() -> None:
    with _swr_lock:
        _swr_cache.clear()


def warm_caches() -> None:
    installed_cases()
    installed_frames()
    cvs_label_coverage()


def installed_cases() -> list[Case]:
    """List case metadata without rebuilding annotation records for each row."""
    return list(_cached("cases", _list_cases_uncached, []))


def installed_frames() -> list[SurgicalFrameRecord]:
    """Return fully validated annotated frames for callers that need their labels."""
    return list(_cached("frames", _installed_frames_uncached, []))


def cvs_label_coverage() -> dict[str, Any] | None:
    """Summarize checksum-verified Endoscapes-BBox201 image-level CVS labels."""
    value = _cached("coverage", _cvs_label_coverage_uncached, None)
    return copy.deepcopy(value) if value is not None else None


def _list_cases_uncached() -> list[Case]:
    index = _index()
    if index is None:
        return []
    result: list[Case] = []
    for split in ("train", "val", "test"):
        for entry in index["splits"].get(split, {}).values():
            if _valid_image(entry) is None:
                continue
            image = entry["image"]
            file_name = entry["meta"]["file_name"]
            try:
                video_id = int(image["video_id"])
                frame_number = int(Path(file_name).stem.split("_")[1])
            except (ValueError, KeyError, IndexError):
                continue
            result.append(Case(
                id=f"endoscapes:{split}:{Path(file_name).stem}", module="surgivision",
                dataset_id="Endoscapes-BBox201", source_case_id=f"video-{video_id}:frame-{frame_number}",
                reference_kind="research", status="ready",
                label=f"Endoscapes {split} · video {video_id} · frame {frame_number}",
            ))
    return sorted(result, key=lambda case: case.id)


def case_record(frame: SurgicalFrameRecord) -> Case:
    return Case(
        id=frame.id, module="surgivision", dataset_id=frame.dataset_id,
        source_case_id=f"video-{frame.video_id}:frame-{frame.frame_number}",
        reference_kind="research", status="ready",
        label=f"Endoscapes {frame.split} · video {frame.video_id} · frame {frame.frame_number}",
    )
