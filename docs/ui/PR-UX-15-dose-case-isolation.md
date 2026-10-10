# PR-UX-15 — DoseTwin case selection and isolated prediction comparison

## What changed

The default local launcher continues to use `pt_201` as its fully enabled source. When the complete local `data/openkbp-opt/pt_241` reference and `prediction-set_1.csv` are installed, the same launcher registers `pt_241` as a second fully enabled source. The case picker uses the stable case ID in the URL, and DoseTwin loads the selected case's own CT, reference dose, spacing, ROI masks, source revision, DVH, prediction artifacts, comparisons, runs, and reports. Per-case viewer preferences and imported artifact ownership remain separate. If only the reference files exist, an operator can still register that case as viewer-only instead.

The server accepts additional case IDs only through operator-controlled local allowlists: `MEDFORGE_OPENKBP_CASES_JSON` for viewer-only profiles and `MEDFORGE_OPENKBP_FULL_CASES_JSON` for profiles enabled for case-bound runs and prediction comparison. An ID from a request is only looked up in a map; it is never treated as a filesystem path. Each profile resolves hashes, revisions, arrays, spacing, and cache entries from its own local root. Prediction artifacts, reports, and run rows remain attached to their existing case IDs. Cross-case artifact lookup returns 404, and an artifact's declared source case must exactly match the selected case.

The complete authentic `pt_241` reference/prediction pair uses its own grid. Do not compare `pt_241` against `pt_201`. The archive does not publish a checkpoint hash; the import form leaves that value blank and stores the archive/model revision separately. Its source and rights basis remain operator-declared; the import discloses that MEDFORGE validates bytes and grid, not model provenance or legal rights. Dataset files are kept in ignored local storage and are not committed to the repository. The separate `pt_241` launcher remains useful for reviewing the source profile in isolation.

## Files changed

- `apps/api/app/main.py` — separate full/viewer-only local allowlists, case-root resolution, source revision per case, startup DB registration, per-root cache reads, case-bound run provenance, and prediction import/slice/comparison/report isolation.
- `apps/api/tests/test_contracts.py` — synthetic dual-root isolation for reads, runs, imported predictions, source/grid rejection, artifact ownership, and report persistence/reopen.
- `src/pages/Pages.tsx` — shadcn case selector, ID-addressable navigation, comparison-availability labels, and artifact queries scoped to the selected case.
- `tests/e2e/workspace-shell.spec.ts` — case switching into the comparison workspace, case-specific artifact request, and per-case preference restoration.
- `scripts/start_local.sh` — enables installed `pt_241` for comparison only when both its reference and authentic set_1 prediction are present; otherwise it can expose the reference as viewer-only.
- `docs/LOCAL_ACCESS_AND_PROFILES.md` — updated default launcher behavior; existing startup, profile, and account provisioning instructions retained.

## Components and licenses

The case picker composes the project's existing generated shadcn Base Nova `Select` components from `src/components/ui/select.tsx` (`@base-ui/react` 1.8.0, MIT). The project uses Tailwind CSS 4.3.3 (MIT). shadcn's official Select documentation and Base UI API were checked. No package, external component, model, or dataset was added for this milestone.

## Verification

- `python3 -m pytest -q apps/api/tests/test_contracts.py` — 23 passed.
- Focused Playwright case-picker regression — passed; confirms the enabled comparison label and case-scoped artifact requests.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — 42 passed across 12 files.
- `npm run build` — passed. Existing vtk.js chunk-size and React Compiler directive warnings remain.
- `npm run contracts:check` — passed against the backend route/schema export.
- `bash -n scripts/start_local.sh` and `git diff --check` — passed.
- Against the installed authentic local sources, the actual `pt_241` case rendered at 1440×900, 768×1024, and 390×844. The source and comparison workspace rendered at all three viewports; the actual imported `prediction-set_1.csv`, seven ROI comparisons, and provenance details were visible with no browser errors or horizontal overflow. Captures are in ignored `.local-review/DOSETWIN-TWO-CASE/` and are intentionally not committed with the source datasets.

## Open in the local review checkout

```sh
./scripts/start_local.sh
```

Open <http://127.0.0.1:5173/studio/dosetwin/cases/current> and select `pt_241` in **DoseTwin source case**. The direct route is <http://127.0.0.1:5173/studio/dosetwin/cases/openkbp%3Apt_241>. Expand **Compare a real prediction**, choose the local `prediction-set_1.csv`, leave the unpublished checkpoint hash blank, enter the pinned OpenKBP-Opt source/model revision and the operator's local research-use basis, then confirm and import. The grid is checked before comparison. Setup, provenance details, and the isolated launcher are in [`LOCAL_ACCESS_AND_PROFILES.md`](../LOCAL_ACCESS_AND_PROFILES.md).

The local Academy/Educator username and password setup is documented in [`LOCAL_ACCESS_AND_PROFILES.md`](../LOCAL_ACCESS_AND_PROFILES.md); each reviewer provisions their own student and educator accounts. No default credentials are seeded or included in Git.
