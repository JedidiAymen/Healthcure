# UX-36 — Live scientific chart and saved-view review

## Review scope

This milestone closes two open browser-review items in the local redesign status: keyboard inspection of the latest shadcn ChartContainer/tooltips, and interactive reload/resize restoration of professional scientific-view preferences. The running app used the installed source collections and a disposable database. No source files, source manifests, user accounts, or application databases were changed.

## Live chart results

- DoseTwin opened authentic OpenKBP `pt_201`. Focusing the Recharts DVH and pressing ArrowRight exposed **1.45 Gy / 43.9%**. Its source-derived data table and the separate official benchmark metric table remained present.
- FistulaGuard opened authentic FiSaV `pat001`, raw PZT1, 0–5 seconds. Focusing the Recharts Welch PSD and pressing ArrowRight exposed **1 Hz / 8.112e-3** in the plotted power units. The measured waveform table, PSD table, source hash, and unspecified physical-unit caveat remained available.
- Opened both chart data companions and checked their actual first rows: DoseTwin **0 Gy / 100%**; FiSaV PSD **0 Hz / 1.06250658e-3**.
- Both routes loaded the live API data and chart at 1440×900, 1280×800, 768×1024 and 390×844. All returned HTTP 200; there was no document horizontal overflow, JavaScript error, or failed data API request. The chart remained within the usable page width at phone size.

## Saved-view restoration

After changing settings through the UI, each exact view was reloaded and resized:

- **DoseTwin:** `openkbp:pt_201`, voxel `[43,54,65]`, X-index plane, RightParotid, dose overlay off, ROI edge on, opacity 0.5. The inputs, selected ROI, plane and overlay controls matched the saved view after reload at 390×844.
- **SurgiVision:** authentic Endoscapes frame `endoscapes:test:162_6575`, annotation `162065750`, boxes off, 125% zoom. The box was selected with keyboard focus and Enter because source rectangles overlap; frame data and image routes returned HTTP 200, and the selected ID, overlay state and zoom returned after reload at 390×844. The browser canceled in-flight Appendix300 byte-range reads when the route was reloaded; the player requests themselves returned HTTP 206 before cancellation.
- **FistulaGuard:** authentic FiSaV `pat001`, raw PZT2, start 1.2345 seconds, 10-second window. The saved record, numeric control, channel selection and duration button matched after reload at 768×1024.

The unit parser tests already cover invalid values and cross-case rejection. This browser review checks persistence end-to-end on real installed records; it does not imply that localStorage synchronizes across browsers or users.

## Captures

These source-backed screenshots and `review.json` are ignored local files because they contain local research imagery:

- `.local-review/UX-36/dosetwin-desktop.png`
- `.local-review/UX-36/dosetwin-laptop.png`
- `.local-review/UX-36/dosetwin-tablet.png`
- `.local-review/UX-36/dosetwin-phone.png`
- `.local-review/UX-36/fisav-pat001-desktop.png`
- `.local-review/UX-36/fisav-pat001-laptop.png`
- `.local-review/UX-36/fisav-pat001-tablet.png`
- `.local-review/UX-36/fisav-pat001-phone.png`
- `.local-review/UX-36/review.json`

## Components and libraries

No dependency or UI component was added. The review covers the existing generated shadcn Base Nova Chart and Table compositions, Recharts accessibility layer, uPlot waveform renderer, and saved preference parser. Installed UI package versions and source/license references remain in [`library-spikes.md`](library-spikes.md).

## Gate result

**PASS for chart keyboard inspection and saved-view reload/resize behavior.** External display rights remain unresolved as separately recorded in `docs/RELEASE_CHECKLIST.md`; this review does not change that gate.
