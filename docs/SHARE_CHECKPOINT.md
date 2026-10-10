# HealthCure / MEDFORGE review checkpoint

**Snapshot date:** 2026-10-10
**Review branch:** `review/cobalt-dosetwin-d2-d3`
**Purpose:** friend/reviewer handoff; development continues after review.

## Current state

MEDFORGE is a local-first scientific research and clinician education application for SurgiVision, DoseTwin, and FistulaGuard. This branch contains the React 19 / Vite 8 / Tailwind 4 interface, shadcn Base Nova/Base UI components, FastAPI service, source validation/acquisition tools, education workflows, API contracts, and the supplied v0.8 and locked B Cobalt / Porcelain design handoffs.

- **DoseTwin:** `pt_201` has a large source-backed primary slice, two simultaneous linked orthogonal views, dose/structure layers, multi-ROI DVHs and source provenance. The Y-view real-pixel selection updates the common X/Y/Z voxel. An authentic `pt_241`/OpenKBP-Opt case and prediction pair are separately configured where installed. Neither case creates a fake prediction. The official 23 `pt_201` metric comparisons pass; maximum absolute difference is `0.0000076471 Gy`.
- **SurgiVision:** the page distinguishes the Appendix300 native appendectomy clip (no aligned results), CholecT50 sparse sampled cholecystectomy images with their matching source labels, and Endoscapes annotated stills. Full-rate cholecystectomy footage with synchronized labels is not installed. No annotations are fabricated or placed on another procedure's video.
- **FistulaGuard:** FiSaV waveform, PSD, spectrogram and window-comparison views use the installed checksum-verified recordings and retain source-time and units limitations.
- **Academy and Educator:** local source-backed investigations, learner-safe publications, assignments, manual review, debrief, progress, private opt-in XP/achievements and educator editing are implemented. Complete instructor-approved competency mapping and final authored curriculum are still open.

## Verification in this snapshot

- `npm run lint`, `npm run typecheck`, `npm run build` passed.
- Frontend unit suite: **44 passed** (`npm run test`).
- FastAPI suite: **42 passed** (`python3 -m pytest -q apps/api/tests`).
- DoseTwin focused Playwright linked-plane review passed on UI interaction fixtures; a separate running-app review used the installed `pt_201` arrays, clicked a real secondary-plane voxel, checked linked plane values, and captured desktop (1440×900), laptop (1280×800), tablet (768×1024), and phone (390×844) without horizontal overflow or page errors. Screenshots are ignored local artifacts under `.local-review/DOSETWIN-LINKED-MPR-REAL/`.
- SurgiVision source-backed E2E review passed at desktop/tablet/phone sizes; screenshots are under `.local-review/SURGIVISION-MEDIA-MODES/`.
- Exact per-milestone commands, component sources/licenses, images, and caveats are recorded in [`PR-FIX-08`](ui/PR-FIX-08-dosetwin-linked-orthogonal-planes.md) and [`PR-UX-22`](ui/PR-UX-22-surgivision-media-modes.md). Full history is in [`STATUS.md`](STATUS.md) and the current gates are in [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md).

## Open work and release limits

- Finish the remaining page-by-page review and feature gates in the locked handoff. The local-demo checklist is not a claim that every V3 visual/functional requirement has passed.
- Complete instructor-approved competency mapping and authored curriculum.
- Dataset display rights for an external audience, especially OpenKBP and Endoscapes, still require scope-specific review. OpenKBP dataset rights are not established by the source-code license. Do not publish research data or screenshots before review.
- Keep the API bound to `127.0.0.1`; general research endpoints do not have production authorization. No public deployment is enabled.
- CVS-AdaptNet inference remains blocked until the specific checkpoint's provenance, integrity and use terms are resolved. Do not claim clinical or model performance.

## Open the app and provision profiles

From the review checkout, follow [`LOCAL_ACCESS_AND_PROFILES.md`](LOCAL_ACCESS_AND_PROFILES.md) for dependency setup, launch command, workspace URLs, and student/educator account creation. Start with `./scripts/start_local.sh`, then open <http://127.0.0.1:5173>. The API remains loopback-only.

Professional Studio does not require an account. Academy requires an operator-provisioned student account; Educator Studio requires a separate operator-provisioned educator account. **There are no default credentials to share:** each reviewer chooses each password when creating their local account. User databases, passwords, sessions, research datasets, weights and generated reports are excluded from Git and must be provisioned/acquired separately on each machine. Do not put secrets or local user databases in commits.

This branch push contains application source and documentation, not the large local datasets or user credentials. A fresh checkout must follow [`RUN_LOCAL.md`](../RUN_LOCAL.md) and [`BLOCKERS.md`](BLOCKERS.md); viewer data appears only after its permitted source files are installed.
