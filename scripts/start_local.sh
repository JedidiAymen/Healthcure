#!/usr/bin/env bash
# Thin wrapper kept for existing docs; the cross-platform launcher is scripts/dev.mjs (npm start).
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$ROOT/scripts/dev.mjs" "$@"
