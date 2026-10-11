# FIX-09 — DoseTwin pointer-to-voxel cell mapping

**Status:** implemented and unit-tested. This fixes selection geometry only; no source arrays, dose calculations, ROI masks, reports, or permissions changed.

## Correction

`slicePointFromCanvasPosition` previously rounded normalized pointer coordinates to the nearest integer. A canvas coordinate is a point inside one of 128 rendered pixel cells, so rounding incorrectly moved the latter half of each cell into its neighbor. For example, a point 1.5 voxel-widths from the left edge selected column 2 instead of the cell under the pointer, column 1. This could make the displayed linked crosshair and the selected research voxel disagree by one voxel on zoomed, panned, or resized planes.

The mapping now floors normalized coordinates to the containing pixel cell, then clamps the far edge to index 127. It continues to use the rendered canvas bounding rectangle, which includes the canvas's current CSS zoom, pan, and physical-aspect sizing. All three array axes use the same mapping helper.

## Files and dependencies

- `src/lib/dose-visualization.ts` — corrected raster-cell lookup.
- `src/lib/dose-visualization.test.ts` — regression coverage for positions in the second half of a displayed voxel and the next cell boundary, plus existing resized/anisotropic/zoomed/panned geometry checks.
- No package was added. The existing viewer uses React 19.3.0 (MIT), Tailwind CSS 4.3.3 (MIT), and generated shadcn Base UI components backed by `@base-ui/react` 1.8.0 (MIT); focused tests use Vitest 5.0.3 (MIT).

## Research-data scope and verification

The mapping operates on the viewer's 128×128 source raster and does not inspect or transform dose values. It therefore preserves the processed-index conventions for the authentic `pt_201` reference case and the separate authentic `pt_241` reference/prediction comparison; the two cases remain isolated and must not be cross-compared. The `pt_241` ignored local source files were present during this check. `pt_201` source files were not present in this checkout's `data/` directory, so this correction does not claim a new live `pt_201` smoke.

- `npm run test -- src/lib/dose-visualization.test.ts` — passed, 11 tests.
- `npm run typecheck` — passed.
- No screenshot was captured: this is a pointer-coordinate correction with no rendered UI change, and no local app server was running on the review URL.
