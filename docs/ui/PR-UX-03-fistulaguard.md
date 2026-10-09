# UX-03 · FistulaGuard source signal lab

## Status

**PARTIAL — visual redesign implemented; final full build and interaction review are pending the concurrent SurgiVision edit.**

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

## Checks actually run

- `npm run typecheck` — passed before the concurrent SurgiVision edit.
- `npm run lint` — passed before the concurrent SurgiVision edit.
- `npm test` — 4 files, 17 tests passed before the concurrent SurgiVision edit.
- Four-viewport Playwright browser capture — completed; all routes returned 200 with zero page errors and zero horizontal overflow.

`npm run build` was attempted while the concurrent SurgiVision edit was syntactically incomplete and stopped on JSX parse errors in `src/pages/SurgiViewer.tsx` (lines 185–186), outside this scope. After SurgiVision stabilized, a fresh `npx eslint src/pages/FistulaViewer.tsx` passed; the full-project typecheck is currently blocked by an unused `Trophy` import in the concurrent Academy edit at `src/pages/Pages.tsx:31`. The later interaction attempt encountered the resulting Vite overlay. Full build, E2E, and signal interaction checks should be rerun when that shared Academy edit is stable. No FistulaViewer TypeScript or lint error was reported.

## Scientific and privacy boundaries

- No data-processing, API, calculation, report, or schema files were changed.
- No FiSaV assets or screenshots are added to Git; the local captures can contain source material and remain ignored.
- The original sample timebase, selected channel/window semantics, and API-produced source hash stay in use. Sensor calibration and physical units remain unspecified.
- No synthetic data, normalization, diagnosis, or newly installed package was introduced.
