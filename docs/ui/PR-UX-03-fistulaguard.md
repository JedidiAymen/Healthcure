# UX-03 · FistulaGuard source signal lab

## Status

**PASS FOR THE FISTULAGUARD SLICE — the UX-03 SurgiVision milestone remains separately reviewed.**

## What changed

- Reordered the FistulaGuard page around a wide, dark waveform viewport. The selected channel trace now occupies the primary visual area, with the Welch PSD and time-frequency views in a full-width section beneath it.
- Moved the source-record selector, ECG/PZT channel selection, exact window start, 5/10/20-second duration, and source-time slider into a sticky control strip.
- Added explicit X captured-time and Y source-value context, sample counts, and a note that the plotted min/max envelope is only a rendering reduction: selected-window analyses still use all source samples.
- Kept the existing checksum-verified record load, source hash and attribution, exact timestamp requests, selected-window Welch PSD, bounded spectrogram, descriptive features, source-value unit caveat, comparison persistence/reopen, guided-mode locks, and research-only/diagnostic limitations.
- The viewer continues to show raw sensor channels and makes no stenosis or other diagnostic interpretation.

## Files changed

- `src/pages/FistulaViewer.tsx`
- `src/pages/fistulaguard.css` (new, scoped to the FistulaGuard workspace)
- `docs/ui/PR-UX-03-fistulaguard.md`

## Components and libraries

- Existing shadcn Base Nova / Base UI components: `Card`, `Badge`, `ToggleGroup`, `Combobox`, `Field`, `Input`, `Slider`, `Tabs`, and data tables. No registry source was copied and no UI dependency was added.
- Existing uPlot **1.6.32**, MIT, renders the measured waveform.
- Existing Recharts **3.10.1**, MIT, remains responsible for the existing accessible PSD view.
- Tailwind 4 semantic theme tokens and local FistulaGuard-scoped CSS; no global token changes.

## Evidence captured

Actual local Healthcure route `/studio/fistulaguard/cases/current`, using locally provisioned FiSaV `pat001` and its verified source hash `b9816e8c06975b887195a790f6c5eaa4244c90c617fca001e451a8ce28e4763b`.

Screenshots and browser report are private, ignored review artifacts under `.local-review/UX-03/fistula/`:

- `fistulaguard-1440x900.png`
- `fistulaguard-1280x800.png`
- `fistulaguard-768x1024.png`
- `fistulaguard-390x844.png`
- `report.json`

At all four sizes the route returned HTTP 200, rendered the real uPlot trace, produced no uncaught browser errors, and had no document-level horizontal overflow. The 1440px and 390px captures were visually inspected.

The running application interaction check selected a 10-second `raw PZT3` window at 5.1234 seconds and a 5-second `raw PZT2` window at 7.3333 seconds; exact selected time ranges appeared beside the measured trace. A same-record comparison was saved, remained listed after a page reload, and was available again after reopening the comparison panel. Switching to `pat002` changed the visible recording header and SHA-256 to `6c211580f3889b8516dd26976ba2d4aef43bd96bfb0158d0e02e55985416cb77` (distinct from `pat001` above). No uncaught browser error occurred.

## Checks actually run

- `npm run typecheck` — passed on the integrated branch after concurrent Academy/educator edits stabilized.
- `npm run lint` — passed on the integrated branch.
- `npm test` — 4 files, 17 tests passed.
- `npm run build` — passed; FistulaViewer route chunk is 85.55 kB (31.83 kB gzip) and its scoped CSS is 3.34 kB (1.27 kB gzip).
- `npm run test:e2e -- --workers=1` — 2 passed.
- Four-viewport actual-app browser capture and the FistulaGuard interaction check described above — passed with zero page errors.

An earlier build attempt collided with in-progress SurgiVision JSX, and an intermediate full lint was blocked by an unused Academy import; both were resolved by their respective concurrent edits before the final checks listed above. No FistulaViewer TypeScript or lint error was reported.

## Scientific and privacy boundaries

- No data-processing, API, calculation, report, or schema files were changed.
- No FiSaV assets or screenshots are added to Git; the local captures can contain source material and remain ignored.
- The original sample timebase, selected channel/window semantics, and API-produced source hash stay in use. Sensor calibration and physical units remain unspecified.
- No synthetic data, normalization, diagnosis, or newly installed package was introduced.
