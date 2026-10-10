# PR-UX-14 — Authentic FiSaV browser regression

## Scope

Added `tests/e2e/fistulaguard-authentic.spec.ts`, a live Playwright regression against the already-installed, checksum-verified FiSaV recordings. It does not mock or seed signal data, add application behavior, add a package, store data hashes in the repository, or use account credentials. It switches between public source records `pat001` and `pat011`, verifies the displayed source hash changes and returns with the selected record, and checks 5-, 10-, and 20-second windows at each valid near-end boundary. It then saves and reopens a same-record `raw PZT2` comparison, checking source hash, channel, sample rate/count, selected and reference time windows, and persisted API identity.

The source timestamps have small interval variation. A requested five-second view can therefore report an observed sample interval of 4.9999 seconds. The regression allows at most one source sample of duration jitter while requiring the selected and reference windows to match exactly in channel, checksum, sample rate, and sample count. This records the source's measured timebase without widening the requested window.

## Reproduce with an isolated database

The working tree must have the installed FiSaV dataset under `data/fisav` and the project dependencies installed. No network download is required. In terminal one, start the local application with a disposable database and non-default ports:

```sh
MEDFORGE_DB_PATH=/tmp/medforge-fisav-e2e.sqlite3 MEDFORGE_API_PORT=18093 MEDFORGE_WEB_PORT=15189 ./scripts/start_local.sh
```

In terminal two, run the browser regression against that local application:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:15189 npm run test:e2e -- tests/e2e/fistulaguard-authentic.spec.ts
```

Stop terminal one's services when the test ends. The saved comparison is written only to `/tmp/medforge-fisav-e2e.sqlite3`; delete that disposable database after review if it is no longer needed.

## Verification

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:15189 npm run test:e2e -- tests/e2e/fistulaguard-authentic.spec.ts` — 1 passed (14.3 seconds) against the local API and authentic `pat001`/`pat011` source files.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- No UI component or package was installed for this test. It uses the existing `@playwright/test` 1.64.0 dev dependency (Apache-2.0).
