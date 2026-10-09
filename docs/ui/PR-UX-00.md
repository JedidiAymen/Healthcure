# UX-00 — reproducible install and CI

**Status:** local baseline passed; GitHub Actions workflow added but not yet run on GitHub.

## Files changed

- `.github/workflows/ui-and-api.yml` — locked Node/Python setup, clean `npm ci`, lint, typecheck, frontend tests, API tests, OpenAPI contract check, and production build.
- `package.json` / `package-lock.json` — exact dependency tree, including pinned dev-only `@playwright/test` 1.64.0. The local lockfile had been excluded by the machine's global Git ignore; it is now force-tracked on this branch for clean installs.
- `.gitignore` — local-only screenshots and Playwright reports remain outside Git.
- `vite.config.ts` — Vitest excludes browser-only Playwright specs; they have their own runner.
- `tests/e2e/workspace-shell.spec.ts`, `playwright.config.ts` — actual-browser shell checks.
- `scripts/capture_ui_review.mjs` — actual-app captures at the four required viewport sizes with route, browser-error, and overflow metadata.
- `scripts/crosscheck_openkbp_pt201.py` and `docs/openkbp-pt201-validation.json` — validation provenance uses a repository-relative/local-only label rather than recording the machine’s absolute dataset path.

The source checkout had no tracked `package-lock.json`. A local npm-generated lockfile was present, but the machine-wide Git ignore rule hid it. This branch explicitly tracks that lockfile. Clean install (`npm ci`) installed 314 packages at the foundation milestone and reported 0 vulnerabilities.

## Baseline executed before UI edits

- `npm ci` — passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test` — 17 passed.
- `python3 -m pytest -q apps/api/tests` — 30 passed (Python 3.14; deprecation warnings only).
- `npm run contracts:check` — passed.
- `python3 scripts/check_sql_schema.py` — 35 tables and foreign key enforcement passed.
- `python3 scripts/crosscheck_openkbp_pt201.py` — 23 official comparisons passed; max absolute difference 0.0000076471 Gy.
- `npm run smoke:local` — 19 app-shell routes and installed OpenKBP/Endoscapes/FiSaV checks passed.
- `npm run build` — passed; built entry JS 422.11 kB (131.20 kB gzip) and CSS 122.15 kB (21.91 kB gzip).

## Actual application baseline screenshots

Before UI changes, the running local app at `http://127.0.0.1:15176` was captured at **1440×900** and **390×844** for all 13 routes listed in `scripts/capture_ui_review.mjs` (26 screenshots total). Files are under `.local-review/UX-00/baseline-new/`; `report.json` records the actual final URL, viewport, overflow and page errors. All 26 page loads had no page-level JavaScript errors or horizontal overflow. Protected Academy mission and Educator builder routes correctly show the sign-in gate in this empty temporary review database, so those captures are not represented as authenticated lesson screens.

These are real application captures, separate from the layout-spec PNGs in the handoff ZIP. They contain locally installed source-backed research imagery and are intentionally ignored by Git.

## Components and licenses

- `@playwright/test` 1.64.0 — dev-only browser test runner, Apache-2.0. No production bundle change. Official docs: <https://playwright.dev/docs/test-snapshots>.
- Existing shadcn Base Nova/Base UI, Recharts, uPlot, dnd-kit, and Motion are unchanged.

## Screenshot/privacy note

Baseline and future source-backed screenshots are stored under the ignored `.local-review/` directory. They are not committed because installed OpenKBP and Endoscapes evidence remains subject to external display-rights review.
