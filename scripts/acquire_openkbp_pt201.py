#!/usr/bin/env python3
"""Acquire the single documented OpenKBP validation case for local research.

Files are pinned to the inspected upstream commit and checked against GitHub's
Git blob SHA before a local SHA-256 manifest is written. This script does not
install models, access CodaLab accounts, or upload/redistribute data.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "ce625e62f3b04203f22bd9d1634f3e8fb0245e46"
CASE_PATH = "provided-data/validation-pats/pt_201"
DEST = ROOT / "data" / "openkbp" / "pt_201"
MANIFEST = ROOT / "docs" / "openkbp-pt201-manifest.json"


def request(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "MEDFORGE-local-research/0.1"})
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read()


def git_blob_sha(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode()
    return hashlib.sha1(header + data).hexdigest()


def main() -> int:
    api = f"https://api.github.com/repos/ababier/open-kbp/git/trees/{COMMIT}?recursive=1"
    tree = json.loads(request(api))
    prefix = CASE_PATH + "/"
    files = [entry for entry in tree["tree"] if entry["path"].startswith(prefix) and entry["type"] == "blob"]
    if tree.get("truncated"):
        raise RuntimeError("Upstream tree response was truncated; refusing incomplete acquisition")
    required = {"ct.csv", "dose.csv", "possible_dose_mask.csv", "voxel_dimensions.csv"}
    actual = {entry["path"][len(prefix):] for entry in files}
    missing = required - actual
    if missing:
        raise RuntimeError(f"Pinned upstream case is missing required files: {sorted(missing)}")

    DEST.mkdir(parents=True, exist_ok=True)
    records = []
    for entry in sorted(files, key=lambda item: item["path"]):
        relative = entry["path"][len(prefix):]
        if "/" in relative or not relative.endswith(".csv"):
            continue
        url = f"https://raw.githubusercontent.com/ababier/open-kbp/{COMMIT}/{entry['path']}"
        data = request(url)
        actual_blob = git_blob_sha(data)
        if actual_blob != entry["sha"]:
            raise RuntimeError(f"Git blob checksum mismatch for {relative}: {actual_blob}")
        target = DEST / relative
        target.write_bytes(data)
        records.append({
            "file": relative,
            "bytes": len(data),
            "git_blob_sha1": actual_blob,
            "sha256": hashlib.sha256(data).hexdigest(),
        })

    if not required.issubset({row["file"] for row in records}):
        raise RuntimeError("Acquisition finished without every required case file")
    manifest = {
        "dataset": "OpenKBP",
        "dataset_release": "2020 AAPM Grand Challenge dataset",
        "partition": "validation-pats",
        "case_id": "pt_201",
        "upstream_repository": "https://github.com/ababier/open-kbp",
        "upstream_commit": COMMIT,
        "upstream_path": CASE_PATH,
        "case_directory": str(DEST),
        "acquired_at_utc": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "asset_rights": "The upstream data tree is publicly accessible at this pinned revision. The repository's MIT license is not treated as a separate dataset license. Retain source citation; local research/education use only; no redistribution. Confirm use/display terms before any external publication or commercial use.",
        "reference_kind": "OpenKBP benchmark reference dose; not a delivered clinical plan",
        "files": records,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    local_manifest = {
        "dataset": "OpenKBP",
        "case_id": "pt_201",
        "partition": "validation-pats",
        "upstream_repository": manifest["upstream_repository"],
        "upstream_commit": COMMIT,
        "manifest": "docs/openkbp-pt201-manifest.json",
        "reference_kind": manifest["reference_kind"],
    }
    (DEST / "medforge-source-manifest.json").write_text(json.dumps(local_manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"case_directory": str(DEST), "manifest": str(MANIFEST), "files": len(records), "bytes": sum(row["bytes"] for row in records)}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"OpenKBP acquisition failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
