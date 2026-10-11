# HackCure local backup and restore check

This workflow applies only to the local Docker HackCure profile described in [`RUN_LOCAL.md`](../RUN_LOCAL.md). It backs up the profile's unencrypted SQLite demo database together with the checksum-verified OpenKBP-Opt `pt_241` source manifest, complete case arrays, matching reference, and archived `set_1` prediction. It does not contain Docker images, credentials stored outside the database, Caddy certificates, or other datasets. Docker images can be bundled separately with [`scripts/hackcure_bundle_images.sh`](../scripts/hackcure_bundle_images.sh).

The archive contains sensitive local research material and may contain local account and review records. It stays under ignored `data/hackcure-docker/backups/`; protect it with host account permissions and full-disk encryption. Do not push, email, upload, or copy it to a shared location. Dataset rights remain local-only and are not expanded by making a backup.

## Create a backup

Start the HackCure Docker profile and let the app finish initializing its database, then run from the repository root:

```sh
python3 scripts/hackcure_backup_restore.py create
```

The command checks the installed source files against `data/openkbp-opt/pt_241/medforge-source-manifest.json`, opens the exact profile database read-only, uses SQLite's online backup API to capture a consistent snapshot, verifies the copied database, and writes a timestamped ZIP. It does not change the live database or source files. Existing backup archives are never replaced.

The archive manifest records member names, byte counts, SHA-256 hashes, and the source/profile identity. `create` confirms file-level integrity only; it does not certify that imported comparison records, saved reports, reviewer credentials, Academy assignments, or a full event walkthrough are ready.

## Bundle Docker images for offline transfer

After the local HackCure images have been built or pulled, create a compressed image bundle:

```sh
./scripts/hackcure_bundle_images.sh
```

The script requires the API, web, Caddy and Mosquitto images used by the overlay, verifies that at least 1 GB is free before writing, and saves the images plus a SHA-256 sidecar and manifest under ignored `data/hackcure-docker/backups/images/`. It does not stop or rebuild the running stack. This package is local-only and must be transferred privately with the matching code revision and data backup; do not upload it publicly.

On the second machine, first verify the archive:

```sh
python3 scripts/hackcure_verify_image_bundle.py data/hackcure-docker/backups/images/hackcure-images-<timestamp>.tar.gz
# Repeat with the source revision checked out on this machine:
python3 scripts/hackcure_verify_image_bundle.py data/hackcure-docker/backups/images/hackcure-images-<timestamp>.tar.gz --expected-source-commit "$(git rev-parse HEAD)"
gzip -dc data/hackcure-docker/backups/images/hackcure-images-<timestamp>.tar.gz | docker image load
```

The verifier checks the sidecar and manifest names, byte count, SHA-256, gzip CRC, Docker-save manifest entry, source commit format, and exact four expected image tags without extracting or loading the archive. `--expected-source-commit` additionally requires that the bundle's recorded source revision match the checked-out code (full or abbreviated SHA). If it fails, align the approved checkout and image bundle before loading; do not treat a valid checksum as proof that the image runs the checked-out code. These checks confirm package integrity and revision alignment, not source authenticity or dataset rights. The commands above do not copy or restore the SQLite profile. After loading, check that all four tags are present; handle approved research source files only through the institution/team-approved private transfer process. The HackCure Compose preflight and app startup are separate steps: startup applies database migrations, so do not run it during this package-only check. On 2026-10-11, a fresh local Compose project booted all four services with `--no-build --pull never`; module/case/video registries and the `pt_201` viewer manifest returned HTTP 200, while byte-range requests for both source videos returned HTTP 206. This confirms the host's saved images and mounted sources support a same-machine no-pull startup. It does not prove a second-machine restore, network-isolated boot, or successful data archive transfer. The Compose profile requires version 2.24.4 or newer; see [`RUN_LOCAL.md`](../RUN_LOCAL.md).

## Restore rehearsal without touching live state

Use the exact archive path returned by `create`:

```sh
python3 scripts/hackcure_backup_restore.py restore-check data/hackcure-docker/backups/hackcure-backup-<timestamp>.zip
```

`restore-check` validates every ZIP member and hash, extracts to a temporary directory under ignored `data/`, checks the copied SQLite database with `PRAGMA quick_check`, and cross-checks the source manifest against the restored source files. The temporary directory is removed when the check ends. It never restores over `data/hackcure-docker/medforge.sqlite3`, writes into a Docker volume, starts a container, applies migrations, or changes an account.

Malformed or unreadable source-provenance JSON is reported as a restore-check failure rather than a traceback. A successful integrity check still does not establish dataset permissions or event readiness.

On 2026-10-11, the current local HackCure database and `pt_241 / set_1` source files were archived and restore-checked successfully: 15 members verified and SQLite `quick_check` returned `ok`. This rehearsal database still has no imported comparison/report or reviewer account, so the backup is not an event-ready state.

## What this does not prove

This is a local archive-integrity rehearsal, not the outstanding second-machine/backup-access-point event rehearsal in [`HACKCURE_COMPLIANCE.md`](HACKCURE_COMPLIANCE.md). It does not prove that Docker images are available offline, that the app boots from the archive, that credentials or keys can be recovered, that the archive is encrypted, or that the dataset may be displayed outside this machine. Keep the separate live-state preflight and visual rehearsal gates in [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md).
