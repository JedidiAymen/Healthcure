# UX-60 · FistulaGuard waveform cursor inspection

## Change

- Moving the pointer over the measured uPlot trace now reports the nearest displayed FiSaV point with its source timestamp in seconds and its raw channel value.
- The readout states that its value is in the source-value unit (physical unit unspecified). It reports only points in the existing display envelope; the waveform table continues to disclose the envelope and the analyses continue to use every source sample.
- The value readout is outside the fixed-height chart, wraps on narrow screens, and resets while a new selected window is loading.
- No clinical threshold, calibration, diagnosis, or device interpretation was added.

## Files changed

- `src/pages/FistulaViewer.tsx`
- `src/pages/fistulaguard.css`
- `docs/ui/PR-UX-60-fistulaguard-waveform-cursor-inspection.md`

## Components and dependencies

- Existing uPlot 1.6.32 (MIT) renders the measured trace and supplies the active cursor index.
- Existing shadcn/Base UI and Tailwind CSS components/layout remain in use. No dependencies or component source were added.

## Validation

- `npm run typecheck` — passed.
- `npx eslint src/pages/FistulaViewer.tsx` — passed.
- `git diff --check` — passed.

## Scope

- This is a source-inspection affordance over the already checksum-verified FiSaV window. It does not change the source data, API, calculation, database, or persistence behavior.
