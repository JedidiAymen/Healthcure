# UX-32 — Keep the SurgiVision video result visible

## Change

The Appendix300 source event and grade were already aligned to the correct time, but the “Jump to source event” button sits below the player. Clicking it scrolled the button into view while leaving the top of the video above the viewport; the source label was therefore rendered outside the visible screen. The seek handler now brings the player back below the sticky header after seeking. The publisher event stays visible over its video frame while paused at 00:23.161489.

The source mode now reads “Appendix300 · source event,” and the mode summary describes the publisher-timed event. This distinguishes the real event/grade from the separate sparse CholecT50 and Endoscapes labels. It remains publisher ground truth, not an AI prediction. The video has no continuous masks, triplets, phase labels, or model output.

## Verification

- `MEDFORGE_API_PORT=18098 MEDFORGE_E2E_SOURCE_API=1 npx playwright test tests/e2e/surgivision-appendix300-source-annotation.spec.ts --workers=1` — **1 passed** against the installed Appendix300 media and metadata. The browser check confirms the seek time, visible overlay bounds inside the video, and no horizontal overflow at 1440×900, 768×1024, and 390×844.
- `npx playwright test tests/e2e/cholect50-sampled-review.spec.ts --workers=1` — **1 passed**; the updated media-mode name and separate matching-source replay are covered.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- Source-backed actual-app screenshots: `.local-review/UX-32/surgivision-source-event-1440x900.png`, `surgivision-source-event-768x1024.png`, and `surgivision-source-event-390x844.png` (ignored by Git).

## Components and data

- Existing shadcn/Base UI `Tabs`, `Card`, `Badge`, and `Button` components; no new packages.
- Existing `@videojs/react` 10.0.1 Apache-2.0 player and locally installed OPARA Appendix300 clip, CC BY 4.0.
- Only the source publisher's timestamped event and Gomes grade are shown. No other cohort medical metadata is retained or displayed.
