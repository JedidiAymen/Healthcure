"""Licensed Appendix300 video records and byte-range playback."""
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient

from app.main import create_app


def test_licensed_clip_is_checksum_verified_and_supports_video_ranges(tmp_path, monkeypatch):
    root = tmp_path / "appendix300"
    clip = root / "Video_Snippets" / "Center1" / "Center1_014.mp4"
    clip.parent.mkdir(parents=True)
    content = b"fake-mp4-content-for-range"
    clip.write_bytes(content)
    (root / "medforge-source-manifest.json").write_text(json.dumps({
        "schema": "medforge.source-manifest.appendix300-single-clip.v1",
        "dataset": "Appendix300",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "clip_id": "appendix300-center1-014",
        "procedure_label": "Laparoscopic appendectomy",
        "citation": "Appendix300 citation",
        "video_relative_path": "Video_Snippets/Center1/Center1_014.mp4",
        "video_size_bytes": len(content),
        "video_sha256": hashlib.sha256(content).hexdigest(),
        "video_duration_seconds": 4.0,
    }))
    monkeypatch.setenv("MEDFORGE_APPENDIX300_ROOT", str(root))
    monkeypatch.setenv("MEDFORGE_DB_PATH", str(tmp_path / "appendix.sqlite3"))
    monkeypatch.setenv("MEDFORGE_SOURCE_KIND", "synthetic-test")

    with TestClient(create_app()) as client:
        records = client.get("/api/v1/surgivision/clips").json()
        assert len(records) == 1
        assert records[0]["dataset_id"] == "Appendix300"
        assert records[0]["media_kind"] == "native_video"
        assert records[0]["license_label"] == "CC BY 4.0"
        assert records[0]["duration_sec"] == 4.0

        response = client.get(records[0]["asset_uri"], headers={"Range": "bytes=0-3"})
        assert response.status_code == 206
        assert response.content == content[:4]
        assert response.headers["content-range"] == f"bytes 0-3/{len(content)}"
        assert response.headers["accept-ranges"] == "bytes"


def test_clip_endpoint_hides_missing_or_unverified_source(tmp_path, monkeypatch):
    root = tmp_path / "appendix300"
    root.mkdir()
    monkeypatch.setenv("MEDFORGE_APPENDIX300_ROOT", str(root))
    monkeypatch.setenv("MEDFORGE_DB_PATH", str(tmp_path / "missing.sqlite3"))
    monkeypatch.setenv("MEDFORGE_SOURCE_KIND", "synthetic-test")

    with TestClient(create_app()) as client:
        assert client.get("/api/v1/surgivision/clips").json() == []
        response = client.get("/api/v1/surgivision/clips/appendix300-center1-014/video")
        assert response.status_code == 404
        assert response.json()["detail"]["code"] == "SURGICAL_CLIP_NOT_INSTALLED"
