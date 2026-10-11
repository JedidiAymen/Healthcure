#!/usr/bin/env bash

hackcure_resolve_dataset_root() {
  local name="$1"
  local candidate="$2"
  local fallback="$ROOT/data/hackcure-docker/optional-sources/$name"
  if [ -d "$candidate" ]; then
    realpath -e -- "$candidate"
  else
    # The startup path creates an empty host directory so optional sources do
    # not prevent boot. Read-only preflight resolves the same target without
    # creating it or changing local state.
    if [ "${MEDFORGE_HACKCURE_CREATE_EMPTY_DATASET_ROOTS:-0}" = 1 ]; then
      mkdir -p "$fallback"
      chmod 700 "$fallback"
    fi
    realpath -m -- "$fallback"
  fi
}

hackcure_configure_dataset_roots() {
  export MEDFORGE_HACKCURE_OPENKBP_ROOT="$(hackcure_resolve_dataset_root openkbp "$ROOT/data/openkbp")"
  export MEDFORGE_HACKCURE_ENDOSCAPES_ROOT="$(hackcure_resolve_dataset_root endoscapes "$ROOT/data/endoscapes")"
  export MEDFORGE_HACKCURE_FISAV_ROOT="$(hackcure_resolve_dataset_root fisav "$ROOT/data/fisav")"
  export MEDFORGE_HACKCURE_APPENDIX300_ROOT="$(hackcure_resolve_dataset_root appendix300 "$ROOT/../medforge/data/appendix300")"
  export MEDFORGE_HACKCURE_CHOLECT80_ROOT="$(hackcure_resolve_dataset_root cholec80 "$ROOT/data/cholec80")"
}
