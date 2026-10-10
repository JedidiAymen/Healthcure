# FIX-03 — DoseTwin scientific workstation correction

**Status: D1 source-backed 2D workstation implemented for the locally installed OpenKBP `pt_201` case.** This does not claim validated 3D, a second-dose comparison, model inference, or clinical use.

## What changed

- Replaced the three small slice cards with one large, plane-selectable imaging viewport and a companion structure inspector. The source plane renders up to 640 CSS pixels wide and occupies more than half of the available primary pane in the 1280-pixel E2E viewport. Tablet and phone use one primary view without horizontal page overflow.
- Added fixed-grid zoom, fit, pointer pan, fullscreen, wheel/keyboard slice stepping, and linked pointer-to-voxel selection using the rendered canvas bounds. The voxel state is kept in processed-array index space; no DICOM origin, left/right orientation, or patient-space coordinate is implied.
- Dose color is normalized against one case-wide maximum dose, with a labeled Gy legend; slice-local dose percentiles are not used. CT window bounds use a case-wide 2nd–98th percentile of the processed CT values and remain explicitly “source value,” not HU. Display window adjustment is local.
- Exposed known voxel spacing `[5.422, 5.422, 3.0] mm` and used the row/column spacing ratio to display each plane without square-pixel distortion.
- Added source-backed selection and contour overlays for up to five ROIs with stable structure colors. Their computed cumulative DVHs share the same full-case Gy axis and have a matching table. The separate official OpenKBP metrics table shows Dmean, D95, D0.1cc and V20; metric definitions/source notes remain distinct from exploratory curves.
- Source hashes, source revision, research-use limitations and the CT hash remain available in a collapsed provenance disclosure. The generic method table now marks actual source-backed viewing operations and lists prediction/comparison/continuous-video/classification capabilities as blocked with a specific reason.
- Added a small bounded-volume cache for validated OpenKBP arrays. It only accepts the fixed source filenames and approved ROI names.

## Real-source and component evidence

- Opened the running application on the installed source case `pt_201`; its real source-derived API values include `72.2979965 Gy` case maximum and `[5.422, 5.422, 3.0] mm` spacing. The visible shot shows its processed array, not a generated image. A fresh `python3 scripts/crosscheck_openkbp_pt201.py` run passed all 23 official evaluator comparisons, maximum absolute difference `0.0000076471 Gy`; official same-dose and DVH scores are both `0.0`. The displayed case remains labeled benchmark reference data.
- Added regression coverage for shared Gy color across slices, distinct concurrent ROI contours, anisotropic plane mapping, keyboard/wheel slice stepping, fullscreen, zoom/pan pointer selection in all three orientations, tablet-resized pointer mapping, a large primary viewport, and operation-level blocked states. E2E route fixtures are synthetic test data and are explicitly identified as such in their API responses; they are not the screenshots below.
- Existing components only: React 19, shadcn Base UI, Tailwind 4, Recharts 3.10.1, TanStack Query 5.104.1 and Lucide. No new package was installed. vtk.js/Cornerstone3D are not part of this D1 correction.
- Actual running-app screenshots at 1440×900, 768×1024 and 390×844 are in ignored `.local-review/FIX-03/`. The capture report records viewport dimensions, HTTP 200 responses, no horizontal overflow, and no browser page errors.

## Still blocked / next steps

- **D2 real 3D:** not implemented. No mesh or anatomy is fabricated; a vtk.js/Cornerstone3D spike requires explicit processed-index mapping, mask-to-surface validation, parity, memory and fallback checks before adoption.
- **D3 dose comparison:** blocked. No authentic second compatible `pt_201` dose is in the repository, and a local dose import/validation UI is not implemented. The workspace names this gap instead of displaying pretend Model A/Model B results.
- **D4 inference/optimization:** blocked by missing validated checkpoints, rights and worker execution.
- D1 follow-up validation still includes student-view permission parity. The learner viewer continues using the assigned-case lock path and existing API authorization tests; those protections were not reworked in this change.

## Verification

- `npm run lint`, `npm run typecheck`, `npm run test` — passed (25 unit tests across 5 files).
- `npm run test:e2e -- --workers=1` — passed (6 Playwright tests), including the new DoseTwin source-operation gates, large viewport, fullscreen, multiple ROI overlays, zoom/pan selection mapping, and existing Educator/global-selector routes.
- `npm run build` — passed.
- `python3 -m pytest -q apps/api/tests` — passed (32 tests; installed data is exercised by the local screenshot smoke, test fixtures by the suite).
- `npm run contracts:check` — passed after generating the OpenAPI schema and TypeScript types.
