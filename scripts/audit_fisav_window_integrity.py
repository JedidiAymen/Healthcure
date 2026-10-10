"""Audit timestamp and finite-value integrity for the installed FiSaV cohort."""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "apps" / "api"))
from app import fisav  # noqa: E402


def main() -> None:
    argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    records = fisav.installed_records()
    if len(records) != 59:
        raise SystemExit(f"Expected the installed 59-record FiSaV cohort, found {len(records)}")

    tolerance_fraction = 0.001
    audited = []
    for case in records:
        loaded = fisav.record(case.source_case_id)
        if loaded is None:
            raise SystemExit(f"Source verification or signal parsing failed for {case.source_case_id}")
        values, sample_rate, digest = loaded
        timestamps = values[:, 0]
        intervals = np.diff(timestamps)
        nominal_interval = 1.0 / sample_rate
        deviation_count = int(np.count_nonzero(
            np.abs(intervals - nominal_interval) > nominal_interval * tolerance_fraction
        ))
        if not np.isfinite(values).all():
            raise SystemExit(f"Non-finite source data found in {case.source_case_id}")
        constant_channels = [
            channel for index, channel in enumerate(fisav.CHANNELS, start=1)
            if np.ptp(values[:, index]) == 0
        ]
        audited.append({
            "record_id": case.source_case_id,
            "source_sha256": digest,
            "sample_count": int(values.shape[0]),
            "sample_rate_hz": sample_rate,
            "finite_channel_values": int(values.shape[0] * len(fisav.CHANNELS)),
            "nonfinite_channel_values": 0,
            "timestamp_interval_count": int(len(intervals)),
            "timestamp_interval_deviation_count": deviation_count,
            "constant_channels": constant_channels,
        })
        fisav._load_record.cache_clear()

    output = PROJECT_ROOT / "docs" / "evidence" / "fisav-window-integrity.json"
    result = {
        "schema": "medforge.fisav.integrity-audit.v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_doi": "10.17605/OSF.IO/HYPFR",
        "license": "CC BY 4.0",
        "records_verified": len(audited),
        "interval_deviation_tolerance_fraction": tolerance_fraction,
        "method": "Each local CSV was checked against its manifest size and SHA-256, parsed with the production loader, and checked for finite time/channel values. Timestamp intervals differing from the median-derived 10 kHz interval by more than 0.1% are counted. This is descriptive integrity evidence, not a signal-quality grade or clinical threshold.",
        "records": audited,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf8")
    deviations = sum(item["timestamp_interval_deviation_count"] > 0 for item in audited)
    print(f"Verified {len(audited)} source-hashed records; {deviations} contain intervals beyond the descriptive tolerance.")
    print(output)


if __name__ == "__main__":
    main()
