# PR-FIX-06 — scientific plane geometry and Academy touch targets

**Status:** authentic `pt_241` comparison is implemented in a separate local profile; `pt_201` comparison remains gated because its prediction is not in the archive. This review-branch milestone does not finish the wider redesign.

## DoseTwin comparison planes

Comparison reference, prediction, and signed-difference canvases now display the source grid's physical pixel aspect for the selected axis. For the installed `pt_201` spacing `[5.422, 5.422, 3.0] mm`, the X/Y planes use the correct anisotropic dimensions and the Z plane remains square. Invalid spacing uses a square fallback. Labels continue to identify processed-grid indices and do not imply patient orientation.

This fixes display geometry only. The official OpenKBP-Opt archive contains no `pt_201` prediction. It does contain a matching `pt_241` reference/prediction pair. The complete official `pt_241` case was installed to ignored local data and verified against OpenKBP Git blob SHA-1/size and OpenKBP-Opt ZIP CRC32/size, plus SHA-256, sparse values, 128³ shape, seven nonempty ROI masks and spacing. `scripts/start_local_openkbp_pt241.sh` launches an independent local API/web/database profile; the existing same-grid import can compare the authentic `set_1` file against its matching `pt_241` reference. No model checkpoint hash was published, and the UI now records that as unavailable rather than requiring a fabricated hash. `pt_241` and `pt_201` cannot be cross-compared. The complete case and combined provenance manifest live in ignored `data/openkbp-opt/pt_241/`.

## Student Academy

The assigned-path summary uses a semantic definition list while retaining API-sourced counts. Path lesson actions and the path back action meet the 44px minimum touch target. Opt-in recognition remains API-backed; no fabricated progress or awards were added.

## Verification

- `src/features/dosetwin/comparison-geometry.test.ts`: physical ratio for all three axes and invalid-spacing fallback.
- Dose prediction imports accept a missing checkpoint hash while preserving the source file hash and source revision. This supports published prediction arrays whose source does not expose model weights; it does not claim an independently identified model.
- Academy focused ESLint, typecheck, and production build were run by the implementation agent.
- Full API suite: 38 passed. The dose import tests explicitly confirm an archived prediction without a published checkpoint hash remains usable and retains a null checkpoint value.
- Frontend unit suite: 30 passed; Playwright responsive/workflow suite: 10 passed; contract check, lint, typecheck, production build and `git diff --check` pass. Build retains the existing lazy vtk.js chunk warning.
- The live `pt_241` API imported the authentic set_1 prediction by its source SHA-256 and returned all seven ROI comparisons and 128×128 reference/prediction/Δ planes. Actual screenshots at 1440×900, 768×1024 and 390×844 rendered that comparison; all returned HTTP 200 with no page errors or horizontal overflow. Captures/reports: ignored `.local-review/openkbp-pt241/`.

## Remaining evidence

- A compatible `pt_201` prediction remains unavailable; keep that comparison partial.
- Repeat the Academy assigned-path review at phone/tablet widths and complete keyboard traversal; the prior populated path evidence covers desktop only.
- Continue the remaining handoff milestones for DoseTwin, SurgiVision, FistulaGuard, Academy, Educator, and Model Lab.
