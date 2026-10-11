# DoseTwin responsive MPR viewport — D1 milestone

**State:** Implemented and captured with the locally installed OpenKBP `pt_201` source. D1 as a whole remains in progress; this milestone covers primary and linked orthogonal viewport sizing and geometry only.

## What changed

- Removed the 190 px fallback for a non-expanded plane and the former independent 640 px / 224 px image caps.
- The primary viewport now grows with the available pane up to 760 px and uses a square adaptive stage. Linked orthogonal panes use the remaining responsive strip and can grow to 320 px high.
- Canvas dimensions are fit from the viewport's live `ResizeObserver` measurements and the case's recorded voxel spacing. This preserves each plane's physical aspect ratio, centers it within the dark viewport, and keeps pointer selection mapped against the actual rendered rectangle through resize, zoom and pan.
- Kept the existing array values, source IDs, case metadata, slice queries, dose transfer function, ROI layer colors, linked voxel calculations and view controls unchanged.

For `pt_201` spacing `[5.422, 5.422, 3] mm`, the X- and Y-index planes render at width/height ratio `3 / 5.422 = 0.553`; the Z-index plane remains square. The rendered ratios were measured in the browser at all three sizes. No patient-space anatomical orientation is inferred.

## Responsive evidence

Screenshots are full-page captures from the running application at `/studio/dosetwin/cases/openkbp:pt_201`, using the locally installed source arrays. They are review artifacts, not approved for public distribution.

- Desktop 1440 × 900: `.local-review/D1-dose-viewer/dose-1440x900.png`
- Tablet 768 × 1024: `.local-review/D1-dose-viewer/dose-768x1024.png`
- Phone 390 × 844: `.local-review/D1-dose-viewer/dose-390x844.png`
- Measured viewport/image dimensions, physical ratios, browser errors, and page widths: `.local-review/D1-dose-viewer/report.json`

All captures had zero browser page errors and no horizontal overflow. At desktop the main image measured 630 × 630 px in a 798 × 648 px viewport; at tablet it measured 444 × 444 px in a 462 × 462 px viewport; at phone it measured 306 × 306 px in a 324 × 324 px viewport. Secondary plane aspect ratios measured 0.553, matching the source spacing.

## Components and licensing

No dependency or viewer engine was added. The change uses the existing React component and CSS stack; the primary/secondary slice panels remain the existing local shadcn-style `Card`/`Button` controls with Base UI primitives, with Tailwind utilities and native `ResizeObserver` sizing.

| Existing package | Version | License | Use in this milestone |
|---|---:|---|---|
| React | 19.3.0 | MIT | Existing `DoseViewer` component and resize state |
| Tailwind CSS | 4.3.3 | MIT | Existing local viewport and responsive layout classes |
| `@base-ui/react` | 1.8.0 | MIT | Existing project UI component primitives; no new primitive added |
| Lucide React | 1.53.0 | ISC | Existing viewport fullscreen affordance |

No standalone imaging framework, chart package, or new shadcn component source was needed for a CSS-sized 128 × 128 source canvas.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `git diff --check` — passed.
- Real-source browser capture at 1440 × 900, 768 × 1024, and 390 × 844 — passed with no page errors or horizontal overflow.
- The focused E2E `DoseTwin keeps one Gy scale, linked ROI overlays and voxel mapping under zoom and pan` — passed after its orthogonal-plane pointer target was moved from 26% (a CSS-pixel boundary-adjacent point) to the center of source cell column 33 / row 97. Production selection keeps the floor-to-containing-cell rule. The preceding click had rounded to `clientX=579` against `left=532.8125`, `width=180.375`, so the actual pointer was inside voxel column 32; no production rounding change was justified.

The E2E also covers the primary-pane `> 50%` width assertion, fullscreen, dose/ROI overlays, linked index changes, zoom/pan, and tablet central-voxel selection.
