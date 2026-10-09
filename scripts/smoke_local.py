#!/usr/bin/env python3
"""Read-only smoke checks for MEDFORGE's local API, source paths, and SPA routes."""
from __future__ import annotations

import argparse
from collections import Counter
import json
import math
import os
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DOSE_ROIS = (
    "Brainstem", "SpinalCord", "RightParotid", "LeftParotid", "Esophagus",
    "Larynx", "Mandible", "PTV56", "PTV63", "PTV70",
)


class SmokeFailure(RuntimeError):
    pass


def fetch(base: str, path: str, *, timeout: int = 25) -> tuple[int, bytes, str]:
    try:
        with urlopen(Request(base.rstrip("/") + path, headers={"Accept": "application/json, text/html, */*"}), timeout=timeout) as response:
            return response.status, response.read(), response.headers.get("Content-Type", "")
    except (HTTPError, URLError, TimeoutError) as exc:
        raise SmokeFailure(f"GET {base.rstrip('/') + path} failed: {exc}") from exc


def json_get(base: str, path: str) -> object:
    status, body, content_type = fetch(base, path)
    if status != 200 or "json" not in content_type.lower():
        raise SmokeFailure(f"GET {path} returned {status} with {content_type or 'unknown content type'}")
    try:
        return json.loads(body)
    except (ValueError, UnicodeDecodeError) as exc:
        raise SmokeFailure(f"GET {path} did not return valid JSON") from exc


