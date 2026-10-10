# FIX-05 — Same-grid DoseTwin comparison

**Status: PARTIAL; integrated on `review/cobalt-dosetwin-d2-d3` (commit `ce3e2c4`).** The local import, validation, comparison, and report workflow is implemented. A real second `pt_201` prediction is not available, so source-backed comparison evidence for that case remains gated. An authentic official OpenKBP-Opt prediction/reference pair for `pt_241` was range-extracted to ignored local data; it has a different patient identity and spacing and cannot be compared with `pt_201`.

## Implemented

- A local-only `PUT /api/v1/cases/{case_id}/dose-artifacts` accepts an authentic OpenKBP sparse CSV (maximum 64 MiB) only when the installed research case is real, the submitted source case ID exactly matches it, shape is 128³, spacing matches the installed case, indices use the source C-order convention, and units are explicitly Gy. It rejects malformed, duplicate, out-of-range, negative and non-finite values.
- The operator records model/source revisions and a research-use rights basis; checkpoint SHA-256 is optional when the source does not publish a checkpoint. The app computes the uploaded-file SHA-256 and preserves the raw CSV under an opaque ID in the ignored local `data/dose-artifacts` directory. It does not execute or trust the imported checkpoint and does not independently verify user-declared identity or permissions. Student sessions cannot access prediction artifacts.
- The lazily loaded comparison panel shows reference, prediction and signed Δ-dose planes at the active 2D slice using shared dose bounds, per-ROI mean/absolute-difference values, and same-threshold reference/prediction DVHs. Plane and axis labels stay in processed-array coordinates; no DICOM orientation or clinical claim is made.
- A saved evidence report stores the reference and prediction hashes, source/model/checkpoint revisions, rights note, selected plane, per-ROI comparison results and limitations. Repeated saves of the same artifact and selection return the existing report.
- DoseTwin’s capability copy now distinguishes implemented local import from unavailable inference and from an absent second artifact.

## Source and rights gate

The installed `pt_201` source contains its benchmark reference dose only. The official OpenKBP-Opt archive central directory was verified from the publisher's ETag-pinned range response; its prediction members cover `pt_241`–`pt_340` and contain no `pt_201`. A local `pt_241` reference/prediction pair is CRC32- and SHA-256-verified and uses a 128³ processed grid, but spacing `[3.906, 3.906, 2.5] mm` and patient identity differ from `pt_201` `[5.422, 5.422, 3.0] mm`. The UI cannot compare these cases or resample them into apparent compatibility. Test-fixture imports verify API behavior only and are not presented as research results. The local data manifest records user-authorized local research use; no redistribution or public display rights are claimed.

## Visual review

Actual local Healthcure app, configured against `pt_201`, at 1440×900, 768×1024 and 390×844. The comparison accordion is open and truthfully shows no second array installed. All three captures returned HTTP 200, had no page exceptions and no horizontal overflow. Screenshots are private, ignored local review assets because they contain source-derived medical imagery:

- `.local-review/FIX-05/dosetwin-comparison-1440x900.png`
- `.local-review/FIX-05/dosetwin-comparison-768x1024.png`
- `.local-review/FIX-05/dosetwin-comparison-390x844.png`

## Components and verification

- No new frontend dependency. Uses installed React 19, shadcn/Base UI Card, Field, Input, Checkbox, Select, Alert, Table, Badge and Button; installed Recharts shadcn chart wrapper; Tailwind 4 semantic tokens.
- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm run test` — 28 passed.
- `npm run test:e2e -- --workers=1` — 7 passed.
- `python3 -m pytest -q apps/api/tests` — 34 passed, 1 skipped. In the isolated worktree, the existing CVS-AdaptNet reference submodule was linked from the local primary checkout only while tests ran, then the link was removed.
- `npm run contracts:check` — pass.
- `npm run build` — pass. vtk.js remains a lazily loaded 835.33 kB / 221.13 kB gzip D2 chunk. DoseTwin comparison tools are also lazy-mounted and only load when opened.

## Still required for D3 completion

- Acquire a compatible `pt_201` prediction with an established local-use basis, or add a separately modeled full `pt_241` workflow with its matching CT, ROI masks, and source metadata.
- Cross-check the prediction-vs-reference voxel deltas and per-ROI statistics independently against the source model's documented evaluation.
- Capture real-artifact screenshots and verify a saved comparison report reopens with all same source hashes.

Until those steps pass, the feature is **PARTIAL**, not a validated model comparison.
