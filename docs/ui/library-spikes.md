# MEDFORGE library adoption record

The Cobalt/Porcelain interface continues to compose the existing shadcn Base Nova/Base UI source. This record separates verified package facts from adoption decisions; package installation alone is not evidence of scientific compatibility.

| Library | Source / checked version | License | Result for this milestone |
|---|---|---|---|
| shadcn/ui Base Nova components | Checked-in local source; `@base-ui/react` 1.8.0, Tailwind 4.3.3 | MIT | **KEEP.** Sidebar, Button, Card, Badge, Select, Toggle and Slider are reused and styled through semantic tokens. |
| Inter Variable | `@fontsource-variable/inter` 5.3.0 | OFL-1.1 | **ADOPT.** Locally hosted; browser-selectable unicode subsets emitted separately. |
| Plus Jakarta Sans Variable | `@fontsource-variable/plus-jakarta-sans` 5.3.0 | OFL-1.1 | **ADOPT.** Academy display token is ready; Academy page adoption is a later milestone. |
| IBM Plex Mono | `@fontsource/ibm-plex-mono` 5.3.0 | OFL-1.1 | **ADOPT.** Measurement font token is ready; viewer numeric labels retain tabular numbers. |
| React Flow (`@xyflow/react`) | Official React Flow UI/workflow docs | MIT | **DEFER.** Current run records expose fixed application stages and states rather than executable, user-authored graph nodes/edges. A diagram would imply workflow control the API does not provide. Revisit when a real graph API exists. |
| Cornerstone3D (`@cornerstonejs/core`) | Registry metadata 5.11.7; official Cornerstone docs | MIT | **DEFER pending a one-case adapter/parity spike.** Initial package review lists VTK.js 36.4.1, gl-matrix, Comlink and Cornerstone utilities. OpenKBP here is a processed 128³ array without DICOM patient orientation, spacing or UIDs. Adoption requires an explicitly index-space custom loader, 3-axis click parity, overlay comparison, DVH equality, and a bundle/worker review. The existing source-preserving canvas remains accurate and responsive meanwhile. |
| Video.js (`video.js`) | No runtime package installed; the supplied correction points to the current v10 React integration docs | Apache-2.0 | **DEFER.** The new source manifest/viewer report `annotated_stills`, with null movie path/FPS/duration and no stream capability. Endoscapes BBox201 cannot support continuous playback or a timeline. Revisit a pinned Video.js release only after an authorized, validated recording and a React 19 playback/Range smoke test are available. |
| Trophy UI achievement components | Official component source: [Trophy UI](https://ui.trophy.so/docs/components/achievement-badge); upstream license [MIT](https://github.com/trophyso/ui/blob/main/LICENSE.md); source commit `81ee8a192b781aa1dff39c972fef692b31e3359e` | MIT | **ADOPT selectively in Academy milestone.** Badge and Grid must display only achievements returned by the existing opted-in, authorized API. No Trophy SDK/service call is needed. An unlocked-dialog source requires accessible Base UI dialog behavior before it can be used. |
| uPlot | Existing package 1.6.32 | MIT | **KEEP.** FistulaGuard's measured waveform, sample rate, and window semantics remain in place. |
| Recharts + shadcn Chart | Existing Recharts 3.10.1 | MIT | **KEEP.** Dose DVH remains bound to actual benchmark arrays with the accessible data table. |
| dnd-kit | Existing `@dnd-kit/*` versions in `package.json` | MIT | **KEEP.** Educator lesson order and keyboard behavior stay on its existing integration. |
| Motion | Existing Motion 14.0.0 | MIT | **KEEP SMALL.** Academy interactions retain reduced-motion handling; no scientific image or plot is animated. |

## Exact adoption gates still open

- Cornerstone3D: build and run a temporary one-case custom array adapter; compare all displayed values and voxel clicks with the current viewer; do not add to production unless it passes.
- Trophy Grid: map persisted server awards to official free component source, verify opt-in and empty states, add no mock badges or invented level thresholds.
- React Flow: wait for actual persisted graph operations; keep current ordered state display accessible.
- Video.js: require rights-cleared continuous footage with source-aligned annotations; retain keyframe-only mode until then.
