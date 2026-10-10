#!/usr/bin/env python3
"""Acquire the pinned Bio_ClinicalBERT files used by CVS-AdaptNet."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data/models/bioclinicalbert"
REPOSITORY = "emilyalsentzer/Bio_ClinicalBERT"
REVISION = "d5892b39a4adaed74b92212a44081509db72f87b"
FILES = ("config.json", "pytorch_model.bin", "vocab.txt", "LICENSE")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    from huggingface_hub import hf_hub_download  # worker dependency, needed only when downloading
    TARGET.mkdir(parents=True, exist_ok=True)
    manifest_files = []
    for filename in FILES:
        downloaded = Path(
            hf_hub_download(
                repo_id=REPOSITORY,
                filename=filename,
                revision=REVISION,
                local_dir=TARGET,
            )
        )
        manifest_files.append(
            {"path": filename, "size_bytes": downloaded.stat().st_size, "sha256": sha256(downloaded)}
        )
    license_text = (TARGET / "LICENSE").read_text(encoding="utf-8")
    if not license_text.startswith("MIT License"):
        raise SystemExit("Bio_ClinicalBERT license content did not match the pinned MIT source")
    manifest = {
        "model": REPOSITORY,
        "revision": REVISION,
        "license": "MIT",
        "source_url": f"https://huggingface.co/{REPOSITORY}/tree/{REVISION}",
        "files": manifest_files,
    }
    (TARGET / "medforge-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Installed {len(manifest_files)} pinned model/tokenizer files under {TARGET}")


if __name__ == "__main__":
    main()
