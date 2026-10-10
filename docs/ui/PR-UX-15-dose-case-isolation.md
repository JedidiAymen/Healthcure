# PR-UX-15 — DoseTwin case selection and isolated read-only case

## What changed

The default local launcher continues to use `pt_201` as its fully enabled source. When `data/openkbp-opt/pt_241` is installed, the same launcher registers it as a second selectable case in a **viewer-only** mode. The case picker uses the stable case ID in the URL, and DoseTwin loads the selected case's own CT, reference dose, spacing, ROI masks, source revision, and DVH. Per-case viewer preferences remain separate.

The server accepts additional case IDs only through the operator-controlled `MEDFORGE_OPENKBP_CASES_JSON` allowlist. An ID from a request is only looked up in this map; it is never treated as a filesystem path. Each profile resolves hashes, revisions, arrays, and cache entries from its own local root. The legacy `MEDFORGE_OPENKBP_CASE_DIR` case retains its existing full capabilities. Additional allowlisted cases stay blocked from run creation, dose import, prediction comparison, and report creation until those write and evidence flows have been migrated and validated for multiple cases.

The independent `pt_241` launcher still opens the complete authentic reference/prediction pair on its own grid, using a separate local database. Do not compare `pt_241` against `pt_201`. The checkpoint hash is unpublished. Dataset terms remain under review, so research arrays are ignored local data and are not committed to the repository.

## Files changed

- `apps/api/app/main.py` — validated local case allowlist, case-root resolution, source revision per case, and per-root slice/volume cache access. Only established read-only endpoints accept viewer-only profiles.
- `apps/api/tests/test_contracts.py` — synthetic dual-root isolation coverage for manifest, slice, ROI-volume, DVH, provenance, unknown IDs, and rejected run access.
- `src/pages/Pages.tsx` — shadcn case selector, ID-addressable navigation, artifact-query gating, and viewer-only research method state.
- `src/pages/DoseViewer.tsx` — read-only explanation and suppressed prediction comparison for viewer-only profiles.
- `tests/e2e/workspace-shell.spec.ts` — case switch, viewer-only boundaries, no blocked artifact request, and per-case preference restoration.
- `scripts/start_local.sh` — registers installed local `pt_241` automatically unless the operator has set an explicit allowlist.
- `docs/LOCAL_ACCESS_AND_PROFILES.md` — updated default launcher behavior; existing startup, profile, and account provisioning instructions retained.

## Components and licenses

The case picker composes the project's existing generated shadcn Base Nova `Select` components from `src/components/ui/select.tsx` (`@base-ui/react` 1.8.0, MIT). The project uses Tailwind CSS 4.3.3 (MIT). shadcn's official Select documentation and Base UI API were checked. No package, external component, model, or dataset was added for this milestone.

## Verification

- `python3 -m pytest -q apps/api/tests/test_contracts.py` — 23 passed.
- Focused Playwright case-picker regression — 1 passed. It confirms that the second case is viewer-only, never requests its prediction artifact, and the first case retains its selected ROI after switching away and back.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed. Existing vtk.js chunk-size and React Compiler directive warnings remain.
- `npm run contracts:check` — passed against the backend route/schema export.
- `bash -n scripts/start_local.sh` and `git diff --check` — passed.
- Against the installed authentic local sources, the actual `pt_241` case rendered at 1440×900, 768×1024, and 390×844. Each viewport showed the viewer-only state and case picker, returned no browser errors, and had no horizontal overflow. Captures are in ignored `.local-review/DOSETWIN-TWO-CASE/` and are intentionally not committed with the source datasets.

## Open in the local review checkout

```sh
./scripts/start_local.sh
```

Open <http://127.0.0.1:5173/studio/dosetwin/cases/current> and select `pt_241` in **DoseTwin source case**. The direct route is <http://127.0.0.1:5173/studio/dosetwin/cases/openkbp%3Apt_241>. This default launcher exposes `pt_241` only if its local source files exist. For the authentic matched prediction import and comparison, follow the separate launcher instructions in [`LOCAL_ACCESS_AND_PROFILES.md`](../LOCAL_ACCESS_AND_PROFILES.md).

The local Academy/Educator username and password setup is documented in [`LOCAL_ACCESS_AND_PROFILES.md`](../LOCAL_ACCESS_AND_PROFILES.md); each reviewer provisions their own student and educator accounts. No default credentials are seeded or included in Git.
