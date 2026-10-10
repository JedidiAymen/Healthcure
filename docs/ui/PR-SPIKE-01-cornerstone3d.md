# SPIKE-01 — Cornerstone3D with OpenKBP `pt_201`

**Result: one-case rendering and source parity passed; keep adoption deferred.** This is an isolated, opt-in renderer trial on `spike/dosetwin-cornerstone-one-case`. The regular app route and API remain unchanged unless the trial flags are enabled.

## Trial implementation

- Loaded the actual installed OpenKBP `pt_201` CT, reference dose and Brainstem mask through a loopback-only binary endpoint. It is registered only when `MEDFORGE_ENABLE_CORNERSTONE_SPIKE=1` and excluded from OpenAPI. No benchmark data is added to Git.
- Reordered source C-order X/Y/Z data so the VTK scalar buffer preserves the same X/Y/Z index identity with X-fastest storage. The viewport labels are X–Y, X–Z and Y–Z processed index planes. Spacing `[5.422, 5.422, 3.0] mm` is used as a display basis; no DICOM origin, direction, left/right or clinical orientation is inferred.
- Built three orthographic Cornerstone viewports and a real Brainstem labelmap overlay using the existing source mask. Clicking each plane updates the selected voxel and synchronized slices.
- Verified CT, dose and mask values at clicked voxels against the existing `/viewer/slice` responses on all three planes. Recomputed the Brainstem mean and all 51 DVH points from the reordered arrays and compared them with the existing `/viewer/dvh` response.
- Kept the viewer unavailable from product navigation. The Vite route requires `VITE_CORNERSTONE_SPIKE=1`; the E2E test also requires `CORNERSTONE_SPIKE_E2E=1`.

## Vendor and dependency record

| Package | Version | License | Role |
|---|---:|---|---|
| `@cornerstonejs/core` | 5.11.7 | MIT | Local scalar volume and orthographic viewports |
| `@cornerstonejs/tools` | 5.11.7 | MIT | Labelmap segmentation representation |
| `events` | 3.3.0 | MIT | Browser `EventEmitter` shim; Cornerstone's DICOM metadata dependency otherwise fails in Vite |
| `@kitware/vtk.js` | 36.4.1 (transitive) | MIT | Rendering backend bundled by Cornerstone |

The main worktree's existing VTK.js viewer experiment uses a separate VTK.js version, so adopting Cornerstone alongside it would add a second rendering stack. Vite also emits a browser externalization warning for `url`; no DICOM parsing is used by this source-array trial.

`npm audit --omit=dev` reports **8 runtime dependency advisories** in this trial graph (5 high, 3 moderate), including `adm-zip` through `dcmjs` and `fflate` through VTK.js. The audit's suggested forced fix downgrades Cornerstone core to 0.19.2, so it is not a safe automatic repair. This dependency risk is an additional reason to defer adoption; the advisories are isolated to this spike branch and are not in the reviewed Cobalt branch.

Production build output for the opt-in route:

- Cornerstone core chunk: 2,894.30 KB (788.53 KB gzip).
- Tools chunk: 1,119.63 KB (308.77 KB gzip).
- Compute worker: 2,906.06 KB (786.92 KB gzip).
- Source responses: 8 MiB each for CT, dose and Brainstem mask (24 MiB total).

## Why it is not adopted

The trial proves that the processed array can render and preserve measured voxel identity, but it does not improve the complete DoseTwin task enough to pay for the download and integration costs. The existing canvas already supplies the fixed-Gy dose rendering, selectable multiple ROI contours, official metrics, shared DVH, evidence persistence and responsive pointer mapping. This Cornerstone spike shows CT and one labelmap, but not the dose transfer layer, multi-ROI contour inspector or an interactive DVH. It also needs a custom array adapter because the installed source has no native DICOM orientation or frame metadata.

The current decision is **DEFER**. The branch and opt-in route retain the evidence for future comparison; none of these packages or the binary endpoint is part of the normal product branch.

## Evidence and checks

- Actual running-app captures: `.local-review/CORNERSTONE/cornerstone-1440x900.png`, `cornerstone-768x1024.png`, and `cornerstone-390x844.png`. Each shows the local `pt_201` volume and source Brainstem mask. All three viewport sizes had no horizontal overflow or browser page errors.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:15180 CORNERSTONE_SPIKE_E2E=1 npx playwright test tests/e2e/cornerstone-trial.spec.ts --workers=1` — passed against the production preview build. Covers actual 128³ canvases, 3-plane CT/dose/mask voxel parity, and 51-point DVH equality.
- Standard front-end suite: lint, typecheck, 25 unit tests, 6 existing browser tests passed; the isolated Cornerstone browser test is skipped unless explicitly enabled.
- Pinned API environment: `contracts:check` passed; 32 API tests passed. `scripts/crosscheck_openkbp_pt201.py data/openkbp/pt_201` passed all 23 OpenKBP evaluator comparisons, maximum absolute difference `0.0000076471 Gy`, same-dose and DVH scores both `0.0`.
- `VITE_CORNERSTONE_SPIKE=1 npm run build` — passed; build reports the `url` externalization warning described above and emits the large chunks listed above.
