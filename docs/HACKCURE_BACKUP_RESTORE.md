# HackCure local backup and restore check

This workflow applies only to the local Docker HackCure profile described in [`RUN_LOCAL.md`](../RUN_LOCAL.md). It backs up the profile's unencrypted SQLite demo database together with the checksum-verified OpenKBP-Opt `pt_241` source manifest, complete case arrays, matching reference, and archived `set_1` prediction. It does not contain Docker images, credentials stored outside the database, Caddy certificates, or other datasets.

The archive contains sensitive local research material and may contain local account and review records. It stays under ignored `data/hackcure-docker/backups/`; protect it with host account permissions and full-disk encryption. Do not push, email, upload, or copy it to a shared location. Dataset rights remain local-only and are not expanded by making a backup.

## Create a backup

Start the HackCure Docker profile and let the app finish initializing its database, then run from the repository root:

```sh
python3 scripts/hackcure_backup_restore.py create
```

The command checks the installed source files against `data/openkbp-opt/pt_241/medforge-source-manifest.json`, opens the exact profile database read-only, uses SQLite's online backup API to capture a consistent snapshot, verifies the copied database, and writes a timestamped ZIP. It does not change the live database or source files. Existing backup archives are never replaced.

The archive manifest records member names, byte counts, SHA-256 hashes, and the source/profile identity. `create` confirms file-level integrity only; it does not certify that imported comparison records, saved reports, reviewer credentials, Academy assignments, or a full event walkthrough are ready.

## Restore rehearsal without touching live state

Use the exact archive path returned by `create`:

```sh
python3 scripts/hackcure_backup_restore.py restore-check data/hackcure-docker/backups/hackcure-backup-<timestamp>.zip
```

`restore-check` validates every ZIP member and hash, extracts to a temporary directory under ignored `data/`, checks the copied SQLite database with `PRAGMA quick_check`, and cross-checks the source manifest against the restored source files. The temporary directory is removed when the check ends. It never restores over `data/hackcure-docker/medforge.sqlite3`, writes into a Docker volume, starts a container, applies migrations, or changes an account.

## What this does not prove

This is a local archive-integrity rehearsal, not the outstanding second-machine/backup-access-point event rehearsal in [`HACKCURE_COMPLIANCE.md`](HACKCURE_COMPLIANCE.md). It does not prove that Docker images are available offline, that the app boots from the archive, that credentials or keys can be recovered, that the archive is encrypted, or that the dataset may be displayed outside this machine. Keep the separate live-state preflight and visual rehearsal gates in [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md).
