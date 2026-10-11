#!/usr/bin/env python3
"""Create and verify local-only backups for the Docker HackCure rehearsal profile."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import sqlite3
import stat
import tempfile
from typing import Any
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = "medforge.hackcure-local-backup/v1"
DB_RELATIVE = "data/hackcure-docker/medforge.sqlite3"
SOURCE_RELATIVE = "data/openkbp-opt/pt_241"
BACKUP_RELATIVE = "data/hackcure-docker/backups"
SOURCE_MANIFEST_NAME = "medforge-source-manifest.json"
BACKUP_MANIFEST_NAME = "backup_manifest.json"


class BackupError(RuntimeError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _under(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def _validate_local_layout(root: Path) -> None:
    data_root = root / "data"
    if data_root.is_symlink() or not _under(data_root, root):
        raise BackupError("The data directory must remain a normal local directory inside this checkout.")
    for relative in ("openkbp-opt", "openkbp-opt/pt_241", "hackcure-docker", "hackcure-docker/backups"):
        item = data_root / relative
        if item.is_symlink() or not _under(item, data_root):
            raise BackupError(f"Refusing a symlink or out-of-checkout local path: {item}")


def _source_inventory(root: Path) -> tuple[Path, list[dict[str, Any]]]:
    _validate_local_layout(root)
    case_root = root / SOURCE_RELATIVE
    manifest_path = case_root / SOURCE_MANIFEST_NAME
    if not case_root.is_dir() or case_root.is_symlink() or not manifest_path.is_file() or manifest_path.is_symlink():
        raise BackupError(f"The local pt_241 source manifest is missing: {manifest_path}")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf8"))
    except (OSError, ValueError) as exc:
        raise BackupError("The local pt_241 source manifest cannot be read as JSON.") from exc
    if not isinstance(manifest, dict):
        raise BackupError("The local pt_241 source manifest must be a JSON object.")
    if manifest.get("dataset_case_id") != "pt_241" or manifest.get("prediction_set") != "set_1":
        raise BackupError("The source manifest must identify OpenKBP-Opt pt_241 and archived set_1.")

    full_case = manifest.get("openkbp_full_case")
    required = full_case.get("files") if isinstance(full_case, dict) else None
    if not isinstance(required, list) or not required:
        raise BackupError("The source manifest has no complete-case file inventory.")

    inventory: dict[str, dict[str, Any]] = {}
    for row in required:
        if not isinstance(row, dict):
            raise BackupError("The pt_241 source manifest contains an invalid case-file entry.")
        name, digest, size = row.get("file"), row.get("sha256"), row.get("bytes")
        if (not isinstance(name, str) or Path(name).name != name or name in (".", "..")
                or not isinstance(digest, str) or len(digest) != 64
                or not isinstance(size, int) or size < 0):
            raise BackupError("The pt_241 source manifest contains an invalid case-file entry.")
        if name in inventory:
            raise BackupError(f"The pt_241 source manifest repeats a case-file entry: {name}")
        inventory[name] = {"path": f"source/pt_241/{name}", "role": "reference-case", "bytes": size, "sha256": digest}

    archive_entries = manifest.get("entries")
    if not isinstance(archive_entries, list):
        raise BackupError("The source manifest has no archived set_1/reference inventory.")
    for entry in archive_entries:
        if not isinstance(entry, dict):
            raise BackupError("The source manifest contains an invalid archive-file entry.")
        local_path = entry.get("local_path")
        name = Path(local_path).name if isinstance(local_path, str) else ""
        if name not in {"reference-dose.csv", "prediction-set_1.csv"}:
            continue
        digest = entry.get("sha256")
        size = entry.get("uncompressed_bytes")
        if not isinstance(digest, str) or len(digest) != 64 or not isinstance(size, int) or size < 0:
            raise BackupError(f"The source manifest has an invalid {name} entry.")
        if name in inventory:
            raise BackupError(f"The source manifest repeats the archived asset entry: {name}")
        inventory[name] = {
            "path": f"source/pt_241/{name}",
            "role": "matching-reference" if name == "reference-dose.csv" else "archived-set_1-prediction",
            "bytes": size,
            "sha256": digest,
        }
    for required_name in ("reference-dose.csv", "prediction-set_1.csv"):
        if required_name not in inventory:
            raise BackupError(f"The source manifest is missing the required {required_name} record.")

    rows: list[dict[str, Any]] = []
    for name, record in sorted(inventory.items()):
        asset = case_root / name
        if not asset.is_file() or asset.is_symlink() or not _under(asset, case_root):
            raise BackupError(f"A required local source asset is missing or unsafe: {asset}")
        if asset.stat().st_size != record["bytes"] or sha256_file(asset) != record["sha256"]:
            raise BackupError(f"A required local source asset differs from its manifest: {name}")
        rows.append(record)
    return manifest_path, rows


def _readonly_database_snapshot(source_path: Path, snapshot_path: Path) -> None:
    if not source_path.is_file() or source_path.is_symlink():
        raise BackupError(f"The Docker HackCure database is missing or unsafe: {source_path}")
    source = destination = None
    try:
        source_uri = f"{source_path.resolve().as_uri()}?mode=ro"
        source = sqlite3.connect(source_uri, uri=True, timeout=15)
        source.execute("PRAGMA query_only=ON")
        destination = sqlite3.connect(snapshot_path)
        source.backup(destination, pages=256, sleep=0.05)
        result = destination.execute("PRAGMA quick_check").fetchone()
        if not result or result[0] != "ok":
            raise BackupError("SQLite integrity check failed for the copied database.")
    except sqlite3.Error as exc:
        raise BackupError(f"The local SQLite database could not be backed up consistently ({type(exc).__name__}).") from exc
    finally:
        if destination is not None:
            destination.close()
        if source is not None:
            source.close()


def create_backup(root: Path = ROOT, now: datetime | None = None) -> Path:
    root = root.resolve()
    _validate_local_layout(root)
    db_path = root / DB_RELATIVE
    source_manifest, assets = _source_inventory(root)
    backup_dir = root / BACKUP_RELATIVE
    backup_dir.mkdir(parents=True, exist_ok=True)
    try:
        backup_dir.chmod(0o700)
    except OSError:
        pass

    timestamp = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    filename = f"hackcure-backup-{timestamp.strftime('%Y%m%dT%H%M%S%fZ')}.zip"
    final_path = backup_dir / filename
    if final_path.exists():
        raise BackupError(f"Refusing to replace an existing backup: {final_path}")

    with tempfile.TemporaryDirectory(prefix=".backup-stage-", dir=backup_dir) as stage_name:
        stage = Path(stage_name)
        snapshot = stage / "medforge.sqlite3"
        _readonly_database_snapshot(db_path, snapshot)
        members: list[dict[str, Any]] = [{
            "path": "database/medforge.sqlite3",
            "role": "local-demo-database",
            "bytes": snapshot.stat().st_size,
            "sha256": sha256_file(snapshot),
        }, {
            "path": f"source/pt_241/{SOURCE_MANIFEST_NAME}",
            "role": "source-provenance-manifest",
            "bytes": source_manifest.stat().st_size,
            "sha256": sha256_file(source_manifest),
        }, *assets]
        document = {
            "schema": SCHEMA,
            "created_at": timestamp.isoformat().replace("+00:00", "Z"),
            "profile": "docker-hackcure-local",
            "contains_local_database_and_research_data": True,
            "members": members,
            "verification": "restore-check only; never overwrites active state",
        }
        staged_zip = stage / "backup.zip"
        try:
            with zipfile.ZipFile(staged_zip, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
                archive.writestr(BACKUP_MANIFEST_NAME, json.dumps(document, sort_keys=True, indent=2) + "\n")
                archive.write(snapshot, "database/medforge.sqlite3")
                archive.write(source_manifest, f"source/pt_241/{SOURCE_MANIFEST_NAME}")
                case_root = root / SOURCE_RELATIVE
                for row in assets:
                    archive.write(case_root / PurePosixPath(row["path"]).name, row["path"])
            with zipfile.ZipFile(staged_zip, "r") as archive:
                bad = archive.testzip()
                if bad:
                    raise BackupError(f"The archive CRC check failed for {bad}.")
            os.chmod(staged_zip, 0o600)
            os.replace(staged_zip, final_path)
            return final_path
        except OSError as exc:
            raise BackupError("The local backup archive could not be written.") from exc


def _safe_member(name: str) -> PurePosixPath:
    path = PurePosixPath(name)
    if path.is_absolute() or not path.parts or any(part in ("", ".", "..") for part in path.parts) or "\\" in name:
        raise BackupError(f"Unsafe archive member path: {name!r}")
    return path


def restore_check(archive_path: Path, root: Path = ROOT) -> dict[str, Any]:
    root = root.resolve()
    _validate_local_layout(root)
    backup_dir = root / BACKUP_RELATIVE
    if archive_path.is_symlink():
        raise BackupError("Backup archive symlinks are not accepted.")
    archive_path = archive_path.expanduser().resolve()
    if not _under(archive_path, backup_dir) or not archive_path.is_file():
        raise BackupError(f"Choose a backup archive under {backup_dir}.")

    with tempfile.TemporaryDirectory(prefix="hackcure-restore-check-", dir=root / "data") as temp_name:
        temp_root = Path(temp_name)
        try:
            with zipfile.ZipFile(archive_path, "r") as archive:
                names: set[str] = set()
                for info in archive.infolist():
                    path = _safe_member(info.filename)
                    if info.is_dir() or info.filename in names:
                        raise BackupError("The archive contains a directory entry or duplicate path.")
                    if stat.S_ISLNK(info.external_attr >> 16):
                        raise BackupError("The archive contains a symbolic link.")
                    names.add(info.filename)
                if BACKUP_MANIFEST_NAME not in names:
                    raise BackupError("The backup manifest is missing.")
                try:
                    document = json.loads(archive.read(BACKUP_MANIFEST_NAME))
                except (ValueError, KeyError) as exc:
                    raise BackupError("The backup manifest cannot be parsed.") from exc
                if not isinstance(document, dict) or document.get("schema") != SCHEMA or document.get("profile") != "docker-hackcure-local":
                    raise BackupError("The archive is not a supported local HackCure backup.")
                members = document.get("members")
                if not isinstance(members, list):
                    raise BackupError("The backup manifest has no member inventory.")
                expected = {BACKUP_MANIFEST_NAME}
                for row in members:
                    if not isinstance(row, dict) or not isinstance(row.get("path"), str):
                        raise BackupError("The backup manifest contains an invalid member record.")
                    member = row["path"]
                    _safe_member(member)
                    if member in expected or not isinstance(row.get("sha256"), str) or len(row["sha256"]) != 64 or not isinstance(row.get("bytes"), int) or row["bytes"] < 0:
                        raise BackupError("The backup manifest has duplicate or invalid member metadata.")
                    info = archive.getinfo(member)
                    if info.file_size != row["bytes"]:
                        raise BackupError(f"Archive size does not match its manifest for {member}.")
                    expected.add(member)
                if names != expected:
                    raise BackupError("Archive members do not match the backup manifest inventory.")

                extracted: dict[str, Path] = {}
                for row in members:
                    member = row["path"]
                    target = temp_root.joinpath(*_safe_member(member).parts)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with archive.open(member, "r") as source, target.open("xb") as destination:
                        while chunk := source.read(1024 * 1024):
                            destination.write(chunk)
                    if target.stat().st_size != row["bytes"] or sha256_file(target) != row["sha256"]:
                        raise BackupError(f"Backup member failed size/SHA-256 verification: {member}")
                    extracted[member] = target
        except zipfile.BadZipFile as exc:
            raise BackupError("The selected backup is not a valid ZIP archive.") from exc

        db_member = extracted.get("database/medforge.sqlite3")
        if db_member is None:
            raise BackupError("The local database is missing from the archive.")
        try:
            connection = sqlite3.connect(f"{db_member.resolve().as_uri()}?mode=ro", uri=True, timeout=5)
            try:
                connection.execute("PRAGMA query_only=ON")
                result = connection.execute("PRAGMA quick_check").fetchone()
                if not result or result[0] != "ok":
                    raise BackupError("The restored temporary SQLite database failed quick_check.")
            finally:
                connection.close()
        except sqlite3.Error as exc:
            raise BackupError(f"The restored temporary database is not readable SQLite ({type(exc).__name__}).") from exc

        expected_asset_paths = {row["path"] for row in document["members"] if str(row.get("path", "")).startswith("source/pt_241/")}
        required_manifest = f"source/pt_241/{SOURCE_MANIFEST_NAME}"
        if required_manifest not in expected_asset_paths:
            raise BackupError("The source provenance manifest is missing from the archive.")
        source_manifest = extracted[required_manifest]
        try:
            source_document = json.loads(source_manifest.read_text(encoding="utf8"))
        except (OSError, ValueError) as exc:
            raise BackupError("The restored source provenance manifest cannot be parsed as JSON.") from exc
        full_case = source_document.get("openkbp_full_case") if isinstance(source_document, dict) else None
        source_files = full_case.get("files") if isinstance(full_case, dict) else None
        if not isinstance(source_document, dict) or source_document.get("dataset_case_id") != "pt_241" or source_document.get("prediction_set") != "set_1" or not isinstance(source_files, list):
            raise BackupError("The restored source manifest does not identify pt_241 / set_1.")
        expected_required_names: set[str] = set()
        for row in source_files:
            if not isinstance(row, dict) or not isinstance(row.get("file"), str) or not isinstance(row.get("sha256"), str):
                raise BackupError("The restored source manifest has an invalid case-file entry.")
            member = f"source/pt_241/{row['file']}"
            if member not in extracted or extracted[member].stat().st_size != row.get("bytes") or sha256_file(extracted[member]) != row["sha256"]:
                raise BackupError(f"A restored source asset differs from its source manifest: {row['file']}")
            expected_required_names.add(member)
        expected_required_names |= {f"source/pt_241/{name}" for name in ("reference-dose.csv", "prediction-set_1.csv")}
        if not expected_required_names.issubset(expected_asset_paths):
            raise BackupError("The archive is missing one or more required pt_241 source assets.")
        source_entries = source_document.get("entries", [])
        if not isinstance(source_entries, list):
            raise BackupError("The restored source manifest has no valid archived source entries.")
        for name in ("reference-dose.csv", "prediction-set_1.csv"):
            expected_row = next((row for row in source_entries if isinstance(row, dict) and Path(str(row.get("local_path", ""))).name == name), None)
            member = f"source/pt_241/{name}"
            if expected_row is None or member not in extracted or expected_row.get("uncompressed_bytes") != extracted[member].stat().st_size or expected_row.get("sha256") != sha256_file(extracted[member]):
                raise BackupError(f"The restored archived source asset differs from its source manifest: {name}")

        return {
            "result": "PASS",
            "archive": str(archive_path),
            "verified_members": len(document["members"]),
            "database_integrity": "ok",
            "source_case": "pt_241 / set_1",
            "restore_target": "temporary directory removed after verification",
            "live_database_modified": False,
            "live_sources_modified": False,
        }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("create", help="Create a timestamped local-only snapshot archive")
    check = commands.add_parser("restore-check", help="Verify an archive in a disposable temporary directory")
    check.add_argument("archive", type=Path, help="Backup ZIP under data/hackcure-docker/backups/")
    args = parser.parse_args()
    try:
        if args.command == "create":
            archive = create_backup()
            print(json.dumps({"result": "PASS", "archive": str(archive), "local_only": True}, indent=2))
        else:
            print(json.dumps(restore_check(args.archive), indent=2))
        return 0
    except BackupError as exc:
        print(json.dumps({"result": "FAIL", "reason": str(exc)}, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
