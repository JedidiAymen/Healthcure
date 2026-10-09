"""Validated access to locally installed Endoscapes research frames."""
from __future__ import annotations

from functools import lru_cache
import hashlib
import json
import math
import os
from pathlib import Path
import re
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


def installed_frames() -> list[SurgicalFrameRecord]:
    """Return fully validated annotated frames for callers that need their labels."""
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


def cvs_label_coverage() -> dict[str, Any] | None:
    """Summarize checksum-verified Endoscapes-BBox201 image-level CVS labels."""
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
        return None
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
        return None
    for split in ("train", "val", "test"):
        for entry in index["splits"].get(split, {}).values():
            record = _record(entry)
            if record is not None:
                return record
    return None


def installed_cases() -> list[Case]:
    """List case metadata without rebuilding annotation records for each row."""
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
