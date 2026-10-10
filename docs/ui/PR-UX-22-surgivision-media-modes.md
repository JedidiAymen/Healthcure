# SurgiVision video and results modes

**Status: implemented and locally verified.**

The Professional SurgiVision viewer opens with three explicit media modes:

- **Native video · no aligned labels** — the installed Appendix300 clip is authentic laparoscopic appendectomy footage. It has no synchronized annotations, masks, or model predictions.
- **Sampled replay · source labels** — checksum-verified CholecT50 cholecystectomy samples show their official tool-tip boxes and annotations on the exact source frames. The player skips source-time gaps; it is not continuous video or MEDFORGE model output.
- **Annotated stills** — Endoscapes images show their own COCO boxes, masks, labels, and source coordinates.

This makes the video/results relationship visible and prevents results from one procedure or dataset from being overlaid on another. A full-rate cholecystectomy video with aligned results is not installed; the available annotations cover sparse sampled images only.

## Verification

- Focused Playwright source-backed review: 1 passed. It verifies no annotation overlay appears in the native video mode, authentic labels do appear in sampled replay, sample transport advances and pauses, and all three modes have no horizontal overflow at 1440×900, 768×1024, and 390×844.
- `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Actual application screenshots: `.local-review/SURGIVISION-MEDIA-MODES/` (`native-video-*`, `sampled-results-*`, and `annotated-stills-1440x900.png`). These are local QA artifacts and are not committed.
- Components: existing project shadcn/Base UI `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent`; `@base-ui/react` 1.8.0 (MIT). No component source or dependency was added.

## Open locally

Start the documented local API and web application with `./scripts/start_local.sh`, then open <http://127.0.0.1:5173/studio/surgivision/cases/current>. Choose **Native video**, **Sampled replay**, or **Annotated stills** at the top of the viewer. Professional Studio does not require sign-in. Student and educator setup instructions and profile access are in [`LOCAL_ACCESS_AND_PROFILES.md`](../LOCAL_ACCESS_AND_PROFILES.md); a fresh checkout has no default credentials.
