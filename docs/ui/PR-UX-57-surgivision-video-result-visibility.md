# UX-57 — Keep the sparse video result state visible

**Status:** focused source-backed video UX correction.

## Change

Appendix300 has one verified publisher event at `23.161489 s`. At other timestamps, the in-video result area was empty, which made a correctly sparse source annotation look like no result was available. The video now keeps a small source-result overlay visible throughout the clip: it reports that no event is labeled at the current time, points to the exact published event time and grade, and states that no temporal model output is installed. Seeking to the publisher event still replaces it with the existing event overlay. No annotation is carried across frames and no prediction is fabricated.

Cholec80 behavior is unchanged: its per-frame publisher phase remains tied to the exact 25 fps source frame. CholecT50 sparse tool/action labels remain on their matching sampled frames. Source files, licenses, APIs, calculations, and permissions were not changed.

## Files

- `src/pages/SurgiViewer.tsx`
- `tests/e2e/surgivision-appendix300-source-annotation.spec.ts`
- `docs/ui/PR-UX-57-surgivision-video-result-visibility.md`

## Evidence

- Focused browser test: `npx playwright test tests/e2e/surgivision-appendix300-source-annotation.spec.ts --workers=1` — **1 passed**. It checks the truthful no-event/no-model state at the clip start, then seeks to and verifies the exact source event overlay and responsive bounds.
- `npm run typecheck -- --pretty false` — passed.
- Scoped ESLint on `src/pages/SurgiViewer.tsx` — passed. The Playwright spec has no matching ESLint configuration and was reported as ignored.
- `git diff --check` — passed.
- Actual running-app capture: `.local-review/SURGIVISION-EVENT-RESULT-STATE/appendix-no-event-1440.png` (ignored local evidence; not committed).
