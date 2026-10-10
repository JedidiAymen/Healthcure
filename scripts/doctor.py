#!/usr/bin/env python3
"""Report local MEDFORGE machine, dependency, and source-data readiness."""
from __future__ import annotations

import argparse
import importlib.metadata
import json
import os
import platform
import shutil
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _path_result(name: str, result: str, reason: str, *paths: Path) -> dict[str, object]:
    return {
        "name": name,
        "result": result,
        "reason": reason,
        "paths": [str(path.expanduser().resolve()) for path in paths],
    }


def _configured_pt241_root() -> tuple[Path, str | None]:
    """Resolve the local pt_241 mapping the dev launcher would use, without creating anything."""
    raw = os.environ.get("MEDFORGE_OPENKBP_FULL_CASES_JSON", "").strip()
    if raw:
        try:
            cases = json.loads(raw)
            configured = cases.get("openkbp:pt_241") if isinstance(cases, dict) else None
            if not isinstance(configured, str) or not configured.strip():
                return ROOT / "data/openkbp-opt/pt_241", "MEDFORGE_OPENKBP_FULL_CASES_JSON has no openkbp:pt_241 path."
            return Path(configured).expanduser().resolve(), None
        except (ValueError, TypeError):
            return ROOT / "data/openkbp-opt/pt_241", "MEDFORGE_OPENKBP_FULL_CASES_JSON is not valid JSON."
    raw = os.environ.get("MEDFORGE_OPENKBP_CASES_JSON", "").strip()
    if raw:
        try:
            cases = json.loads(raw)
            configured = cases.get("openkbp:pt_241") if isinstance(cases, dict) else None
            if isinstance(configured, str) and configured.strip():
                return Path(configured).expanduser().resolve(), None
        except (ValueError, TypeError):
            return ROOT / "data/openkbp-opt/pt_241", "MEDFORGE_OPENKBP_CASES_JSON is not valid JSON."
    return ROOT / "data/openkbp-opt/pt_241", None


def _hash_file(path: Path) -> str | None:
    import hashlib

    digest = hashlib.sha256()
    try:
        with path.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError:
        return None
    return digest.hexdigest()


