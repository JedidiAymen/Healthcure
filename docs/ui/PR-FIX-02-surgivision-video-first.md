# FIX-02 — SurgiVision source-first video readiness

**Status: Endoscapes remains an annotated sampled-stills workflow; a separate licensed Appendix300 excerpt is available for continuous-video playback.** The excerpt is an appendectomy clip from a different dataset. It is not mapped onto Endoscapes, has no instrument masks, and does not enable temporal model inference.

## What changed

- Added typed `GET /api/v1/surgivision/media` and `GET /api/v1/surgivision/media/{media_id}` endpoints. They build records from the checksum-verified Endoscapes frame registry, preserving split, source video ID, first/last frame identities, installed still count, source revision, source link, allowed-use note and explicit limitations. IDs are constrained to the installed BBox201 dataset; the response does not reveal a host path.
- Every current record is `annotated_stills`: `asset_uri`, native FPS, sampling FPS and duration are null; the only capability is `browse_annotated_frames`. The API does not invent a movie, elapsed time, intermediate frame, track or synchronization.
- Added a professional-viewer media-mode card with the actual installed still count and split/video. The existing verified single-frame inspection, annotations, source hashes, CVS reference values and evidence-save path remain in place. Learner mode does not make the full cohort or media manifest newly visible.
- Added operation-readiness rows. Native playback, source-synchronized timelines and model inference show an explicit blocked reason instead of being implied by an installed frame source.
- The Endoscapes BBox201 import still contains sampled annotated images, not continuous recordings. A separate, source-attributed 38.1384-second Appendix300 appendectomy excerpt is now installed and can be opened in the professional viewer through the native HTML5 player. Video.js remains unnecessary for this single simple excerpt; the clip is not presented as Endoscapes, cholecystectomy footage, or annotated model output.

## Evidence and limits

- API tests verify `annotated_stills`, null media path/FPS/duration, the single browsing capability, valid details, invalid IDs and the empty-source case.
- Running-app smoke used the installed Endoscapes `test / video 162 / frame 6575` source. The media card visibly reports that continuous recording and intermediate frames are not installed; the frame image and six original reference boxes remain inspectable.
- No new dependency was installed. Existing React 19, shadcn Base UI, Tailwind 4 and Lucide components are used.
- Actual running-app screenshots at 1440×900, 768×1024 and 390×844 are in the ignored local review folder `.local-review/FIX-02/`. They show the real local source. None has horizontal document overflow or browser page errors.

## Still blocked

The Appendix300 clip supports native play/pause/seek only. It is not time-aligned with Endoscapes and has no synchronized phase/tool tracks, source annotations, or temporal inference. The Endoscapes stills cannot support those features. Cholec80 access, CholecT50 sampled media, cross-dataset ID mapping, and temporal-model weights remain separate acquisition/validation work.

## Verification

`python3 -m pytest -q apps/api/tests` — 32 passed. `npm run contracts:check` — passed. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e -- --workers=1`, and `npm run build` — passed; the route was also opened against the running local app and the three requested real-source viewport screenshots were captured.
