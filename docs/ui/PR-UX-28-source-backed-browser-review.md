# UX-28 — Make the full source-backed browser suite repeatable

## Change

The three `@source` end-to-end scenarios remain available for checkout-local research review. The DoseTwin comparison test now starts from a fresh database: it reads the installed OpenKBP-Opt `pt_241` `prediction-set_1.csv`, verifies the pinned SHA-256, then imports the genuine file through MEDFORGE's guarded same-case/same-grid API into the isolated review profile before comparing it with the matching reference and persisting the report. No prediction array is generated or checked in.

The FiSaV record-switching test now chooses `pat011` and returns to `pat001` by keyboard in the searchable combobox. This avoids a click racing the live option-list update and verifies the accessible navigation path with the real 59-record source list.

## Verification

- `MEDFORGE_API_PORT=18109 MEDFORGE_E2E_SOURCE_API=1 npm run test:e2e -- --workers=2` — **19 passed** using installed Endoscapes, CholecT50, OpenKBP-Opt, OpenKBP and FiSaV data.
- The API and web process used a disposable `/tmp` database and `/tmp` prediction-artifact directory. Both were stopped and removed after the run; the regular user database was not used.
- The full source run covers the Academy keyboard mission, authentic `pt_241` import/comparison/report, FiSaV record/window/comparison flow, and all 16 data-independent browser paths.
- `npm run lint`, `npm run typecheck`, `npm run test` (**44 passed**), and `npm run build` passed.
- The source preview and screenshots from UX-26 remain available locally under `.local-review/SURGIVISION-MEDIA-MODES/`; source assets remain outside Git.

## Data and use limits

The test checks source identity, source hashes, case linkage, and the existing declared local-use basis. That basis is not a legal determination or a publication license. `pt_241` stays isolated from `pt_201`, and none of these runs claims a clinically validated model result.
