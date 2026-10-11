#!/usr/bin/env python3
"""Read-only integrity check for a transferred HackCure Docker image bundle."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import sys
import tarfile
from pathlib import Path

EXPECTED_SCHEMA = "medforge.hackcure-images/v1"
EXPECTED_IMAGES = {
    "medforge-api:local",
    "medforge-web:local",
    "caddy:2.10.2-alpine",
    "eclipse-mosquitto:2.0.20",
}
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def verify(archive: Path, *, expected_source_commit: str | None = None) -> dict[str, object]:
    archive = archive.expanduser().resolve(strict=True)
    if not archive.name.startswith("hackcure-images-") or not archive.name.endswith(".tar.gz"):
        raise ValueError("Expected a hackcure-images-*.tar.gz archive.")

    manifest_path = archive.with_name(archive.name.removesuffix(".tar.gz") + ".json")
    checksum_path = archive.with_name(archive.name + ".sha256")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or manifest.get("schema") != EXPECTED_SCHEMA:
        raise ValueError("The image bundle manifest is missing or has an unsupported schema.")
    if manifest.get("archive") != archive.name:
        raise ValueError("The manifest names a different archive.")

    expected_sha = manifest.get("archive_sha256")
    sidecar = checksum_path.read_text(encoding="ascii").split()
    if (not isinstance(expected_sha, str) or not SHA256_RE.fullmatch(expected_sha)
            or len(sidecar) != 2 or not SHA256_RE.fullmatch(sidecar[0])
            or Path(sidecar[1]).name != archive.name
            or sidecar[0] != expected_sha):
        raise ValueError("The checksum sidecar does not match the manifest and archive name.")

    actual_size = archive.stat().st_size
    if manifest.get("archive_bytes") != actual_size:
        raise ValueError("The archive size does not match the manifest.")

    digest = hashlib.sha256()
    with archive.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    actual_sha = digest.hexdigest()
    if actual_sha != expected_sha:
        raise ValueError("The archive SHA-256 does not match its sidecar and manifest.")

    images = manifest.get("images")
    if not isinstance(images, list) or set(images) != EXPECTED_IMAGES or len(images) != len(EXPECTED_IMAGES):
        raise ValueError("The manifest does not list exactly the four HackCure images.")
    repository_commit = manifest.get("repository_commit")
    if not isinstance(repository_commit, str) or not re.fullmatch(r"[0-9a-f]{7,40}", repository_commit):
        raise ValueError("The manifest does not contain a valid source commit.")
    if expected_source_commit is not None:
        if not re.fullmatch(r"[0-9a-f]{7,40}", expected_source_commit):
            raise ValueError("The expected source commit must be a 7- to 40-character lowercase Git SHA.")
        if not repository_commit.startswith(expected_source_commit) and not expected_source_commit.startswith(repository_commit):
            raise ValueError(
                "The image bundle was built from source commit "
                f"{repository_commit}, not the expected checkout {expected_source_commit}."
            )

    # Read to EOF so gzip validates the trailer and CRC without extracting files.
    with gzip.open(archive, "rb") as stream:
        while stream.read(1024 * 1024):
            pass

    # Confirm the Docker-save payload contains the same exact image tags as the
    # sidecar. Checking only the sidecar would not detect an unrelated tarball.
    with tarfile.open(archive, mode="r:gz") as bundle:
        manifest_members = [
            member for member in bundle
            if member.name == "manifest.json" and member.isfile()
        ]
        if len(manifest_members) != 1:
            raise ValueError("The gzip archive does not contain a Docker image manifest.")
        manifest_file = bundle.extractfile(manifest_members[0])
        if manifest_file is None:
            raise ValueError("The Docker image manifest could not be read.")
        docker_manifest = json.load(manifest_file)
        archive_tags = [
            tag
            for image in docker_manifest
            if isinstance(image, dict)
            for tag in (image.get("RepoTags") or [])
            if isinstance(tag, str)
        ]
        if len(archive_tags) != len(EXPECTED_IMAGES) or set(archive_tags) != EXPECTED_IMAGES:
            raise ValueError("The Docker archive does not contain exactly the four expected image tags.")

    return {
        "archive": archive.name,
        "archive_bytes": actual_size,
        "archive_sha256": actual_sha,
        "repository_commit": repository_commit,
        "images": images,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="hackcure-images-*.tar.gz archive")
    parser.add_argument(
        "--expected-source-commit",
        help="Require the manifest source commit to match this full or abbreviated Git SHA.",
    )
    args = parser.parse_args()
    try:
        result = verify(args.archive, expected_source_commit=args.expected_source_commit)
    except (OSError, ValueError, json.JSONDecodeError, tarfile.TarError, gzip.BadGzipFile) as exc:
        print(f"HackCure image bundle verification failed: {exc}", file=sys.stderr)
        return 1
    print("HackCure image bundle integrity: PASS")
    print(f"Archive: {result['archive']} ({result['archive_bytes']} bytes)")
    print(f"SHA-256: {result['archive_sha256']}")
    print(f"Source commit: {result['repository_commit']}")
    for image in result["images"]:
        print(f"Image: {image}")
    print("This confirms archive integrity and contents, not source authenticity or data rights.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
