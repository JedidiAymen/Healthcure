# UX-02 — DoseTwin source-plane inspection

**State:** Implemented locally on `redesign/cobalt-porcelain-v3`. Not pushed or deployed.

## What changed

- Made a single source plane the primary DoseTwin viewport, with X-index, Y-index, and Z-index controls. A 304px inspector sits alongside it at the handoff's 1280px desktop breakpoint; it stacks on tablet and phone.
- Enlarged the selected plane from a maximum 190px canvas to a responsive, pixelated view (576px at 1440×900, 512px at 1280×800, 460px at 768×1024, 322px at 390×844).
- Added linked voxel fields and grouped dose/ROI/opacity settings using the installed shadcn/Base Nova primitives.
- Preserved the original 128×128 source-array canvas, pointer-to-voxel mapping, crosshair, source hashes, DVH calculation/table, benchmark warning, student lock behavior, and local viewer state. This dataset has processed-array indices; no patient-space orientation is claimed.

## Files changed

- `src/pages/DoseViewer.tsx`

## Browser verification and real data

A real local OpenKBP `pt_201` case was inspected in Chrome at all four handoff sizes. Each selection retained native canvas dimensions of **128×128**. Switching all three plane controls and clicking at 75% width / 25% height on the Z-index view selected `[X=32, Y=96, Z=64]` at each size, preserving the documented axis mapping. All four pages had no JavaScript errors or horizontal overflow. Screenshots and viewport report are in the ignored `.local-review/UX-02/dose-twin/` directory.

The existing official OpenKBP evaluator cross-check remains 23 comparisons with maximum absolute difference **0.0000076471 Gy**. No benchmark array, model result, or medical calculation was changed.

## Checks executed

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test` — 17 passed.
- `npm run test:e2e -- --workers=1` — 2 passed.
- `npm run build` — passed; DoseViewer remains a lazy-loaded chunk (32.09 kB, 10.69 kB gzip).
- `python3 -m pytest -q apps/api/tests` — 30 passed.
- `npm run contracts:check` — passed; `python3 scripts/check_sql_schema.py` — 35 required tables and foreign-key checks passed.
- `python3 scripts/crosscheck_openkbp_pt201.py` — 23 official comparisons passed; max absolute difference 0.0000076471 Gy.

No new viewer package was installed. See `library-spikes.md` for integration gates and deferred trials.