def hackcure_preflight() -> tuple[list[dict[str, object]], bool]:
    """Read-only readiness checks for the documented local HackCure walkthrough."""
    case_root, case_config_error = _configured_pt241_root()
    source_manifest_path = case_root / "medforge-source-manifest.json"
    source_ok = False
    source_reason = case_config_error or "The matching pt_241 source and archived set_1 files are verified against the local source manifest."
    prediction_sha: str | None = None
    reference_sha: str | None = None
    try:
        manifest = json.loads(source_manifest_path.read_text(encoding="utf8"))
        if manifest.get("dataset_case_id") != "pt_241" or manifest.get("prediction_set") != "set_1":
            raise ValueError("The source manifest does not identify pt_241 / set_1.")
        entries = manifest.get("entries", [])
        by_name = {Path(item["local_path"]).name: item for item in entries if isinstance(item, dict) and isinstance(item.get("local_path"), str)}
        required_source = manifest.get("openkbp_full_case", {}).get("files", [])
        if not required_source:
            raise ValueError("The manifest has no complete pt_241 source-file inventory.")
        for item in required_source:
            filename = item.get("file")
            expected = item.get("sha256")
            if not isinstance(filename, str) or Path(filename).name != filename or not isinstance(expected, str):
                raise ValueError("The pt_241 source manifest contains an invalid file entry.")
            if _hash_file(case_root / filename) != expected:
                raise ValueError(f"The pt_241 source file {filename} is missing or differs from its manifest.")
        prediction = by_name.get("prediction-set_1.csv")
        reference = by_name.get("reference-dose.csv")
        if not prediction or not reference:
            raise ValueError("The manifest is missing the matching archived set_1 prediction or reference entry.")
        prediction_sha, reference_sha = prediction.get("sha256"), reference.get("sha256")
        for filename, entry in (("prediction-set_1.csv", prediction), ("reference-dose.csv", reference)):
            expected = entry.get("sha256")
            if not isinstance(expected, str) or _hash_file(case_root / filename) != expected:
                raise ValueError(f"The matching pt_241 {filename} is missing or differs from its manifest.")
        source_ok = True
    except (OSError, ValueError, TypeError, AttributeError) as exc:
        source_reason = str(exc) or "The pt_241 source manifest could not be verified."

    db_path = Path(os.environ.get("MEDFORGE_DB_PATH", ROOT / "data/local.sqlite3")).expanduser().resolve()
    db_present = db_path.is_file()
    db_error: str | None = (None if db_present else "The selected local database does not exist; start the app normally, then point the preflight at that same database.")
    artifact_ready = report_ready = reviewer_ready = academy_ready = False
    if db_present:
        try:
            # mode=ro plus query_only makes the intent explicit. This path never runs app migrations.
            conn = sqlite3.connect(f"{db_path.as_uri()}?mode=ro", uri=True, timeout=5)
            try:
                conn.execute("PRAGMA query_only=ON")
                tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                needed = {"dose_artifacts", "reports", "role_grants", "local_credentials", "lesson_versions", "assignments", "learning_cohort_memberships"}
                missing = needed - tables
                if missing:
                    db_error = "The selected local database is missing readiness tables; start the app with its normal local setup first."
                else:
                    artifact = conn.execute(
                        "SELECT 1 FROM dose_artifacts WHERE case_id=? AND source_case_id IN (?,?) AND source_file_name=? "
                        "AND source_file_sha256=? AND validation_status='grid-validated-local-only' LIMIT 1",
                        ("openkbp:pt_241", "pt_241", "openkbp:pt_241", "prediction-set_1.csv", prediction_sha or ""),
                    ).fetchone()
                    artifact_ready = artifact is not None and source_ok
                    if artifact_ready:
                        rows = conn.execute(
                            "SELECT provenance_json FROM reports WHERE case_id=? AND status='generated' AND run_id IS NULL",
                            ("openkbp:pt_241",),
                        ).fetchall()
                        for (raw_document,) in rows:
                            try:
                                document = json.loads(raw_document)
                            except (ValueError, TypeError):
                                continue
                            source = document.get("source", {})
                            case_document = document.get("case", {})
                            files = source.get("files_sha256", {}) if isinstance(source, dict) else {}
                            if (document.get("schema") == "medforge.dosetwin-dose-comparison/v1"
                                    and isinstance(case_document, dict) and case_document.get("source_case_id") == "pt_241"
                                    and files.get("prediction:prediction-set_1.csv") == prediction_sha
                                    and files.get("reference:dose.csv") == reference_sha):
                                report_ready = True
                                break
                    reviewer_ready = conn.execute(
                        "SELECT 1 FROM role_grants g JOIN local_credentials c ON c.user_id=g.user_id "
                        "WHERE g.role IN ('clinical_reviewer','admin') LIMIT 1"
                    ).fetchone() is not None
                    academy_ready = conn.execute(
                        "SELECT 1 FROM assignments a "
                        "JOIN lesson_versions v ON v.id=a.lesson_version_id AND v.status='published' "
                        "JOIN learning_cohort_memberships m ON m.cohort_id=a.cohort_id "
                        "JOIN role_grants g ON g.user_id=m.user_id AND g.role='student' "
                        "JOIN local_credentials c ON c.user_id=m.user_id LIMIT 1"
                    ).fetchone() is not None
            finally:
                conn.close()
        except (OSError, sqlite3.Error) as exc:
            db_error = f"The selected database could not be checked read-only ({type(exc).__name__})."

    checks = [
        _path_result("pt_241 source + archived set_1", "PASS" if source_ok else "FAIL", source_reason, source_manifest_path, case_root / "prediction-set_1.csv", case_root / "dose.csv"),
        _path_result("imported matching prediction", "PASS" if artifact_ready else "FAIL", "A grid-validated set_1 artifact for pt_241 is present in the selected local database." if artifact_ready else (db_error or "No matching grid-validated pt_241 set_1 import was found in the selected local database."), db_path),
        _path_result("saved matching comparison report", "PASS" if report_ready else "FAIL", "A saved comparison report matches the pt_241 source and archived prediction hashes." if report_ready else (db_error or "No saved pt_241 comparison report matching this source pair was found in the selected local database."), db_path),
        _path_result("local reviewer profile", "PASS" if reviewer_ready else "FAIL", "A local reviewer/admin role with sign-in credentials is available; account details are intentionally omitted." if reviewer_ready else (db_error or "No local clinical_reviewer/admin role with sign-in credentials was found. Provision one privately in this database."), db_path),
    ]

    try:
        api_port = int(os.environ.get("MEDFORGE_API_PORT", "8000"))
        web_port = int(os.environ.get("MEDFORGE_WEB_PORT", "5173"))
        ports_valid = 1 <= api_port <= 65535 and 1 <= web_port <= 65535 and api_port != web_port
    except ValueError:
        ports_valid = False
    external_api = os.environ.get("VITE_API_URL", "").strip()
    launcher = ROOT / "scripts/dev.mjs"
    launcher_text = launcher.read_text(encoding="utf8") if launcher.is_file() else ""
    loopback = (ports_valid and (not external_api or external_api == f"http://127.0.0.1:{api_port}")
                and "env.MEDFORGE_BIND = '127.0.0.1'" in launcher_text
                and "'--host', '127.0.0.1'" in launcher_text)
    loopback_reason = ("The documented launcher binds API and web to 127.0.0.1 and the configured API URL is local." if loopback
                       else "Fix the local launcher ports/API URL; use scripts/start_local.sh, which binds both services to 127.0.0.1.")
    checks.append(_path_result("loopback-only app configuration", "PASS" if loopback else "FAIL", loopback_reason, launcher))
    checks.append(_path_result(
        "optional published + assigned Academy lesson",
        "PASS" if academy_ready else "FAIL",
        "A published lesson is assigned to a credentialed local student in a cohort." if academy_ready else
        ("Optional Academy walkthrough is not prepared in this database; publish a source-bounded lesson and assign it to a cohort student." if not db_error else db_error),
        db_path,
    ))
    required_ready = all(check["result"] == "PASS" for check in checks if check["name"] != "optional published + assigned Academy lesson")
    return checks, required_ready


