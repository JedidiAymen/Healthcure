# UX-26 — Make SurgiVision's authentic labels easy to find

## Change

The video-first SurgiVision view still opens on the installed Appendix300 laparoscopic appendectomy clip. That footage has no aligned annotations, so the viewer now states that directly beneath the player and provides a prominent action to open the separate CholecT50 sampled replay. Selecting it switches to the source-labeled tab, where actual published tool-tip boxes and action labels are shown on their exact checksum-verified cholecystectomy frames.

The message identifies the procedures and says the labels belong to separate sparse samples. The feature does not overlay those labels on the Appendix300 clip or claim MEDFORGE generated them. Existing generated shadcn/Base UI Tabs and Button components are used; no dependency or API change.

## Verification

- Clean-CI fixture mode: `npx playwright test tests/e2e/cholect50-sampled-review.spec.ts --workers=1` passed (1 test) without a running API or installed research datasets.
- Real installed-source mode: `MEDFORGE_API_PORT=18098 MEDFORGE_E2E_SOURCE_API=1 npx playwright test tests/e2e/cholect50-sampled-review.spec.ts --workers=1` passed (1 test) against the local source API. It follows the new action to the CholecT50 player, verifies the exact-source boxes, plays/pauses real samples, and captures desktop, tablet and phone layouts.
- `npm run lint`, `npm run typecheck`, and `npm run build` passed.
- Running-app captures with real installed source media are in `.local-review/SURGIVISION-MEDIA-MODES/`: `native-video-1440x900.png`, `native-video-768x1024.png`, and `native-video-390x844.png`; sampled replay captures are adjacent. Default fixture tests do not write screenshots into this directory.
- Existing generated components: `src/components/ui/tabs.tsx` and `src/components/ui/button.tsx`, backed by `@base-ui/react` 1.8.0 (MIT). No component source or version changed.

## Source boundary

CholecT50 challenge-validation media is sparse 1 fps still samples, not continuous source footage. Appendix300 is a different appendectomy recording. Full-rate cholecystectomy video with synchronized labels remains unavailable; acquiring it requires the official dataset access process and does not justify presenting unrelated annotations as aligned results.
