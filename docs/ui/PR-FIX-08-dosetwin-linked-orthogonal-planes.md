# DoseTwin linked orthogonal planes

**Status: PASS — implemented and reviewed with the installed OpenKBP `pt_201` arrays.**

The DoseTwin workstation now keeps its large primary slice and mounts the other two processed-array planes in a linked dock. All three planes share the existing voxel, overlay state, selected structures, reference dose scale, and callbacks. Clicking a pixel or changing the fixed index in either dock view updates the common voxel, crosshairs, and primary slice. The main view retains its independent zoom and pan controls; secondary planes remain at fit scale. Secondary views sit side by side when space permits and stack on phone widths. The UI keeps X/Y/Z index labels and does not imply patient-space anatomy.

No data, API calculation, or dependency changed. The existing `DosePlane` fetches each bounded 128×128 array slice through the current case/axis/index/ROI query key; the TanStack Query cache serves repeated requests.

## Verification

- Focused DoseTwin Playwright flow passes with UI fixtures. It verifies simultaneous images, selecting in the secondary Y plane updates the actual coordinate inputs and primary Z index, and page-level overflow stays bounded at tablet and phone widths. Fixture values test UI mechanics only.
- Real installed OpenKBP source review captures are saved locally under `.local-review/DOSETWIN-LINKED-MPR-REAL/` at 1440×900, 1280×800, 768×1024, and 390×844. Each had three visible source-plane canvases and no horizontal overflow; selecting a real pixel in the Y view changed X/Z from 64/64 to 77/80 and all plane labels followed the shared voxel. No page errors were reported.
- `python scripts/crosscheck_openkbp_pt201.py` passed all 23 official metrics with maximum absolute difference `0.0000076471 Gy`; official same-dose scores remain zero. Frontend unit tests passed 44/44; the focused DoseTwin Playwright flow passed; `npm run lint`, `npm run typecheck`, and `npm run build` passed. The build retains its existing large vtk.js chunk warning.

## Open locally

Start `./scripts/start_local.sh`, then open <http://127.0.0.1:5173/studio/dosetwin/cases/current>. Professional Studio needs no account. Follow [`LOCAL_ACCESS_AND_PROFILES.md`](../LOCAL_ACCESS_AND_PROFILES.md) for educator/student profile setup; a fresh checkout has no seeded credentials.
