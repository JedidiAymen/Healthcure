# HealthCure / MEDFORGE review checkpoint

**Snapshot date:** 2026-10-10
**Review branch:** `review/cobalt-dosetwin-d2-d3`
**Latest pushed commit:** `f372980` (`test: exercise full source-backed browser flow`)
**Purpose:** friend/reviewer handoff; development continues after review.

## Current state

MEDFORGE is a local-first scientific research and clinician education application for SurgiVision, DoseTwin, and FistulaGuard. This branch contains the React 19 / Vite 8 / Tailwind 4 interface, shadcn Base Nova/Base UI components, FastAPI service, source validation/acquisition tools, education workflows, API contracts, and the supplied v0.8 and locked B Cobalt / Porcelain design handoffs.

- **DoseTwin:** `pt_201` has a large source-backed primary slice, two simultaneous linked orthogonal views, dose/structure layers, multi-ROI DVHs and source provenance. The Y-view real-pixel selection updates the common X/Y/Z voxel. An authentic `pt_241`/OpenKBP-Opt case and prediction pair are installed; the default local database now contains the hash-verified set_1 comparison and saved report. The archived output is not inference, and the fresh-machine import steps are in [`LOCAL_ACCESS_AND_PROFILES.md`](LOCAL_ACCESS_AND_PROFILES.md). The official 23 `pt_201` metric comparisons pass; maximum absolute difference is `0.0000076471 Gy`.
- **SurgiVision:** the page distinguishes the Appendix300 native appendectomy clip (no aligned results), CholecT50 sparse sampled cholecystectomy images with their matching source labels, and Endoscapes annotated stills. Full-rate cholecystectomy footage with synchronized labels is not installed. No annotations are fabricated or placed on another procedure's video.
- **FistulaGuard:** FiSaV waveform, PSD, spectrogram and window-comparison views use the installed checksum-verified recordings and retain source-time and units limitations.
- **Model Lab and Experiments:** Model Lab now validates a selected registered operation against a compatible installed case and displays the actual API-returned blockers. CVS-AdaptNet inference remains disabled until worker/checkpoint provenance and use terms are resolved. The enabled OpenKBP reference summary remains a real benchmark calculation, not model prediction.
- **Academy and Educator:** local source-backed investigations, learner-safe publications, assignments, manual review, debrief, progress, private opt-in XP/achievements and educator editing are implemented. Educator assignments can be searched and filtered by cohort/due date; submissions can be searched by learner and filtered by review status. Complete instructor-approved competency mapping and final authored curriculum are still open.
- **Home handoff:** when local run history contains a completed DoseTwin case summary, the primary Home action resumes that exact run and opens its real saved metrics. The desktop/tablet/phone captures and focused browser verification are recorded in [`PR-UX-25`](ui/PR-UX-25-home-resume-analysis.md).
- **SurgiVision label discovery:** the video-first native Appendix300 panel states that it has no aligned results and links directly to separate authentic CholecT50 sampled frames, where the source labels appear. Real-source Playwright passes and responsive captures are recorded in [`PR-UX-26`](ui/PR-UX-26-surgivision-labeled-sample-discovery.md). Full-rate aligned cholecystectomy footage remains unavailable.
- **Portable browser checks:** the branch's CI browser step runs 16 data-independent E2E checks; source-dataset integrations remain available in the full local E2E command and are labeled `@source`. The CholecT50 navigation test uses explicit UI-only fixture mode in clean CI and has separately passed against local authentic frames. The accessible Combobox also fits a visual viewport at 200% zoom. See [`PR-UX-27`](ui/PR-UX-27-reproducible-browser-checks.md).
- **Full source review:** the full 19-test browser suite now passes against the installed research data, using a temporary database and artifact store. It covers the keyboard Academy mission, authentic `pt_241` prediction comparison/report, FiSaV source-window comparison, CholecT50 matched labels, and the CI-safe shell flows. See [`PR-UX-28`](ui/PR-UX-28-source-backed-browser-review.md).

## Verification in this snapshot

