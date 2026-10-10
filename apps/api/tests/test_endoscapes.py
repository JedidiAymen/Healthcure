"""Source-backed Endoscapes label coverage and student redaction checks."""
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import pytest

import app.main as main
from app.auth import password_record
from app.main import _db, create_app


def _install_tiny_endoscapes(root: Path) -> dict[str, str]:
    frames = {
        "train": [(120, 12001, [0, 1 / 3, 1]), (120, 12031, [1, 2 / 3, 0])],
        "val": [(121, 12101, [1 / 3, 0, 1 / 3])],
    }
    splits: dict[str, dict] = {}
    expected_hashes: dict[str, str] = {}
    for split, items in frames.items():
        split_dir = root / split
        split_dir.mkdir(parents=True)
        images = []
        manifest_images = []
        for video_id, frame_number, labels in items:
            file_name = f"{video_id}_{frame_number}.jpg"
            content = f"fixture:{split}:{file_name}".encode()
            (split_dir / file_name).write_bytes(content)
            image_id = video_id * 1_000_000 + frame_number
            images.append({
                "id": image_id,
                "file_name": file_name,
                "width": 854,
                "height": 480,
                "video_id": video_id,
                "ds": labels,
            })
            manifest_images.append({
                "file_name": file_name,
                "image_id": image_id,
                "width": 854,
                "height": 480,
                "video_id": video_id,
                "size_bytes": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
            })
        annotation_path = split_dir / "annotation_coco.json"
        annotation_path.write_text(json.dumps({"images": images, "annotations": [], "categories": []}))
        annotation_hash = hashlib.sha256(annotation_path.read_bytes()).hexdigest()
        expected_hashes[split] = annotation_hash
        splits[split] = {"annotation_sha256": annotation_hash, "images": manifest_images}
    (root / "medforge-source-manifest.json").write_text(json.dumps({
        "dataset": "Endoscapes-BBox201",
        "splits": splits,
    }))
    return expected_hashes


@pytest.fixture
def coverage_client(monkeypatch, tmp_path):
    root = tmp_path / "endoscapes"
    expected_hashes = _install_tiny_endoscapes(root)
    monkeypatch.setenv("MEDFORGE_ENDOSCAPES_ROOT", str(root))
    monkeypatch.setenv("MEDFORGE_DB_PATH", str(tmp_path / "coverage.sqlite3"))
    monkeypatch.setenv("MEDFORGE_SOURCE_KIND", "synthetic-test")
    monkeypatch.delenv("MEDFORGE_OPENKBP_CASE_DIR", raising=False)
    with TestClient(create_app()) as client:
        yield client, expected_hashes


def test_cvs_coverage_summarizes_verified_splits_and_three_annotator_means(coverage_client):
    client, expected_hashes = coverage_client
    response = client.get("/api/v1/surgivision/cvs-coverage")
    assert response.status_code == 200
    payload = response.json()
    assert payload["verified_frames"] == payload["complete_label_frames"] == 3
    assert payload["interpretation_note"].startswith("Official Endoscapes documentation defines")
    splits = {item["split"]: item for item in payload["splits"]}
    assert splits["train"]["verified_frames"] == 2
    assert splits["val"]["verified_frames"] == 1
    assert splits["train"]["annotation_sha256"] == expected_hashes["train"]
    first_criterion = payload["criteria"][0]
    assert first_criterion["labelled_frames"] == 3
    assert first_criterion["mean_zero_frames"] == 1
    assert first_criterion["fractional_mean_frames"] == 1
    assert first_criterion["mean_one_frames"] == 1


def test_surgivision_media_manifest_exposes_annotated_stills_without_video_capabilities(coverage_client):
    client, _ = coverage_client
    response = client.get("/api/v1/surgivision/media")
    assert response.status_code == 200
    sources = {item["media_id"]: item for item in response.json()}
    train = sources["endoscapes-bbox201:train:video-120"]
    assert train["media_kind"] == "annotated_stills"
    assert train["annotated_frame_count"] == 2
    assert train["first_frame_id"] == "endoscapes:train:120_12001"
    assert train["last_frame_id"] == "endoscapes:train:120_12031"
    assert train["capabilities"] == ["browse_annotated_frames"]
    assert train["asset_uri"] is None
    assert train["native_fps"] is None
    assert train["sampling_fps"] is None
    assert train["duration_sec"] is None
    assert any("Continuous video" in item for item in train["limitations"])
    detail = client.get("/api/v1/surgivision/media/endoscapes-bbox201:train:video-120")
    assert detail.status_code == 200
    assert detail.json()["source_revision"] == train["source_revision"]
    assert client.get("/api/v1/surgivision/media/../../etc/passwd").status_code == 404


def test_surgivision_media_manifest_is_empty_when_no_verified_source_is_installed(coverage_client, monkeypatch):
    client, _ = coverage_client
    monkeypatch.setenv("MEDFORGE_ENDOSCAPES_ROOT", str(Path("/nonexistent/verified-endoscapes")))
    assert client.get("/api/v1/surgivision/media").json() == []


def test_student_cannot_read_aggregate_cvs_reference_labels(coverage_client):
    client, _ = coverage_client
    salt, digest = password_record("local-test-password-123")
    with _db() as conn:
        conn.execute("INSERT INTO users(id,display_name) VALUES(?,?)", ("coverage-student", "Student"))
        conn.execute(
            "INSERT INTO local_credentials(user_id,username,salt,password_hash) VALUES(?,?,?,?)",
            ("coverage-student", "coverage-student", salt, digest),
        )
        conn.execute("INSERT INTO role_grants(user_id,role,scope) VALUES(?,?,?)", ("coverage-student", "student", "platform"))
    login = client.post("/api/v1/auth/local-login", json={
        "username": "coverage-student", "password": "local-test-password-123",
    })
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.get("/api/v1/surgivision/cvs-coverage", headers=headers)
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "STUDENT_CASE_SCOPE_REQUIRED"
