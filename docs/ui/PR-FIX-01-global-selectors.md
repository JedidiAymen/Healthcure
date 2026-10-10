# FIX-01 — Global selectors, autocomplete and popover repair

**Status: Implemented; current contract check is green.** This is a shared UI correction for the approved Cobalt / Porcelain system. It preserves the medical viewers, source identities, permissions and scientific calculations.

## What changed

- Replaced the conflicting legacy dark-teal root with the single B palette root, including the seven missing Tailwind v4 semantic mappings for popover, accent, input, ring and destructive states. Existing shell/sidebar aliases remain.
- Updated the existing Base UI combobox and select wrappers: opaque white surface, border, shadow, explicit text/highlight colors, selected checkmark, minimum row/trigger sizing, viewport-aware width, a 320px/40vh maximum and contained scrolling. No UI package was added.
- Added one shared case picker. It uses the existing Select for up to 20 eligible cases and the existing Combobox above that threshold; both filter to installed `ready` records, preserve the selected ID while typing, show a bounded result count and leave publication-right checks in place.
- SurgiVision searches all installed Endoscapes frame metadata, supports split/video/frame/id terms, retains the selected frame while typing, shows at most 12 results and reports the total. FistulaGuard uses the same capped matching behavior for all 59 recordings. The Experiments case field now follows the shared 20-case threshold; DoseTwin's 10-option ROI field remains a Select.
- Global CommandDialog search now restores focus to its trigger on Escape/close. Student source visibility and educator publication checks were not relaxed.

## Existing libraries

| Component | Installed version | License | Use |
|---|---:|---|---|
| `@base-ui/react` | 1.8.0 | MIT | Existing accessible combobox/select primitives, portal and collision-aware positioning |
| Tailwind CSS | 4.3.3 | MIT | Existing semantic token utilities |
| `cmdk` | 1.1.1 (lockfile-resolved) | MIT | Existing global command palette |

No package was installed for this fix.

## Verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test` — passed, 22 tests across 5 files.
- `npm run test:e2e -- --workers=1` — passed, 5 Playwright tests. The Educator case-picker route checks actual popup computed white background, viewport containment and bounded height at 1440×900, 768×1024 and 390×844; screenshots use the actual application route with isolated fixture records.
- Follow-up zoom-layout check: the same real route was checked with Chromium device metrics set to DPR 2 and a 720×450 CSS viewport (the layout equivalent of 1440×900 at 200%). The popup remained white, bounded to 180px high, inside the viewport, and the document did not overflow. Screenshot: `.local-review/FIX-01/educator-picker-200-percent-720x450.png`. This is device-metric emulation, not a browser UI zoom capture.
- Follow-up actual-source Chromium review found and fixed a tablet-only SurgiVision layout defect: the `md:flex-row` toolbar compressed its search anchor to 16px at a 768px viewport after the persistent sidebar took its width. The toolbar now stacks until `xl`, and the popup measured 464px at 1440, 441px at 768, and 303px at 390. The frame, FiSaV and DoseTwin menus computed to opaque white in all three actual-source routes; row counts stayed within the intended cap, and all routes had no page errors or horizontal overflow. Screenshots are in `.local-review/FIX-01/current-real-app/`.
- Added a Playwright regression for the 768px SurgiVision layout: it asserts the shared picker gets a readable popup (≥240px), stays within the viewport, remains opaque, and does not introduce document overflow. With the fixture, it also searches a second frame using ArrowDown + Enter and verifies the route/selected frame update. The fixture is explicitly test-only; the separate screenshot set above uses local source records.
- After the regression was added, `npm run typecheck`, `npm run lint`, `npm run test` (28 passed), `npm run build`, and `npm run test:e2e -- --workers=1` (9 passed) succeeded. The known lazy vtk.js chunk-size warning remains.
- `npm run build` — passed.
- `python3 -m pytest -q apps/api/tests` — passed, 30 tests.
- `npm run contracts:check` — passed after the later API-workspace milestone regenerated `contracts/openapi-implemented.json` and the TypeScript API types for the current Python/Pydantic toolchain. The first check before that regeneration found `ValidationError.ctx` / `ValidationError.input` drift from the checked-in schema; no selector fix caused that difference.
- Existing source-based manual Chromium check: 1,933-frame SurgiVision picker returned 12 of 1,212 matches for `tr`; popup computed to white (`rgb(255,255,255)`) with a 320px max-height. Searching `test 162` / `frame 6575` selected the verified `endoscapes:test:162_6575` source and kept its actual image and overlays. FiSaV `pat011`, DoseTwin ROI selection and the global search dialog were also checked against the running local app; keyboard Escape and focus restoration are covered in Playwright.

Screenshots from the running application are in the private, ignored `.local-review/FIX-01/` directory: `surgi-tr-1440x900.png` (verified source frame) and `educator-picker-{1440x900,768x1024,390x844}.png` (real route with test fixtures). They are local review evidence and are not part of the public source tree.

## Scope still requiring follow-up

The Chromium 2× viewport emulation above covers the zoomed layout, but an actual browser UI zoom sweep is not captured. Keyboard-only selection, Escape cancellation and focus behavior against installed source records is now covered by [`PR-UX-45`](PR-UX-45-source-selector-keyboard-access.md). The app currently has no Select/Combobox inside a dialog: the global search dialog uses cmdk's own listbox. Therefore a selector-in-dialog workflow has no current route to verify; shared selector popups continue using Base UI's portal and positioner. No artificial product flow was added solely for this check. The contract generator now matches the checked-in schema in this working tree; the repository's Python/Pydantic dependency pinning still determines reproducibility across other machines.
