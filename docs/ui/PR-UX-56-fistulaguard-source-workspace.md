# UX-56 · FiSaV source workspace visibility

## Changes

- Made the selected recording's dataset, channel count, source sample rate, total time, row count, verification state, and SHA-256 fingerprint visible beside the waveform controls.
- Added a source-time locator that shows the selected interval against the verified recording duration. It reports exact seconds from the source timebase; channel, window, and analysis requests still use the existing controls and API.
- Expanded the measured uPlot waveform to 420px on desktop, 360px on tablet, and 300px on phones so the source trace remains the primary visual task.
- Kept the checksum, uncalibrated-unit disclosure, measured sample count, window calculations, spectrogram, PSD, comparison/report behavior, guided-mode locks, and diagnostic limitations intact.

## Files changed

- `src/pages/FistulaViewer.tsx`
- `src/pages/fistulaguard.css`
- `docs/ui/PR-UX-56-fistulaguard-source-workspace.md`

## Components, versions, licenses

- Existing shadcn Base Nova components on Base UI; no component registry copy and no dependency added.
- Existing uPlot 1.6.32 (MIT) continues to render measured waveforms.
- Existing Recharts 3.10.1 (MIT) continues to render PSD.
- Existing Tailwind CSS 4.3.3 (MIT) and the scoped FistulaGuard CSS provide layout and styling.

## Local visual evidence

Actual local route `/studio/fistulaguard/cases/fisav:pat001`; captures and browser report are private under `.local-review/FG-LOCATOR/`:

- `fistulaguard-1440x900.png`
- `fistulaguard-1440x900-firstfold.png`
- `fistulaguard-1280x800.png`
- `fistulaguard-768x1024.png`
- `fistulaguard-390x844.png`
- `report.json`

All four viewports returned HTTP 200, displayed the source fingerprint and time locator, had no page errors, and had no document-level horizontal overflow. Desktop and mobile captures were visually inspected.

## Checks

- `npm run typecheck` — passed.
- `npm run lint -- --no-warn-ignored` — passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npx playwright test --workers=1 --grep "embedded FiSaV evidence controls" --output=/tmp/fg-review-e2e` — 1 passed. Covers the existing selected-channel controls and 390px overflow check with mocked educator access.
- `git diff --check` — passed.
- The source-backed `fistulaguard-authentic.spec.ts` reached the saved-comparison phase but cannot complete it in this environment because `MEDFORGE_E2E_RESEARCH_USERNAME` and `MEDFORGE_E2E_RESEARCH_PASSWORD` are not set. The test confirmed the full source hash is visible after this change. No credentials or account state were created or changed.

## Limits

- This is a presentation and source-inspection milestone. It does not add audio playback, sensor calibration, a stenosis classifier, diagnostic thresholds, or clinical interpretations.
- FiSaV access rights must still be verified independently for event use; a publication license alone does not establish raw-file reuse terms.
- Screenshot files use local permitted data and are intentionally not committed.
