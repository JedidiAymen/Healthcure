# MEDFORGE library adoption record

The Cobalt/Porcelain interface continues to compose the existing shadcn Base Nova/Base UI source. This record separates verified package facts from adoption decisions; package installation alone is not evidence of scientific compatibility.

| Library | Source / checked version | License | Result for this milestone |
|---|---|---|---|
| shadcn/ui Base Nova components | Checked-in local source; `@base-ui/react` 1.8.0, Tailwind 4.3.3 | MIT | **KEEP.** Sidebar, Button, Card, Badge, Select, Toggle and Slider are reused and styled through semantic tokens. |
| Inter Variable | `@fontsource-variable/inter` 5.3.0 | OFL-1.1 | **ADOPT.** Locally hosted; browser-selectable unicode subsets emitted separately. |
| Plus Jakarta Sans Variable | `@fontsource-variable/plus-jakarta-sans` 5.3.0 | OFL-1.1 | **ADOPT.** Academy display token is ready; Academy page adoption is a later milestone. |
| IBM Plex Mono | `@fontsource/ibm-plex-mono` 5.3.0 | OFL-1.1 | **ADOPT.** Measurement font token is ready; viewer numeric labels retain tabular numbers. |
| React Flow (`@xyflow/react`) | Official React Flow UI/workflow docs | MIT | **DEFER.** Current run records expose fixed application stages and states rather than executable, user-authored graph nodes/edges. A diagram would imply workflow control the API does not provide. Revisit when a real graph API exists. |
| Cornerstone3D (`@cornerstonejs/core`) | Registry metadata 5.11.7; official Cornerstone docs | MIT | **DEFER for the current processed-array source.** OpenKBP here is a processed 128³ grid without DICOM patient orientation, origin or UIDs. vtk.js meets the D2 surface requirements on one isolated branch, so a second competing renderer is not added. Revisit with an authorized DICOM source or a demonstrated Cornerstone-specific feature need. |
| Video.js React (`@videojs/react` 10.0.1) | Installed package metadata and local `LICENSE`; official Video.js v10 React integration | Apache-2.0 | **ADOPT.** The same player handles the verified CC BY 4.0 Appendix300 event clip and the locally installed, full-rate Cholec80 video with a frame-aligned, checksum-verified source phase track. The two sources remain selectable and their annotations never cross. Cholec80 tool-presence labels are still shown only at their actual 1 fps sample rate. |
| Trophy UI achievement components | Official [Achievement Badge](https://ui.trophy.so/docs/components/achievement-badge) and [Achievement Grid](https://ui.trophy.so/docs/components/achievement-grid) source from `trophyso/ui` commit `81ee8a192b781aa1dff39c972fef692b31e3359e`; [MIT license at that commit](https://github.com/trophyso/ui/blob/81ee8a192b781aa1dff39c972fef692b31e3359e/LICENSE.md) | MIT | **ADOPT selectively.** Badge, Grid and PointsBadge use only earned records and opted-in preferences returned by MEDFORGE's own API. The once-only unlocked announcement is also implemented and reads persisted award grants (PR-UX-19). No Trophy SDK or remote service is used. |
| uPlot | Existing package 1.6.32 | MIT | **KEEP.** FistulaGuard's measured waveform, sample rate, and window semantics remain in place. |
| Recharts + shadcn Chart | Existing Recharts 3.10.1 | MIT | **KEEP.** Dose DVH remains bound to actual benchmark arrays with the accessible data table. |
| vtk.js | [`@kitware/vtk.js` 37.4.1](https://www.npmjs.com/package/@kitware/vtk.js/v/37.4.1); [official API documentation](https://kitware.github.io/vtk-js/) and [source license](https://github.com/Kitware/vtk-js/blob/master/LICENSE) | BSD-3-Clause | **ADOPT IN D2 SPIKE.** Source-backed OpenKBP ROI masks are converted into cropped `vtkImageData` with the original X/Y/Z index mapping and anisotropic spacing, then surfaced with marching cubes. Real `pt_201` Brainstem and PTV70 meshes, bounds and index geometry were checked. Lazy loading keeps the 835 kB minified 3D chunk out of the main DoseTwin bundle; phone-width and failed WebGL paths return to D1. Continue as a separate review branch until the project accepts the spike. |
| dnd-kit | Existing `@dnd-kit/*` versions in `package.json` | MIT | **KEEP.** Educator lesson order and keyboard behavior stay on its existing integration. |
| Motion | Existing Motion 14.0.0 | MIT | **KEEP SMALL.** Academy interactions retain reduced-motion handling; no scientific image or plot is animated. |

## Remaining adoption gates and source limits

- Cornerstone3D: retain the decision above; revisit only when a verified DICOM-backed source or specific missing capability justifies an additional renderer.
- Trophy Grid: source is integrated and mapped to persisted server awards. The source-backed temporary QA review in PR-UX-06 closed this gate with an educator-reviewed FiSaV assignment; its award was not seeded directly.
- Trophy Achievement Unlocked: implemented from persisted API awards with per-learner once-only tracking; see PR-UX-19.
- React Flow: wait for actual persisted graph operations; keep current ordered state display accessible.
- Full-rate Cholec80 playback and its publisher-provided frame-matched phase labels are available for the single local clip described in PR-UX-39. The 1 fps tool-presence track is not interpolated. Appendix300 is a separate appendectomy clip with its own timed publisher event. No temporal model output exists for either clip; do not imply cross-dataset correspondence.
