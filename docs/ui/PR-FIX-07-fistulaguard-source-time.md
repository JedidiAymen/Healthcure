# FIX-07 — Preserve FiSaV source-time precision

**Status: focused UI correction implemented.** The wider FistulaGuard milestone still requires full source-backed browser review and all handoff viewport screenshots.

## Change

- Window start controls, waveform and PSD context labels, comparison values, and saved-comparison labels now format seconds with precision derived from the selected recording's actual sample rate. This avoids collapsing distinct timestamps into the previous four-decimal display.
- The same-window guard now treats starts as the same only when they are within half of one source sample. The previous fixed 1 ms threshold incorrectly disabled valid distinct-window comparisons for 10 kHz recordings (0.1 ms per sample).
- No signal values, sample rate, analysis, saved artifact, or API contract changed. No medical interpretation was added.

## Verification

- `npm run test -- src/lib/fistula-time.test.ts src/lib/signal-evidence.test.ts src/lib/source-picker.test.ts` — 8 passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed; existing lazy vtk.js chunk-size warning remains.
- A GET to the running local API returned the installed `pat011` source record with a 10,000 Hz sample rate and checksum prefix `40cd316fd13a`. No browser screenshot or saved real comparison was produced for this focused change.

## Remaining

This corrects start-time precision and the comparison guard only. The broader handoff still calls for 59-record multi-record browser validation, 5/10/20-second boundary checks, evidence save/reopen checks, and actual application screenshots at the required desktop, laptop, tablet, and mobile sizes. No stenosis label or diagnostic result is implied.
