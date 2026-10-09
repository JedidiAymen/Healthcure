# UX-03 — SurgiVision frame workspace

**Status: PASS for the SurgiVision UI slice; integrated release remains in progress.** This change upgrades the actual Endoscapes keyframe review route while leaving source assets, API contracts, model-readiness checks, role permissions and evidence calculations intact.

## What changed

- Rebalanced the review area to a wide 3:1 primary image viewport and right-side annotation/provenance inspector at desktop widths. The frame picker and source counts stay in a compact row above the image.
- Added independent controls built from the installed shadcn Base Nova `ToggleGroup` for COCO boxes and official RLE masks; the layers still use source pixel coordinates and the existing mask decoder.
- Added shadcn `Tabs` for CVS source-label coverage and single-frame model evidence. The model tab continues to show API-returned readiness blockers and keeps inference disabled while the gate is closed.
- Labeled the evidence `Sampled still`, kept source selection searchable, and did not introduce a video player or playback timeline.
- Changed only the SurgiVision viewport well from near-black to the approved dark viewport token `#101624`; Endoscapes category colors remain the existing source-overlay palette.
- Kept zoom/pan, selected source annotation and exact bounding-box values, local preferences, JSON export, saved report action, source hashes, citation/license, student evidence-point controls, and withheld/released reference-label rules.

## Files changed

- `src/pages/SurgiViewer.tsx`
- `src/styles.css` (the scoped `.surgi-*` viewport background only)
- `docs/ui/PR-UX-03-surgivision.md`

No dependencies, backend files, dataset files or model code were changed. Components reused from the installed shadcn/Base Nova source: `Card`, `Badge`, `Button`, `Combobox`, `Checkbox`, `Input`, `Alert`, `Skeleton`, `Tabs`, and `ToggleGroup`; primitive library `@base-ui/react` 1.8.0 (MIT), project Tailwind 4.3.3 (MIT). No new vendor source was installed.

## Verification performed

- `npm run typecheck` — passed.
- `npx eslint src/pages/SurgiViewer.tsx` — passed.
- `npm run test -- --run src/lib/surgical-evidence.test.ts src/lib/workspace-preferences.test.ts` — 2 files, 9 tests passed.
- Browser QA on the running local app using real `endoscapes:train:4_26200` data at 1440×900, 1280×800, 768×1024 and 390×844: source image remained 854×480; all 6 source COCO boxes rendered; the decoded source masks contained 259,503 nontransparent pixels at each size; page width did not exceed the viewport; no page errors; no `<video>` element.
- Browser interaction QA: selected the Cystic Plate source annotation and verified COCO annotation `40262000` with source bbox `[178, 275, 256, 166]`; turned masks off and verified zero mask pixels, restored masks and turned boxes off independently; zoom reached 125%; saving frame evidence displayed the persisted-report confirmation and `/studio/reports` link.
- Opened second installed source frame `endoscapes:train:13_46850` in the running app: 854×480 source, 6 source annotations, no page errors.
- Opened Model evidence and verified live blocked status, returned blocker text, and a disabled `Run on this frame` action.
- Local screenshots, kept out of Git because they contain non-commercial research images:
  - `.local-review/UX-03/surgivision-1440x900.png`
  - `.local-review/UX-03/surgivision-1280x800.png`
  - `.local-review/UX-03/surgivision-768x1024.png`
  - `.local-review/UX-03/surgivision-390x844.png`

## Limits

- The desktop frame is 831px wide at 1440px viewport and stays the dominant task surface; the existing route-level title/header above the viewer means the full 854×480 image needs a small scroll at the initial fold.
- The existing report schema records one `show_annotations` boolean, not independent box/mask visibility. The saved/exported field now reports annotations visible when either source layer is on; model/source evidence itself is unaffected. Persisting each layer independently would require a report schema/API change and regression tests, which were outside this UI slice.
- Public screenshots were not committed or deployed. Only locally permitted, source-verified data was inspected.
