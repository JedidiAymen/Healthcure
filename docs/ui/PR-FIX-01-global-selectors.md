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
- `npm run build` — passed.
- `python3 -m pytest -q apps/api/tests` — passed, 30 tests.
- `npm run contracts:check` — passed after the later API-workspace milestone regenerated `contracts/openapi-implemented.json` and the TypeScript API types for the current Python/Pydantic toolchain. The first check before that regeneration found `ValidationError.ctx` / `ValidationError.input` drift from the checked-in schema; no selector fix caused that difference.
- Existing source-based manual Chromium check: 1,933-frame SurgiVision picker returned 12 of 1,212 matches for `tr`; popup computed to white (`rgb(255,255,255)`) with a 320px max-height. Searching `test 162` / `frame 6575` selected the verified `endoscapes:test:162_6575` source and kept its actual image and overlays. FiSaV `pat011`, DoseTwin ROI selection and the global search dialog were also checked against the running local app; keyboard Escape and focus restoration are covered in Playwright.

Screenshots from the running application are in the private, ignored `.local-review/FIX-01/` directory: `surgi-tr-1440x900.png` (verified source frame) and `educator-picker-{1440x900,768x1024,390x844}.png` (real route with test fixtures). They are local review evidence and are not part of the public source tree.

## Scope still requiring follow-up

- Added a 200%-equivalent layout check at a 720 CSS-pixel viewport with device scale factor 2. The educator case picker remained white (`rgb(255,255,255)`), bounded to 180px, and inside the viewport; the document had no horizontal overflow. Capture: `.local-review/FIX-01/educator-picker-200pct.png`.
- A selector inside a modal and a separate fully keyboard-only SurgiVision route pass remain open; this change introduced no new dialog selector. Existing Playwright coverage checks the Educator combobox's arrow selection, Escape, and focus behavior, and the global command dialog's Escape restoration.
- `contracts:check` passes with the pinned `apps/api/requirements-test.txt` environment. Running it against the machine's unpinned system FastAPI 0.111.0 regenerated `ValidationError` schema differences; those files were restored and not attributed to this UI fix.
