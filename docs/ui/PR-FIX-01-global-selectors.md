# FIX-01 — Global selectors, autocomplete and popover repair

**Status: Implemented; local checks passed except the contract drift check described below.** This is a shared UI correction for the approved Cobalt / Porcelain system. It preserves the medical viewers, source identities, permissions and scientific calculations.

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
- `npm run contracts:check` — **not clean in this environment**. Its OpenAPI export removed `ValidationError.ctx` and `ValidationError.input` compared with the checked-in schema, so the generated contract check reports drift. Those unrelated generated changes were discarded; no API schema or generated types were changed for this UI fix.
- Existing source-based manual Chromium check: 1,933-frame SurgiVision picker returned 12 of 1,212 matches for `tr`; popup computed to white (`rgb(255,255,255)`) with a 320px max-height. Searching `test 162` / `frame 6575` selected the verified `endoscapes:test:162_6575` source and kept its actual image and overlays. FiSaV `pat011`, DoseTwin ROI selection and the global search dialog were also checked against the running local app; keyboard Escape and focus restoration are covered in Playwright.

Screenshots from the running application are in the private, ignored `.local-review/FIX-01/` directory: `surgi-tr-1440x900.png` (verified source frame) and `educator-picker-{1440x900,768x1024,390x844}.png` (real route with test fixtures). They are local review evidence and are not part of the public source tree.

## Scope still requiring follow-up

The 200% browser-zoom sweep, popup inside a selector-bearing modal, and fully interactive keyboard-only frame selection were not separately captured in this fix. No new dialog selector was introduced. Contract generation must be made deterministic for the repository's pinned Python/Pydantic toolchain before claiming the contract check is green.
