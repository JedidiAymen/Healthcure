#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/data/hackcure-docker/backups/images"
IMAGES=(
  medforge-api:local
  medforge-web:local
  caddy:2.10.2-alpine
  eclipse-mosquitto:2.0.20
)

if ! command -v docker >/dev/null 2>&1 || ! command -v gzip >/dev/null 2>&1 || ! command -v sha256sum >/dev/null 2>&1; then
  printf 'Docker, gzip and sha256sum are required to bundle the local HackCure images.\n' >&2
  exit 1
fi

for image in "${IMAGES[@]}"; do
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    printf 'Required local image is unavailable: %s\nBuild/pull the HackCure images first.\n' "$image" >&2
    exit 1
  fi
done

available_bytes="$(df -PB1 "$ROOT" | awk 'NR == 2 { print $4 }')"
if [[ ! "$available_bytes" =~ ^[0-9]+$ ]] || (( available_bytes < 1000000000 )); then
  printf 'At least 1 GB of free space is required for an image bundle; current free bytes: %s\n' "${available_bytes:-unknown}" >&2
  exit 1
fi

umask 077
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="hackcure-images-$stamp.tar.gz"
archive="$OUT_DIR/$name"
manifest="$OUT_DIR/hackcure-images-$stamp.json"
checksum="$archive.sha256"
tmp_archive="$(mktemp "$OUT_DIR/.images.XXXXXX")"
tmp_manifest="$(mktemp "$OUT_DIR/.manifest.XXXXXX")"
tmp_checksum="$(mktemp "$OUT_DIR/.checksum.XXXXXX")"
cleanup() { rm -f "$tmp_archive" "$tmp_manifest" "$tmp_checksum"; }
trap cleanup EXIT

docker image save "${IMAGES[@]}" | gzip -1 > "$tmp_archive"
gzip -t "$tmp_archive"
digest="$(sha256sum "$tmp_archive" | awk '{ print $1 }')"
archive_bytes="$(stat -c '%s' "$tmp_archive")"
commit="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || printf 'unknown')"
cat > "$tmp_manifest" <<EOF
{
  "schema": "medforge.hackcure-images/v1",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "repository_commit": "$commit",
  "archive": "$name",
  "archive_bytes": $archive_bytes,
  "archive_sha256": "$digest",
  "images": [
    "${IMAGES[0]}",
    "${IMAGES[1]}",
    "${IMAGES[2]}",
    "${IMAGES[3]}"
  ],
  "load_command": "gzip -dc $name | docker image load"
}
EOF
printf '%s  %s\n' "$digest" "$name" > "$tmp_checksum"
chmod 600 "$tmp_archive" "$tmp_manifest" "$tmp_checksum"
mv -- "$tmp_archive" "$archive"
mv -- "$tmp_manifest" "$manifest"
mv -- "$tmp_checksum" "$checksum"
trap - EXIT

printf 'Created local-only Docker image bundle:\n%s\n' "$archive"
printf 'SHA-256: %s\n' "$digest"
printf 'Manifest: %s\n' "$manifest"
printf 'Transfer the archive, checksum, manifest and a matching source/database backup separately. Do not upload research data.\n'
