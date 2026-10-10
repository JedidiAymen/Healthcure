#!/usr/bin/env bash

require_hackcure_compose() {
  if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    printf 'Docker Engine with the Compose plugin is required.\n' >&2
    return 1
  fi

  local version major minor patch
  version="$(docker compose version --short 2>/dev/null || true)"
  version="${version#v}"
  if [[ ! "$version" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
    printf 'Could not read Docker Compose version; HackCure requires Compose 2.24.4 or newer.\n' >&2
    return 1
  fi
  major="${BASH_REMATCH[1]}"
  minor="${BASH_REMATCH[2]}"
  patch="${BASH_REMATCH[3]}"
  if (( major < 2 || (major == 2 && (minor < 24 || (minor == 24 && patch < 4))) )); then
    printf 'HackCure requires Docker Compose 2.24.4 or newer; found %s.\n' "$version" >&2
    return 1
  fi
}
