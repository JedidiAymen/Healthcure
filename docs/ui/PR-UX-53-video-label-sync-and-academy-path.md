# UX-53 — Video-frame evidence and Academy pathway

**Date:** 2026-10-10  
**Scope:** SurgiVision live video evidence, Student Academy pathway detail, current HackCure readiness snapshot.

## Changes

- SurgiVision publisher phase/event labels now follow decoded video frames with `requestVideoFrameCallback`; browsers without it use the media `timeupdate` event. The source annotation layer stays above the player controls. Cholec80's phase remains a publisher reference label, while Appendix300's annotation appears only at its recorded event time. The evidence inspector still says when model output is unavailable.
- Student Academy pathway detail now leads with the source-backed study brief and cohort counts, then lays out the assigned investigations, objectives, prerequisites, limitations and source attribution. It uses the installed shadcn components and Tailwind utility classes; lesson content and counts remain API-backed. Gamification and learner privacy behavior did not change.
- The HackCure compliance document now records the read-only preflight outcome from the current local database and leaves the missing reviewer and optional Academy setup gates open.

## Manual review

- The local application was opened at `http://127.0.0.1:15216/studio/surgivision/cases/current` with the installed Cholec80 and Appendix300 media. The phase label was visible on the video at frame 0. **Jump to source event** sought Appendix300 to `23.161489` seconds, and the publisher event label was visible over the footage. The player and evidence inspector both identified this as source annotation; model output was unavailable.
- SurgiVision actual-app captures: `.local-review/UX-53-surgivision-frame-overlay/surgivision-desktop.png` (1440×900 viewport, full page), `surgivision-tablet.png` (768×1024, full page), `surgivision-mobile.png` (390×844, full page), and `surgivision-appendix-event-1440.png` (Appendix300 event view). Captures remain ignored/local because they include source research media.
- No authenticated Student browser session was available, so Academy was not visually reviewed or screenshot-tested in this milestone.

## Files

- `src/pages/SurgiViewer.tsx`
- `src/pages/StudentLearningPath.tsx`
- `docs/HACKCURE_COMPLIANCE.md`
- `docs/STATUS.md`
- `docs/ui/PR-UX-53-video-label-sync-and-academy-path.md`

## Components and verification

- Reused installed `@videojs/react` 10.0.1 (MIT), existing shadcn/Base UI source components, Tailwind CSS 4.3.3 (MIT), and existing Lucide icons (ISC). No packages were installed.
- `npm run typecheck -- --pretty false` — passed.
- `git diff --check` — passed.
- No broad tests were run. The HackCure preflight remains **not ready** on this database: source/archive, matching imported comparison/report and loopback configuration pass; credentialed reviewer is missing; the optional published/assigned Academy lesson is missing. See [`RUN_LOCAL.md`](../../RUN_LOCAL.md).
