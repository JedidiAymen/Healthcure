# DoseTwin visible reference dose scale · D3

## Change

- Kept the case-wide dose color scale beside the primary OpenKBP slice so reviewers can read the overlay without switching to the lower Source evidence tab.
- Reused the established reference scale, Gy labels, and selected-ROI boundary colors. Corrected the legend gradient stop positions to match `renderDoseSlicePixels` at 0%, 38%, 72%, and 100%; dose values and calculations are unchanged.
- Synthetic views keep the explicit illustrative-unit labels and do not present their scale as physical Gy.

## Source-backed capture

Captured the local OpenKBP `pt_201` route with its installed CT, dose, and ROI arrays. At voxel `[64, 64, 64]`, the adjacent sample reports CT `1036.0000 benchmark-value`, reference dose `32.7010 Gy`, and `Brainstem: outside mask`; the scale reports a case maximum of `72.3 Gy`.

- Desktop: `.local-review/D3-dose-legend/pt201-desktop.png`
- Tablet: `.local-review/D3-dose-legend/pt201-tablet.png`
- Mobile: `.local-review/D3-dose-legend/pt201-mobile.png`

All three sizes displayed the scale without browser errors or document-level horizontal overflow. Captures are ignored local review evidence and contain source-derived imagery.

## Files and checks

- `src/pages/DoseViewer.tsx`
- `tests/e2e/workspace-shell.spec.ts` — asserts the primary scale is visible with the fixed OpenKBP label and midpoint Gy value.
- `docs/ui/PR-D3-dose-twin-visible-reference-scale.md`
- `npm run typecheck` — passed.
- `npx eslint src/pages/DoseViewer.tsx tests/e2e/workspace-shell.spec.ts` — viewer passed; ESLint reports the Playwright spec is ignored by configuration.
- `npm run test:e2e:ci -- --workers=1 --grep 'DoseTwin keeps one Gy scale, linked ROI overlays and voxel mapping under zoom and pan'` — passed (1 test).
- `git diff --check` — passed.

No packages, calculations, source records, reports, permissions, credentials, or database state were changed.
