# UX-30 — Put Appendix300 source annotations on their video frame

## Change

The installed Appendix300 excerpt was linked by filename to its official metadata row. That row marks appendix visibility at `23.161489` seconds and reports a final laparoscopic grade of `2` on the Gomes scale. The installer now fetches the official `overall_merged.csv` bitstream, verifies its UUID, byte size, MD5 and ETag, selects exactly one row for the selected video, and retains only that event and grade in the local source manifest. The full patient-metadata CSV is not stored or served by MEDFORGE.

The native player has a **Jump to source event** control. It seeks to the publisher timestamp and displays the source event and grade over that frame, with a persistent annotation card below the player. The copy identifies it as source ground truth, not a model result. Tool masks, phase labels, action triplets and AI predictions remain unavailable for this clip. The tab selector stacks below desktop width after a tablet review found an overlap.

## Verification

- `MEDFORGE_API_PORT=18098 MEDFORGE_E2E_SOURCE_API=1 npx playwright test tests/e2e/surgivision-appendix300-source-annotation.spec.ts --workers=1` — **1 passed** against the installed video and real metadata.
- `npm run contracts:check` — passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed; existing large-chunk and React Compiler directive warnings remain.
- Desktop, tablet and phone layouts were checked in the running app with no horizontal document overflow. Actual local screenshots: `.local-review/UX-29-appendix300-source-label/desktop-1440x900.png`, `tablet-768x1024.png`, and `mobile-390x844.png` (ignored by Git).

## Components, source and limits

- Existing MEDFORGE shadcn Base UI `Card`, `Badge` and `Button` components; no new UI packages or component sources were added.
- Existing `@videojs/react` `10.0.1`, Apache-2.0, continues to provide native video and media events.
- Source video: OPARA Appendix300, CC BY 4.0. Its data row is bound by its `Center` and `Video` fields; its publisher-reported annotation is `Timestamp` and `Final Laparoscopic grading of appendicitis` from the Gomes scale. The app shows no other clinical cohort fields.
- This is an appendectomy clip. It has no aligned CholecT50 or Endoscapes labels, no instrument masks and no model outputs. Do not describe the source annotation as a prediction or clinical recommendation.
