#!/usr/bin/env python3
"""Verify installed Endoscapes frames and report source CVS-label coverage."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.endoscapes import cvs_label_coverage


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=ROOT / "data" / "endoscapes")
    parser.add_argument(
        "--output", type=Path,
        default=ROOT / "docs" / "evidence" / "endoscapes-cvs-label-coverage.json",
    )
    args = parser.parse_args()
    os.environ["MEDFORGE_ENDOSCAPES_ROOT"] = str(args.source_root.expanduser().resolve())
    coverage = cvs_label_coverage()
    if coverage is None:
        print("No checksum-verified Endoscapes-BBox201 source labels are installed.", file=sys.stderr)
        return 1
    report = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        **coverage,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(args.output.suffix + ".tmp")
    temporary.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf8")
    temporary.replace(args.output)
    print(json.dumps({
        "status": "PASS",
        "verified_frames": report["verified_frames"],
        "complete_label_frames": report["complete_label_frames"],
        "split_counts": {split["split"]: split["verified_frames"] for split in report["splits"]},
        "output": str(args.output),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
