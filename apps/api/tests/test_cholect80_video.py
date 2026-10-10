"""Source-labeled Cholec80 playback must remain local, hashed, and frame-aligned."""
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient

from app.main import create_app


def install_clip(root: Path, *, phase_rows: str = "Frame\tPhase\n0\tPreparation\n1\tPreparation\n2\tCalotTriangleDissection\n3\tCalotTriangleDissection\n") -> bytes:
    root.mkdir(parents=True, exist_ok=True)
    video = b"local-cholec80-video-for-range-test"
    phase = phase_rows.encode()
    (root / "video01.mp4").write_bytes(video)
    (root / "video01-phase.txt").write_bytes(phase)
    (root / "medforge-source-manifest.json").write_text(json.dumps({
        "schema": "medforge.source-manifest.cholect80-single-video.v1",
        "dataset": "Cholec80",
        "clip_id": "cholect80-video01",
        "license_url": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
        "citation": "CAMMA Cholec80 source citation",
        "video_relative_path": "video01.mp4",
        "phase_relative_path": "video01-phase.txt",
        "video_size_bytes": len(video),
        "video_sha256": hashlib.sha256(video).hexdigest(),
        "phase_size_bytes": len(phase),
        "phase_sha256": hashlib.sha256(phase).hexdigest(),
        "video_fps": 25,
        "video_frame_count": 4,
        "video_width": 854,
        "video_height": 480,
        "video_duration_seconds": 0.16,
        "limitations": ["test fixture only"],
    }))
    return video


def test_cholect80_phase_intervals_align_to_frames_and_video_ranges(tmp_path, monkeypatch):
    root = tmp_path / "cholec80"
    video = install_clip(root)
    monkeypatch.setenv("MEDFORGE_CHOLECT80_ROOT", str(root))
    monkeypatch.setenv("MEDFORGE_APPENDIX300_ROOT", str(tmp_path / "no-appendix300"))
    monkeypatch.setenv("MEDFORGE_DB_PATH", str(tmp_path / "app.sqlite3"))
    monkeypatch.setenv("MEDFORGE_SOURCE_KIND", "synthetic-test")

    with TestClient(create_app()) as client:
        response = client.get("/api/v1/surgivision/clips")
        assert response.status_code == 200
        records = response.json()
        assert len(records) == 1
        record = records[0]
        assert record["clip_id"] == "cholect80-video01"
        assert record["dataset_id"] == "Cholec80"
        assert record["license_label"] == "CC BY-NC-SA 4.0"
        assert record["frames_per_second"] == 25
        assert record["phase_track"] == [
            {"first_frame": 0, "last_frame": 1, "phase": "Preparation"},
            {"first_frame": 2, "last_frame": 3, "phase": "CalotTriangleDissection"},
        ]
        ranged = client.get(record["asset_uri"], headers={"Range": "bytes=0-8"})
        assert ranged.status_code == 206
        assert ranged.content == video[:9]
        assert ranged.headers["content-range"] == f"bytes 0-8/{len(video)}"


def test_cholect80_rejects_bad_phase_frame_coverage(tmp_path, monkeypatch):
    root = tmp_path / "bad-cholec80"
    install_clip(root, phase_rows="Frame\tPhase\n0\tPreparation\n2\tCalotTriangleDissection\n")
    monkeypatch.setenv("MEDFORGE_CHOLECT80_ROOT", str(root))
    monkeypatch.setenv("MEDFORGE_APPENDIX300_ROOT", str(tmp_path / "no-appendix300"))
    monkeypatch.setenv("MEDFORGE_DB_PATH", str(tmp_path / "app.sqlite3"))
    monkeypatch.setenv("MEDFORGE_SOURCE_KIND", "synthetic-test")

    with TestClient(create_app()) as client:
        assert client.get("/api/v1/surgivision/clips").json() == []


def test_cholect80_rejects_modified_video_bytes(tmp_path, monkeypatch):
    root = tmp_path / "tampered-cholec80"
    install_clip(root)
    (root / "video01.mp4").write_bytes(b"tampered")
    monkeypatch.setenv("MEDFORGE_CHOLECT80_ROOT", str(root))
    monkeypatch.setenv("MEDFORGE_APPENDIX300_ROOT", str(tmp_path / "no-appendix300"))
    monkeypatch.setenv("MEDFORGE_DB_PATH", str(tmp_path / "app.sqlite3"))
    monkeypatch.setenv("MEDFORGE_SOURCE_KIND", "synthetic-test")

    with TestClient(create_app()) as client:
        assert client.get("/api/v1/surgivision/clips").json() == []
