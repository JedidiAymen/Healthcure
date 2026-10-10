#!/usr/bin/env python3
"""Install the official FiSaV patient information sheet and derive a minimal labels file.

The workbook (CC BY 4.0, OSF project HYPFR) is verified against the SHA-256 published by OSF
and stored under the ignored data/fisav/ folder. The derived labels file keeps only fields
used by the stenosis evaluation and its baselines: stenosis presence (ultrasound reference),
occlusion test performed, prior angioplasty, palpation and auscultation patterns, and the
PZT1 sensor position. Age, sex and other fields stay in the workbook only.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "fisav"
SOURCE_URL = "https://osf.io/download/wd9s5/"
OSF_FILE_ID = "6a4cdea4c7bddc8fec69b604"
EXPECTED_SHA256 = "a180e6698b68fb01b67fb8ea348e9ba7187195a090bacdfa3f8aa553f713e6b1"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
# Column letter -> (field name, text that must appear in that column's header cells).
COLUMNS = {
    "G": ("prior_pta", "PTA PROCEDURES"),
    "J": ("pzt1_position", "PZT1 POSITION"),
    "N": ("occlusion_test", "OCCLUSION TEST"),
    "T": ("thrill_pattern", "Thrill"),
    "W": ("bruit_pattern", "Bruit sounds"),
    "BA": ("stenosis", "STENOSIS"),
}


def read_rows(path: Path) -> list[dict[str, str | None]]:
    with zipfile.ZipFile(path) as book:
        shared = []
        if "xl/sharedStrings.xml" in book.namelist():
            for item in ET.fromstring(book.read("xl/sharedStrings.xml")).findall("m:si", NS):
                shared.append("".join(node.text or "" for node in item.iter(f"{{{NS['m']}}}t")))
        rows = []
        for row in ET.fromstring(book.read("xl/worksheets/sheet1.xml")).iter(f"{{{NS['m']}}}row"):
            values = {}
            for cell in row.findall("m:c", NS):
                column = re.match(r"[A-Z]+", cell.get("r")).group()
                value = cell.find("m:v", NS)
                values[column] = None if value is None else (shared[int(value.text)] if cell.get("t") == "s" else value.text)
            rows.append(values)
        return rows


def yes_no(value: str | None, field: str, patient: str) -> bool:
    text = (value or "").strip().upper()
    if text not in ("Y", "N"):
        raise SystemExit(f"Unexpected {field} value {value!r} for {patient}; the sheet layout may have changed")
    return text == "Y"


def derive_labels(rows: list[dict[str, str | None]]) -> dict[str, dict]:
    header_rows = [row for row in rows if not re.fullmatch(r"pat\d{3}", str(row.get("A") or "").strip())]
    for column, (field, expected) in COLUMNS.items():
        if not any(expected.lower() in str(row.get(column) or "").lower() for row in header_rows):
            raise SystemExit(f"Column {column} does not carry the expected '{expected}' header; refusing to guess the layout")
    patients = {}
    for row in rows:
        patient = str(row.get("A") or "").strip()
        if not re.fullmatch(r"pat\d{3}", patient):
            continue
        patients[patient] = {
            "stenosis": yes_no(row.get("BA"), "stenosis", patient),
            "occlusion_test": yes_no(row.get("N"), "occlusion test", patient),
            "prior_pta": yes_no(row.get("G"), "prior PTA", patient),
            "thrill_pattern": (row.get("T") or "").strip() or None,
            "bruit_pattern": (row.get("W") or "").strip() or None,
            "pzt1_position": (row.get("J") or "").strip() or None,
        }
    if len(patients) != 59:
        raise SystemExit(f"Expected 59 patients, found {len(patients)}")
    return dict(sorted(patients.items()))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--from-file", type=Path, help="Use an already-downloaded copy instead of fetching from OSF")
    args = parser.parse_args()
    DEST.mkdir(parents=True, exist_ok=True)
    if args.from_file:
        payload = args.from_file.read_bytes()
    else:
        request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "MEDFORGE-local-research/1.0"})
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = response.read()
    digest = hashlib.sha256(payload).hexdigest()
    if digest != EXPECTED_SHA256:
        raise SystemExit(f"Patient sheet SHA-256 {digest} does not match the OSF-published {EXPECTED_SHA256}")
    workbook = DEST / "patient_information.xlsx"
    fd, temporary = tempfile.mkstemp(dir=DEST, prefix=".patient_information.")
    with os.fdopen(fd, "wb") as handle:
        handle.write(payload)
    os.replace(temporary, workbook)
    patients = derive_labels(read_rows(workbook))
    labels = {
        "schema": "medforge.fisav-patient-labels.v1",
        "dataset_doi": "10.17605/OSF.IO/HYPFR",
        "license": "CC BY 4.0",
        "source_file": {"name": "patient_information.xlsx", "osf_file_id": OSF_FILE_ID, "sha256": digest, "size_bytes": len(payload)},
        "derived_at_utc": datetime.now(timezone.utc).isoformat(),
        "reference_standard": "Stenosis presence as recorded in the dataset patient sheet (echographic examination section).",
        "fields": {
            "stenosis": "STENOSIS presence (Y/N)", "occlusion_test": "OCCLUSION TEST (Y/N)",
            "prior_pta": "PTA PROCEDURES PERFORMED (Y/N)", "thrill_pattern": "PALPATION: Thrill",
            "bruit_pattern": "AUSCULTATION: Bruit sounds", "pzt1_position": "PZT1 POSITION",
        },
        "patients": patients,
    }
    (DEST / "medforge-patient-labels.json").write_text(json.dumps(labels, indent=2) + "\n", encoding="utf8")
    counts = sum(item["stenosis"] for item in patients.values())
    print(json.dumps({"workbook": str(workbook.relative_to(ROOT).as_posix()), "sha256": digest, "patients": len(patients),
                      "stenosis_yes": counts, "stenosis_no": len(patients) - counts}, indent=2))


if __name__ == "__main__":
    main()
