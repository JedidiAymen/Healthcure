#!/usr/bin/env python3
"""Report local MEDFORGE machine, dependency, and source-data readiness."""
from __future__ import annotations

import argparse
import importlib.metadata
import json
import os
import platform
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


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
    endo_images_present = sum(1 for path in endoscapes.glob("*/[0-9]*_[0-9]*.jpg") if path.is_file())
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
    args = parser.parse_args()
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
