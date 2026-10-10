# DoseTwin D2 — source-derived 3D ROI surfaces

**Status:** implemented on `review/cobalt-dosetwin-d2-d3`; real-source verified on `pt_201` and kept behind the explicit 3D control.
**Input:** the approved DoseTwin workstation correction and its D2 acceptance criteria.

## What is included

- `GET /api/v1/cases/{case_id}/viewer/roi-volume` returns only a whitelisted ROI mask: source hash/revision, 128³ grid, original voxel spacing, sorted C-order nonzero voxel indices, and explicit index convention. No host paths or inferred patient coordinates are returned.
- A lazily imported 3D panel reconstructs the chosen ROI from that sparse mask with vtk.js ImageData and marching cubes. It crops to the occupied source bounds, pads the volume for a closed boundary, preserves the OpenKBP X-major/Y/Z-fastest source index mapping, and passes the original anisotropic voxel spacing into vtk.js.
- The selected ROI is shared with the 2D viewer. vtk.js trackball camera supports orbit, pan and zoom; structure visibility, opacity and camera reset are available.
- The viewport reports the source file, revision, SHA-256, mask voxel count, mesh count, approximate spacing, and mesh bounds. It labels the mesh as a limited-resolution reconstruction in processed-index/approximate-spacing space. It never asserts patient left/right, DICOM orientation, native origin, or clinical anatomy alignment.
- At widths ≤480 px, or after a WebGL/render error, the 3D viewport shows a fallback message and leaves the validated 2D viewer available. The vtk.js chunk is loaded only after the user opens the surface panel.

## Real-source geometry check

The local `pt_201` source has spacing `[5.422, 5.422, 3.000] mm` and contains a real `PTV70.csv` mask with 10,406 voxels. The spike rendered its mesh with 7,470 points and 14,928 triangles. Reported bounds are `[246.70, 398.52, 273.81, 431.05, 91.50, 280.50]` in approximate benchmark-spacing coordinates. A second actual-source check rendered Brainstem from 351 voxels into 484 points and 964 triangles. In the Chromium capture run, selecting PTV70 to a visible mesh took 905 ms at 1440×900 and 1,118 ms at 768×1024, including the local API request and lazy chunk load; no separate GPU frame-rate or device-memory profiling is claimed.

Automated fixture checks compare two known voxel indices through C-order decoding, vtk offset lookup, index-to-world mapping, anisotropic spacing and half-voxel marching-cubes bounds. A browser test changes the structure in the 3D selector and checks the resulting geometry and narrow-screen fallback. Actual running-app screenshots for desktop, tablet and mobile are in `.local-review/FIX-04/`; mobile deliberately shows the 2D fallback.

## Dependency and footprint

`@kitware/vtk.js` 37.4.1, BSD-3-Clause, installed only in the spike worktree. It supplies the image data model, marching-cubes filter, WebGL rendering, actor/mapper, and trackball-camera interaction in one scientific rendering stack. vtk.js is dynamically imported: the spike build's main `DoseViewer` chunk is 31.03 kB minified (10.36 kB gzip); the separate 3D chunk is 835.33 kB minified (221.13 kB gzip). No Cornerstone3D, Video.js, React Flow, inference, synthetic mask, or new medical dataset is introduced.

## Verification performed

- `npm run test -- src/features/dosetwin/DoseTwinSurfaceViewer.test.tsx` — 3 passed.
- `python3 -m pytest -q apps/api/tests` — 34 passed, 1 skipped on the combined review branch. The CVS-AdaptNet submodule was initialized at its pinned source revision for the run.
- `npm run test:e2e -- --grep 'DoseTwin reconstructs' --workers=1` — 1 passed.
- `npm run typecheck`, `npm run lint`, `npm run build` — passed.
- Actual `pt_201` source surfaces loaded through the local API in Chromium at 1440×900 and 768×1024; 390×844 confirmed the explicit 2D fallback. No horizontal overflow or browser page errors at any captured size. `python3 scripts/crosscheck_openkbp_pt201.py` passed 23 official metrics (maximum difference 0.0000076471 Gy); `npm run audit:endoscapes-cvs` passed 1,933/1,933 source frames.

The vtk.js version and source/license references are recorded in [`library-spikes.md`](library-spikes.md). D3's local artifact import, validation, comparison and evidence-report workflow is now implemented in the same review branch; the actual source-backed comparison remains gated until an independently sourced compatible second dose array is available. D4 model inference remains blocked until a verified checkpoint/runtime and source rights are established.
