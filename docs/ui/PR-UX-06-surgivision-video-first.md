# PR-UX-06 — SurgiVision native video first

Professional SurgiVision now places the locally verified Appendix300 clip in the primary media stage, expands it by default, and uses Video.js 10's React player with the neutral skin. The Endoscapes-BBox201 workspace remains below as a separate annotated-still mode. Source text explicitly says the clip is a different appendectomy dataset and has no Endoscapes masks or annotations; no labels are carried between sources.

The licensed clip endpoint remains the existing local byte-range route. The player loads metadata first and waits for a clinician/researcher to press play. This change adds no timeline-to-frame mapping or inferred temporal labels.

## Component and license

- `@videojs/react` **10.0.1**, Apache-2.0; React 19 peer support verified from package metadata. The Video.js CLI generated the exact Vite/React installation plan.
- Uses `VideoPlayer`, `NeutralVideoSkin`, and `Video`; upstream version-matched component documentation is bundled under `node_modules/@videojs/react/docs`.
- The player is limited to the existing locally verified MP4 source. It does not introduce HLS, additional data, or an external player service.

## Test coverage

The SurgiVision Playwright scenario verifies the primary player is visible, accurately discloses the separate procedure dataset, can start playback on a tiny generated black-frame test-only MP4, and leaves annotated Endoscapes frame inspection available below it. The fixture is not medical data and is used only to smoke-test the browser player. Existing API tests verify the real clip's metadata and byte-range behavior.

Passed: `npm run typecheck`, `npm run lint`, `npm run test` (36 tests), `npm run build`, `npm run contracts:check`, `npm run test:e2e -- --workers=1` (10 tests), and `python3 -m pytest apps/api/tests/test_appendix300.py -q` (2 tests). The build reports an existing large vtk.js chunk warning and a React compiler directive warning from the new player dependency; compilation succeeds.

## Review artifacts

No application screenshot is claimed for this milestone. The 200%-zoom Educator picker check now compares the CSS `40vh` cap with the browser's visual viewport, which matches how viewport units are resolved in Chromium during emulation.