def command_output(args: list[str], timeout: int = 8) -> str | None:
    # Resolve through PATH so Windows finds .cmd shims such as npm.cmd.
    executable = shutil.which(args[0])
    if executable is None:
        return None
    try:
        result = subprocess.run([executable, *args[1:]], check=False, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip() if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def version_at(path: Path) -> str | None:
    try:
        return json.loads(path.read_text(encoding="utf8")).get("version")
    except (OSError, ValueError, TypeError):
        return None


def installed_distribution(name: str) -> str | None:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None


def memory_total_bytes() -> int | None:
    try:
        for line in Path("/proc/meminfo").read_text(encoding="ascii").splitlines():
            if line.startswith("MemTotal:"):
                return int(line.split()[1]) * 1024
    except (OSError, ValueError, IndexError):
        pass
    return None


def processor_name() -> str | None:
    try:
        for line in Path("/proc/cpuinfo").read_text(encoding="ascii", errors="ignore").splitlines():
            if line.lower().startswith(("model name", "hardware")) and ":" in line:
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or None


def source_readiness() -> dict[str, object]:
    openkbp = Path(os.environ.get("MEDFORGE_OPENKBP_CASE_DIR", ROOT / "data/openkbp/pt_201"))
    endoscapes = Path(os.environ.get("MEDFORGE_ENDOSCAPES_ROOT", ROOT / "data/endoscapes"))
    fisav = Path(os.environ.get("MEDFORGE_FISAV_ROOT", ROOT / "data/fisav"))
    cholect50 = Path(os.environ.get("MEDFORGE_CHOLECT50_VALIDATION_ROOT", ROOT / "data/cholect50/challenge-validation"))
    dose_required = ("ct.csv", "dose.csv", "possible_dose_mask.csv", "voxel_dimensions.csv")
    dose_manifest_path = ROOT / "docs/openkbp-pt201-manifest.json"
    try:
        dose_manifest = json.loads(dose_manifest_path.read_text(encoding="utf8"))
        dose_entries = dose_manifest.get("files", [])
    except (OSError, ValueError, TypeError):
        dose_entries = []
    dose_files = [item.get("file") for item in dose_entries if isinstance(item, dict) and isinstance(item.get("file"), str)]
    dose_present = [name for name in dose_files if (openkbp / name).is_file()]
    dose_core_present = [name for name in dose_required if (openkbp / name).is_file()]
    endo_manifest = endoscapes / "medforge-source-manifest.json"
    try:
        endo_data = json.loads(endo_manifest.read_text(encoding="utf8"))
        splits = endo_data.get("splits", {})
        endo_count = sum(int(split.get("image_count", 0)) for split in splits.values())
    except (OSError, ValueError, TypeError):
        splits = {}
        endo_count = 0
    # Count the frame files named in the curated BBox201 manifest. The local
    # Endoscapes directory can also contain the much larger sampled-frame
    # release under train_seg/val_seg/test_seg; those extra images must not
    # make this 1,933-frame inventory appear incomplete.
    endo_images_present = 0
    for split, split_meta in splits.items():
        if not isinstance(split_meta, dict):
            continue
        images = split_meta.get("images", [])
        if not isinstance(images, list):
            continue
        for image in images:
            if not isinstance(image, dict):
                continue
            file_name = image.get("file_name")
            if isinstance(file_name, str) and Path(file_name).name == file_name:
                endo_images_present += int((endoscapes / split / file_name).is_file())
    endo_annotations_present = sum(1 for split in splits if (endoscapes / split / "annotation_coco.json").is_file())
    fisav_manifest = fisav / "medforge-source-manifest.json"
    try:
        fisav_data = json.loads(fisav_manifest.read_text(encoding="utf8"))
        fisav_entries = fisav_data.get("records") or [fisav_data.get("sample_file")]
        fisav_names = [item.get("file_name") for item in fisav_entries if isinstance(item, dict) and isinstance(item.get("file_name"), str)]
        fisav_count = len(fisav_names)
    except (OSError, ValueError, TypeError):
        fisav_names = []
        fisav_count = 0
    cholect_manifest = cholect50 / "medforge-source-manifest.json"
    try:
        cholect_data = json.loads(cholect_manifest.read_text(encoding="utf8"))
        cholect_files = cholect_data.get("files", [])
        cholect_videos = sorted((cholect50 / "cholect50-challenge-val" / "labels").glob("VID*.json"))
        cholect_count = len(cholect_videos)
        cholect_frames = sum(1 for path in (cholect50 / "cholect50-challenge-val" / "videos").glob("VID*/*.png") if path.is_file())
    except (OSError, ValueError, TypeError):
        cholect_data = {}
        cholect_files = []
        cholect_count = 0
        cholect_frames = 0
    return {
        "openkbp_pt201": {
            "directory": str(openkbp),
            "manifest_present": dose_manifest_path.is_file(),
            "manifest_file_count": len(dose_files),
            "manifested_files_present": len(dose_present),
            "required_core_files_present": dose_core_present,
            "ready": bool(dose_files) and len(dose_present) == len(dose_files),
        },
        "endoscapes_bbox201": {
            "directory": str(endoscapes),
            "manifest_present": endo_manifest.is_file(),
            "manifest_image_count": endo_count,
            "image_files_present": endo_images_present,
            "split_annotation_files_present": endo_annotations_present,
            "ready": endo_manifest.is_file() and endo_count > 0 and endo_images_present == endo_count and endo_annotations_present == len(splits),
        },
        "fisav": {
            "directory": str(fisav),
            "manifest_present": fisav_manifest.is_file(),
            "manifest_record_count": fisav_count,
            "record_files_present": sum(1 for name in fisav_names if (fisav / name).is_file()),
            "ready": fisav_manifest.is_file() and fisav_count > 0 and all((fisav / name).is_file() for name in fisav_names),
        },
        "cholect50_challenge_validation": {
            "directory": str(cholect50),
            "manifest_present": cholect_manifest.is_file(),
            "manifest_file_count": len(cholect_files),
            "archive_sha256": cholect_data.get("archive_sha256"),
            "video_count": cholect_count,
            "sampled_frame_count": cholect_frames,
            "ready": cholect_data.get("dataset") == "CholecT50 Challenge Validation" and cholect_count == 5 and cholect_frames > 0,
        },
    }


def isolated_worker_versions(interpreter: Path) -> dict[str, str] | None:
    if not interpreter.is_file():
        return None
    code = (
        "import importlib.metadata as m, json, platform; "
        "names=('torch','torchmetrics','numpy','Pillow'); "
        "print(json.dumps({'python':platform.python_version(),'packages':{n:m.version(n) for n in names if any(d.metadata['Name'].lower()==n.lower() for d in m.distributions())}}))"
    )
    output = command_output([str(interpreter), "-c", code], timeout=20)
    if output is None:
        return None
    try:
        return json.loads(output)
    except ValueError:
        return None


def build_report() -> dict[str, object]:
    disk = shutil.disk_usage(ROOT)
    packages = json.loads((ROOT / "package-lock.json").read_text(encoding="utf8"))
    locked = packages.get("packages", {})
    node_packages = ("react", "vite", "typescript", "tailwindcss", "recharts", "uplot", "@base-ui/react")
    worker_venv = ROOT / "workers/.venvs/cvs-adaptnet"
    worker_python = worker_venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    checkpoint = ROOT / "data/models/cvs-adaptnet/CVSAdaptNet.pth"
    vram = command_output(["nvidia-smi", "--query-gpu=gpu_name,memory.total", "--format=csv,noheader,nounits"])
    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "project_root": str(ROOT),
        "machine": {
            "system": platform.system(),
            "release": platform.release(),
            "machine": platform.machine(),
            "processor": processor_name(),
            "memory_total_bytes": memory_total_bytes(),
            "disk_total_bytes": disk.total,
            "disk_free_bytes": disk.free,
            "gpu": vram.splitlines() if vram else [],
        },
        "runtime": {
            "python": platform.python_version(),
            "python_executable": sys.executable,
            "node": command_output(["node", "--version"]),
            "npm": command_output(["npm", "--version"]),
            "python_packages": {
                name: installed_distribution(name)
                for name in ("fastapi", "pydantic", "numpy", "scipy", "torch", "uvicorn")
            },
            "frontend_packages": {
                name: (locked.get(f"node_modules/{name}") or {}).get("version")
                for name in node_packages
            },
            "isolated_cvs_worker_present": worker_python.is_file(),
            "isolated_cvs_worker": isolated_worker_versions(worker_python),
            "cvs_checkpoint_present": checkpoint.is_file(),
        },
        "datasets": source_readiness(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="also save the JSON report at this path")
    parser.add_argument("--hackcure-preflight", action="store_true",
                        help="report only read-only readiness for the documented local HackCure walkthrough")
    args = parser.parse_args()
    if args.hackcure_preflight:
        checks, required_ready = hackcure_preflight()
        print(json.dumps({"result": "PASS" if required_ready else "FAIL", "checks": checks}, indent=2))
        return 0 if required_ready else 1
    report = build_report()
    rendered = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        output = args.output if args.output.is_absolute() else ROOT / args.output
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered, encoding="utf8")
        print(f"Saved readiness report: {output}")
    print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
