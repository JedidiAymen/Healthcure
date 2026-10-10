# PR-UX-46 — Offline Academy submission recovery

## Status

Implemented and verified on `feat/experiments-run-workspace`. The browser test uses the actual production build and service worker, with a clearly synthetic assignment fixture and no clinical or research data.

## Behavior

- A queued submission and its draft stay in IndexedDB when replay receives HTTP 401 or 403. The in-memory session token remains memory-only.
- Replay runs in one shared in-flight promise so online events, the mission route and the 15-second retry do not start overlapping drains in the same module.
- When the student reopens the mission after signing in, the route rechecks the attempt and replays pending work. The existing idempotency key is preserved.
- The offline banner refreshes after a replay completes, so it does not continue to report a cleared queue.
- CI builds the production app before running this service-worker E2E. The dev-server browser suite excludes the production-only case.

## Files changed

- `src/lib/offline-queue.ts` — retains queued work after authentication failures and clarifies permanent-refusal behavior.
- `src/lib/offline-queue.test.ts` — regression coverage for retained submission, draft and original key after 401.
- `src/lib/mission-offline.ts` — deduplicated replay and queue-state update notification.
- `src/pages/Pages.tsx` — replay on opening a started assignment after authentication and refresh the attempt state.
- `tests/e2e/academy-offline-submit.spec.ts` — offline queue, reload, unauthenticated retry, sign-in and single replay using the same key.
- `playwright.offline.config.ts`, `package.json`, `.github/workflows/ui-and-api.yml` — production-preview E2E configuration, scripts and CI order.
- `docs/PROGRESS.md`, `docs/STATUS.md` — milestone and gap updates.

## Dependencies

No new production dependency. Uses existing Playwright `@playwright/test` 1.64.0 (MIT), the browser's IndexedDB and service-worker APIs, and the existing Vite production preview.

## Verification

- `npm run test:e2e:offline -- --workers=1` — 1 passed against `vite preview` and the production service worker.
- `npm run test` — 68 passed across 20 files.
- `npm run test:e2e:ci -- --workers=1` — 20 passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed; Vite retains the pre-existing large vtk.js chunk warning.
- `python -m pytest -q apps/api/tests` — 143 passed, 2 skipped in a temporary Python 3.12 environment.

The production browser run saves actual-app captures at 1440×900, 768×1024 and 390×844 to the ignored `.local-review/UX46-offline-recovery/` folder. The assignment and learner content in those captures are marked synthetic test fixtures.

The offline test fixture explicitly identifies itself as synthetic and contains no patient or installed dataset records. It verifies delivery and idempotency behavior only.
