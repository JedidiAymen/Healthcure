# DoseTwin selected voxel sample — D2 milestone

**State:** Implemented on the DoseTwin linked source view. D2 covers a read-only sample of the currently selected voxel; it does not change a calculation, dose scale, mask, report, or permission boundary.

## What changed

- The primary plane now shows the selected voxel's CT array value, reference-dose array value, and membership in each selected ROI mask.
- Values are read from the exact active 128 × 128 source slice at the linked crosshair row and column. Coordinate labels remain processed-grid `x`, `y`, and `z`; no patient-space orientation is inferred.
- Unit labels come from each API slice response (`benchmark-value`, `Gy`, `binary-mask`, or the explicitly synthetic units). The UI does not relabel benchmark CT values as Hounsfield units or synthetic dose as physical Gy.
- This panel is read-only and appears only on the primary plane. Missing or non-finite values are shown as unavailable; it does not substitute generated values.

At the captured local `pt_201` default voxel `[64, 64, 64]`, the source response rendered CT value `1036.0000 benchmark-value`, reference dose `32.7010 Gy`, and `Brainstem: outside mask`.

## Responsive source-backed evidence

Captured from the running local application at `/studio/dosetwin/cases/openkbp:pt_201` with installed OpenKBP `pt_201` arrays. These private screenshots contain source-derived medical imagery and are ignored by Git:

- Desktop 1440 × 900: `.local-review/D1-voxel-sample/dose-1440x900.png`
- Tablet 768 × 1024: `.local-review/D1-voxel-sample/dose-768x1024.png`
- Phone 390 × 844: `.local-review/D1-voxel-sample/dose-390x844.png`
- Route status, displayed values, viewport dimensions, overflow and browser errors: `.local-review/D1-voxel-sample/report.json`

All three captures returned HTTP 200, reported the same source voxel values, had no page exceptions, and had no horizontal overflow.

## Files and component source

- `src/pages/DoseViewer.tsx` — reads the current selected pixel from the already loaded source-backed CT, dose, and selected ROI slices and presents the values in the scientific viewer.
- `tests/e2e/workspace-shell.spec.ts` — the focused viewer flow now checks that fixture-slice CT/dose values and ROI membership appear in the sample.

No dependency or component source was added. The panel uses the repository's existing shadcn-style Base UI `Card` primitives and Tailwind CSS utilities.

| Existing package | Version | License | Use |
|---|---:|---|---|
| React | 19.3.0 | MIT | Existing DoseTwin component rendering |
| `@base-ui/react` | 1.8.0 | MIT | Existing local Card and form primitives |
| Tailwind CSS | 4.3.3 | MIT | Existing layout and responsive utilities |

## Verification

- `npm run typecheck` — passed.
- `npm run test:e2e:ci -- --grep 'DoseTwin keeps one Gy scale, linked ROI overlays and voxel mapping under zoom and pan'` — passed (1 test). The flow asserts fixture slice sample values `0.5000`, `40.0000 Gy`, and `Brainstem: inside mask`, then exercises existing linked-view behavior.
- Actual local `pt_201` route captures at desktop, tablet and phone sizes — passed with no browser errors or horizontal overflow.

The E2E uses an explicitly labeled synthetic test fixture. Source-backed displayed values above come from the separately captured locally installed `pt_201` route.
