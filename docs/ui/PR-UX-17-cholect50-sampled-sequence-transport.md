# PR-UX-17 — Source-faithful CholecT50 sample transport

## What changed

Added play/pause controls to the authentic CholecT50 reference-frame view. Playback walks only frames that exist in the verified local validation package, at one displayed sample per second. Each displayed image retains its official video/frame ID and source time; a sample change also changes its source triplets, phase and bounding boxes. Playback stops at the last frame and clears any frame-specific selected annotation when it advances.

The interface states that missing source-time gaps are skipped and that the control is not continuous video. It does not interpolate images, carry labels across frames or imply model output. The separate Appendix300 player remains a distinct appendectomy source without aligned results.

## Source and library choices

- Source images and labels: the locally installed, checksum-verified CholecT50 Challenge Validation subset. Official format documentation describes its per-video PNG frames as 1 fps samples; frame IDs are retained as source-second identity. Official license: CC BY-NC-SA 4.0. Raw files remain ignored by Git.
- UI: existing shadcn/Base Nova `Button`, `Badge`, `Card`, `Checkbox`, `Select` and `Slider`; existing `lucide-react` Play/Pause icons. No new dependency. Versions and licenses remain those pinned in this repository lockfile; shadcn components are checked-in source, not runtime vendor imports.
- No additional media, model, scientific-data or interpretation package was added.

## Files changed

- `src/components/surgivision/CholecT50Review.tsx` — sample playback state, source-frame transport and explicit time-gap boundary.
- `tests/e2e/cholect50-sampled-review.spec.ts` — real-source browser regression for image progression, source labels, explicit non-continuous notice and pause persistence.
- `docs/STATUS.md` — current implementation and remaining full-rate media gate.
- This review note.

## Verification

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:15194 npm run test:e2e -- --workers=1 tests/e2e/cholect50-sampled-review.spec.ts`: 1 passed against the running local API and real installed frames.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 42 passed across 12 files.
- `npm run build`: passed (existing Vite large-chunk and React compiler directive warnings remain).
- Actual running-app screenshot: `.local-review/CHOLECT50-REAL-ANNOTATIONS/sample-playback-1440.png`. Review at 1440×900; previous PR-UX-16 evidence also covers 1280×800, 768×1024 and 390×844.
- Research source data remains in ignored local `data/`, not in the commit.

## Remaining requirement

The sampled transport is not a movie player. The public validation archive installed here contains still samples and labels, and the full CholecT50 dataset uses a separate access request. The research workstation still needs an authorized original-rate recording that is verified to match a supported annotation source before it can show timestamp-aligned overlays on continuous footage. Do not overlay these annotations on the unrelated Appendix300 clip.