- `npm run lint`, `npm run typecheck`, `npm run build` passed.
- Frontend unit suite: **44 passed** (`npm run test`).
- FastAPI suite: **42 passed** (`python3 -m pytest -q apps/api/tests`).
- DoseTwin focused Playwright linked-plane review passed on UI interaction fixtures; a separate running-app review used the installed `pt_201` arrays, clicked a real secondary-plane voxel, checked linked plane values, and captured desktop (1440×900), laptop (1280×800), tablet (768×1024), and phone (390×844) without horizontal overflow or page errors. Screenshots are ignored local artifacts under `.local-review/DOSETWIN-LINKED-MPR-REAL/`.
- SurgiVision source-backed E2E review passed at desktop/tablet/phone sizes; screenshots are under `.local-review/SURGIVISION-MEDIA-MODES/`.
- Current focused review slices passed for Model Lab case-aware blockers and Educator assignment/review filters. The educator routes were captured at 1440×900, 1280×800, 768×1024 and 390×844 with no document overflow; `npm run test -- --run` passed all 44 frontend tests, and `npm run build` passed (with the existing large DoseTwin chunk and React Compiler directive warnings). Local captures are ignored under `.local-review/UX-05-model-validation/` and `.local-review/UX-24-educator-triage/`.
- Home saved-run continuation: focused Playwright passed and confirmed the exact run ID, case summary, and Brainstem values; screenshots show the real app shell with an explicitly test-only API fixture at desktop 1440×900, tablet 768×1024, and phone 390×844 under ignored `.local-review/UX-25-home-resume/`. Lint, typecheck, 44 frontend tests, and build passed.
- SurgiVision label discovery: `MEDFORGE_API_PORT=18098 MEDFORGE_E2E_SOURCE_API=1 npx playwright test tests/e2e/cholect50-sampled-review.spec.ts --workers=1` passed against the active local source service; it confirms navigation into the matching labels, sample playback/pause, and responsive layouts. Lint/typecheck/build passed; actual source screenshots are in `.local-review/SURGIVISION-MEDIA-MODES/`.
- Clean-data browser CI path: `npm run test:e2e:ci -- --workers=2` — **16 passed** with no API on port 8000. `npm run lint`, `npm run typecheck`, frontend unit tests (**44 passed**) and production build passed. The full local E2E command retains three source-asset checks that require the installed research data.
- Full source-backed browser verification: `MEDFORGE_API_PORT=18109 MEDFORGE_E2E_SOURCE_API=1 npm run test:e2e -- --workers=2` — **19 passed** against locally installed assets. The isolated test DB and uploaded dose prediction were stored under `/tmp` and removed when verification ended.
- Fresh full API recheck: `python3 -m pytest -q apps/api/tests` — **42 passed**. `npm run contracts:check` — passed. Live source smoke against ports 18098/4174 checked 2 DoseTwin cases, 1,933 SurgiVision cases, 59 FiSaV records, CholecT50 source labels, all ten `pt_201` ROI DVHs, 36 source planes and all 19 app routes. The first smoke invocation used its default port while no default-port API was listening; the run against the active review services passed. API readiness still correctly reports public deployment disabled.
- Exact per-milestone commands, component sources/licenses, images, and caveats are recorded in [`PR-FIX-08`](ui/PR-FIX-08-dosetwin-linked-orthogonal-planes.md) and [`PR-UX-22`](ui/PR-UX-22-surgivision-media-modes.md). Full history is in [`STATUS.md`](STATUS.md) and the current gates are in [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md).

## Open work and release limits

- Finish the remaining page-by-page review and feature gates in the locked handoff. The local-demo checklist is not a claim that every V3 visual/functional requirement has passed.
- Complete instructor-approved competency mapping and authored curriculum.
- Dataset display rights for an external audience, especially OpenKBP and Endoscapes, still require scope-specific review. OpenKBP dataset rights are not established by the source-code license. Do not publish research data or screenshots before review.
- Keep the API bound to `127.0.0.1`; general research endpoints do not have production authorization. No public deployment is enabled.
- CVS-AdaptNet inference remains blocked until the specific checkpoint's provenance, integrity and use terms are resolved. Do not claim clinical or model performance.

## Open the app and provision profiles

From the review checkout, follow [`LOCAL_ACCESS_AND_PROFILES.md`](LOCAL_ACCESS_AND_PROFILES.md) for dependency setup, launch command, workspace URLs, and student/educator account creation. Start with `./scripts/start_local.sh`, then open <http://127.0.0.1:5173>. For this active checkout, the review server is currently available at <http://127.0.0.1:4174>; it will stop when its local review process is stopped. The API remains loopback-only.

Professional Studio browsing does not require an account. Academy requires a student account; Educator Studio requires an educator account; DoseTwin review decisions require a separately provisioned Clinical Reviewer account (or admin). The local reviewer designation does not verify medical credentials. **There are no default credentials to share:** each user chooses a password when creating a local account. User databases, passwords, sessions, research datasets, weights and generated reports are excluded from Git and must be provisioned/acquired separately on each machine. Do not put secrets or local user databases in commits.

This branch push contains application source and documentation, not the large local datasets or user credentials. A fresh checkout must follow [`RUN_LOCAL.md`](../RUN_LOCAL.md) and [`BLOCKERS.md`](BLOCKERS.md); viewer data appears only after its permitted source files are installed.

The original Build Now master directive is preserved at [`MEDFORGE_LUNA_XHIGH_BUILD_NOW.md`](design-handoff/MEDFORGE_LUNA_XHIGH_BUILD_NOW.md). The embedded 67-file v0.8 source package and all 16 files in the locked B Cobalt/Porcelain handoff are checked in byte-for-byte under [`source/v0.8`](source/v0.8) and [`design-handoff/MEDFORGE_B_LOCKED_HANDOFF_V3`](design-handoff/MEDFORGE_B_LOCKED_HANDOFF_V3).
