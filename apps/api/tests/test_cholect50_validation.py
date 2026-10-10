"""Source identity, exact-frame annotations, and hash rejection for CholecT50."""
import hashlib
import json
from pathlib import Path
import struct
import sys
import zlib

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import pytest

from app import cholect50_validation
from app.main import create_app


def _png(width: int = 100, height: int = 50) -> bytes:
    def chunk(kind: bytes, content: bytes) -> bytes:
        return struct.pack(">I", len(content)) + kind + content + struct.pack(">I", zlib.crc32(kind + content) & 0xFFFFFFFF)
    pixels = b"".join(b"\x00" + b"\x32\x64\x96" * width for _ in range(height))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(pixels))
            + chunk(b"IEND", b""))


def _install_fixture(root: Path) -> Path:
    dataset = root / "cholect50-challenge-val"
    files = []
    triplet = {"0": "grasper,dissect,cystic_plate"}
    phase = {"0": "preparation"}
    for video_number in (68, 70, 73, 74, 75):
        video_id = f"VID{video_number}"
        frame_path = dataset / "videos" / video_id / "000016.png"
        frame_path.parent.mkdir(parents=True, exist_ok=True)
        frame_path.write_bytes(_png())
        label_path = dataset / "labels" / f"{video_id}.json"
        label_path.parent.mkdir(parents=True, exist_ok=True)
        label_path.write_text(json.dumps({
            "video": video_number,
            "fps": 1,
            "num_frames": 1,
            "categories": {"triplet": triplet, "phase": phase},
            "annotations": {"16": [[0, 0, 1.0, 0.1, 0.2, 0.3, 0.4, 0, 0, 1.0, -1, -1, -1, -1, 0]]},
        }), encoding="utf-8")
        for path in (frame_path, label_path):
            content = path.read_bytes()
            files.append({
                "path": path.relative_to(root).as_posix(),
                "size_bytes": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
            })
    archive = root.parent / "challenge-validation.zip"
    archive.write_bytes(b"verified public archive fixture")
    archive_content = archive.read_bytes()
    manifest = {
        "schema": cholect50_validation.MANIFEST_SCHEMA,
        "dataset": "CholecT50 Challenge Validation",
        "license": cholect50_validation.LICENSE,
        "sampling_fps": 1,
        "archive_size_bytes": len(archive_content),
        "archive_sha256": hashlib.sha256(archive_content).hexdigest(),
        "video_count": 5,
        "files": files,
    }
    root.mkdir(parents=True, exist_ok=True)
    (root / "medforge-source-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return dataset


@pytest.fixture
def source_client(monkeypatch, tmp_path):
    root = tmp_path / "cholect50"
    _install_fixture(root)
    monkeypatch.setenv("MEDFORGE_CHOLECT50_VALIDATION_ROOT", str(root))
    monkeypatch.setenv("MEDFORGE_DB_PATH", str(tmp_path / "cholec.sqlite3"))
    monkeypatch.setenv("MEDFORGE_SOURCE_KIND", "synthetic-test")
    cholect50_validation._load_install.cache_clear()
    cholect50_validation._cached_sha256.cache_clear()
    with TestClient(create_app()) as client:
        yield client, root
    cholect50_validation._load_install.cache_clear()
    cholect50_validation._cached_sha256.cache_clear()


def test_cholec_source_shows_exact_frame_labels_and_pixel_boxes(source_client):
    client, _ = source_client
    videos = client.get("/api/v1/surgivision/cholect50")
    assert videos.status_code == 200
    assert len(videos.json()) == 5
    video = next(item for item in videos.json() if item["video_id"] == "VID68")
    assert video["sampled_frame_count"] == video["annotated_frame_count"] == 1
    assert "continuous video footage" in video["limitations"][0]

    frames = client.get("/api/v1/surgivision/cholect50/VID68/frames")
    assert frames.status_code == 200
    frame = frames.json()[0]
    assert frame["frame_id"] == "VID68:16"
    assert frame["sample_time_sec"] == 16
    assert frame["phase_label"] == "preparation"
    annotation = frame["annotations"][0]
    assert annotation["source_kind"] == "expert reference annotation"
    assert annotation["triplet_label"] == "grasper,dissect,cystic_plate"
    assert annotation["bbox_xywh_px"] == [10, 10, 30, 20]

    image = client.get(frame["image_url"])
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/png"
    assert image.content.startswith(b"\x89PNG\r\n\x1a\n")
    assert client.get("/api/v1/surgivision/cholect50/../VID68/frames").status_code == 404


def test_cholec_source_rejects_tampered_images(source_client):
    client, root = source_client
    image_path = root / "cholect50-challenge-val" / "videos" / "VID68" / "000016.png"
    image_path.write_bytes(_png() + b"tampered")
    cholect50_validation._cached_sha256.cache_clear()
    response = client.get("/api/v1/surgivision/cholect50/VID68/frames/16/image")
    assert response.status_code == 404


def test_cholec_source_is_empty_without_verified_install(monkeypatch, tmp_path):
    monkeypatch.setenv("MEDFORGE_CHOLECT50_VALIDATION_ROOT", str(tmp_path / "missing"))
    cholect50_validation._load_install.cache_clear()
    assert cholect50_validation.video_records() == []
    cholect50_validation._load_install.cache_clear()