def run(api: str, web: str) -> dict[str, object]:
    health = json_get(api, "/healthz")
    if health.get("status") != "ok" or health.get("public_deployment_ready") is not False:
        raise SmokeFailure("Local health/readiness response is unexpected")
    modules = json_get(api, "/api/v1/modules")
    module_ids = {item["id"] for item in modules}
    expected = {"surgivision", "dosetwin", "fistulaguard"}
    if module_ids != expected:
        raise SmokeFailure(f"Module registry mismatch: expected {sorted(expected)}, received {sorted(module_ids)}")
    cases = json_get(api, "/api/v1/cases")
    cases_by_module = {module: [item for item in cases if item["module"] == module and item["status"] == "ready"] for module in expected}
    module_status = {item["id"]: item["capability_state"] for item in modules}
    for module in expected:
        if module_status[module] == "ready" and not cases_by_module[module]:
            raise SmokeFailure(f"{module} claims readiness but has no ready source case")

    source_checks: list[str] = []
    dose = cases_by_module["dosetwin"]
    if dose:
        case = dose[0]
        case_id = quote(case["id"], safe="")
        manifest = json_get(api, f"/api/v1/cases/{case_id}/viewer-manifest")
        if manifest.get("case_id") != case["id"] or not manifest.get("artifacts"):
            raise SmokeFailure("DoseTwin viewer manifest has no source-linked artifacts")
        dvh = json_get(api, f"/api/v1/cases/{case_id}/viewer/dvh?roi=Brainstem")
        if dvh.get("dose_sha256") is None:
            raise SmokeFailure("DoseTwin DVH lacks source provenance")
        if case["id"] == "openkbp:pt_201":
            for layer in ("ct", "dose"):
                for axis in range(3):
                    plane = json_get(api, f"/api/v1/cases/{case_id}/viewer/slice?axis={axis}&index=64&layer={layer}")
                    if (plane.get("shape") != [128, 128] or len(plane.get("values", [])) != 128 * 128
                            or len(plane.get("source_sha256", "")) != 64):
                        raise SmokeFailure(f"DoseTwin {layer} plane on axis {axis} has invalid dimensions or provenance")
            for roi in DOSE_ROIS:
                roi_dvh = json_get(api, f"/api/v1/cases/{case_id}/viewer/dvh?roi={roi}")
                curve = roi_dvh.get("curve", [])
                if (roi_dvh.get("voxel_count", 0) <= 0 or not isinstance(roi_dvh.get("mean_dose_gy"), (int, float))
                        or not math.isfinite(roi_dvh["mean_dose_gy"]) or len(curve) < 2
                        or len(roi_dvh.get("dose_sha256", "")) != 64 or len(roi_dvh.get("roi_sha256", "")) != 64):
                    raise SmokeFailure(f"DoseTwin ROI {roi} has no complete source-derived DVH")
                previous_dose = -math.inf
                previous_volume = 100.0
                for point in curve:
                    dose_gy = point.get("dose_gy")
                    volume_percent = point.get("volume_percent")
                    if (not isinstance(dose_gy, (int, float)) or not math.isfinite(dose_gy)
                            or not isinstance(volume_percent, (int, float)) or not math.isfinite(volume_percent)
                            or dose_gy < previous_dose or not 0 <= volume_percent <= 100
                            or volume_percent > previous_volume + 1e-6):
                        raise SmokeFailure(f"DoseTwin ROI {roi} DVH is non-finite or not cumulative")
                    previous_dose, previous_volume = dose_gy, volume_percent
                for axis in range(3):
                    plane = json_get(api, f"/api/v1/cases/{case_id}/viewer/slice?axis={axis}&index=64&layer=roi&roi={roi}")
                    if (plane.get("shape") != [128, 128] or len(plane.get("values", [])) != 128 * 128
                            or plane.get("unit") != "binary-mask" or len(plane.get("source_sha256", "")) != 64):
                        raise SmokeFailure(f"DoseTwin ROI {roi} plane on axis {axis} has invalid dimensions, unit, or provenance")
            source_checks.append("DoseTwin all 10 pt_201 ROI DVHs and 36 source planes, with dimensions, units, cumulative curves and hashes")
        else:
            slice_data = json_get(api, f"/api/v1/cases/{case_id}/viewer/slice?axis=2&index=64&layer=ct")
            if slice_data.get("source_sha256") is None:
                raise SmokeFailure("DoseTwin CT slice lacks source provenance")
            source_checks.append("DoseTwin viewer manifest, CT slice, and Brainstem DVH")

    surgical = cases_by_module["surgivision"]
    if surgical:
        coverage = json_get(api, "/api/v1/surgivision/cvs-coverage")
        split_counts = {item["split"]: item["verified_frames"] for item in coverage["splits"]}
        registered_split_counts = Counter(item["id"].split(":", 2)[1] for item in surgical)
        if (
            coverage.get("verified_frames") != len(surgical)
            or coverage.get("complete_label_frames") != len(surgical)
            or split_counts != dict(registered_split_counts)
            or any(len(item.get("annotation_sha256", "")) != 64 for item in coverage["splits"])
        ):
            raise SmokeFailure("SurgiVision CVS label coverage does not match its checksum-verified source splits")
        source_checks.append("SurgiVision three-criterion label coverage and split annotation hashes")
        case = surgical[0]
        frame_id = case["id"].removeprefix("endoscapes:")
        encoded_frame = quote(frame_id, safe="")
        frame = json_get(api, f"/api/v1/surgivision/frames/{encoded_frame}")
        if frame.get("image_sha256") is None:
            raise SmokeFailure("SurgiVision frame is missing its image hash")
        status, body, content_type = fetch(api, f"/api/v1/surgivision/frames/{encoded_frame}/image")
        if status != 200 or not content_type.lower().startswith("image/") or not body:
            raise SmokeFailure("SurgiVision source image did not load as image data")
        source_checks.append("SurgiVision frame annotations and source image")

    signals = cases_by_module["fistulaguard"]
    if signals:
        case = signals[0]
        record_id = case["source_case_id"]
        record = json_get(api, f"/api/v1/fistulaguard/records/{quote(record_id, safe='')}")
        features = json_get(api, f"/api/v1/fistulaguard/records/{quote(record_id, safe='')}/features?channel=raw%20PZT1&start_sec=0&duration_sec=0.5")
        spectrogram = json_get(api, f"/api/v1/fistulaguard/records/{quote(record_id, safe='')}/spectrogram?channel=raw%20PZT1&start_sec=0&duration_sec=0.5")
        if record.get("source_sha256") is None or features.get("source_sha256") != record.get("source_sha256"):
            raise SmokeFailure("FiSaV feature window does not match the verified recording hash")
        if features.get("sample_count", 0) <= 0 or features.get("nonfinite_sample_count") != 0:
            raise SmokeFailure("FiSaV feature window is empty or contains non-finite values")
        if (spectrogram.get("source_sha256") != record.get("source_sha256")
                or not 1 <= len(spectrogram.get("frequencies_hz", [])) <= 128
                or not 1 <= len(spectrogram.get("times_sec", [])) <= 160
                or len(spectrogram.get("power_per_hz", [])) != len(spectrogram.get("frequencies_hz", []))
                or any(len(row) != len(spectrogram.get("times_sec", [])) for row in spectrogram.get("power_per_hz", []))):
            raise SmokeFailure("FiSaV spectrogram is not a bounded matrix from the verified source recording")
        history = json_get(api, f"/api/v1/comparisons?case_id={quote(case['id'], safe='')}")
        if not isinstance(history, list):
            raise SmokeFailure("FiSaV saved comparison history did not return a list")
        source_checks.append("FiSaV verified recording, measured feature window and spectrogram, and saved comparison history")

    route_paths = [
        "/", "/studio", "/studio/cases",
        "/studio/models", "/studio/experiments", "/studio/reports",
        "/academy", "/academy/missions/demo", "/academy/progress",
        "/academy/paths/surgical-evidence",
        "/academy/paths/radiation-physics",
        "/academy/paths/physiological-signals",
        "/educator", "/educator/cases/demo/edit", "/educator/assignments", "/educator/submissions",
    ]
    for module in sorted(expected):
        case_id = cases_by_module[module][0]["id"] if cases_by_module[module] else "current"
        route_paths.append(f"/studio/{module}/cases/{quote(case_id, safe='')}")
    for path in route_paths:
        status, body, content_type = fetch(web, path)
        if status != 200 or "text/html" not in content_type.lower() or b"<div id=\"root\"" not in body:
            raise SmokeFailure(f"Web route {path} did not serve the React application shell")

    return {
        "api_health": health,
        "module_capabilities": module_status,
        "ready_case_counts": {module: len(items) for module, items in cases_by_module.items()},
        "source_data_checks": source_checks,
        "web_app_shell_routes": route_paths,
        "verification_boundary": "Checks source-backed API responses and React app-shell route delivery; it does not replace interactive browser review.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default=os.environ.get("MEDFORGE_API_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--web", default=os.environ.get("MEDFORGE_WEB_URL", "http://127.0.0.1:5173"))
    args = parser.parse_args()
    try:
        report = run(args.api, args.web)
    except SmokeFailure as exc:
        print(f"MEDFORGE local smoke check FAILED: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
