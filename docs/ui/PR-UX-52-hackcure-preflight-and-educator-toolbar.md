# UX-52 — HackCure rehearsal preflight and Educator draft toolbar

**Date:** 2026-10-10  
**Branch:** `feat/experiments-run-workspace`  
**Status:** local feature-branch milestone; the current machine is not yet rehearsal-ready.

## Delivered

- `npm run doctor -- --hackcure-preflight` adds read-only checks for the documented local `pt_241` walkthrough: source-manifest hashes, matching archived `set_1` input, its imported artifact and saved comparison report, existence of a local reviewer/admin role with sign-in credentials, loopback-only development launcher configuration, and optional published/assigned Academy readiness.
- SQLite is opened in `mode=ro` with `query_only`. Output omits account usernames/IDs and credentials. This mode does not create or update migrations, accounts, passwords, learner state, review records, source files, or the database. It only reports what is present.
- `RUN_LOCAL.md` documents the invocation, required vs optional gates, selected DB behavior and limits.
- The Educator lesson editor keeps its existing title and save/review/publish controls visible while scrolling, matching the locked handoff's sticky draft-status toolbar. No save, publish, permission, rubric, ordering, or learner-preview logic changed.

## Current-machine result

The focused preflight found the verified `pt_241` source, archived prediction, saved comparison, and loopback launcher configuration. It reported that no reviewer/admin profile with credentials is prepared in the selected database, so the required rehearsal gate fails. The optional Academy path is also not ready because no published lesson assigned to a credentialed student was found. Exit status `1` is expected until the reviewer gate is prepared; the optional Academy result does not affect process status. The account and database state were left untouched, and the DB's file size/mtime were unchanged during the check.

## Files changed

- `scripts/doctor.py`
- `RUN_LOCAL.md`
- `src/pages/LessonEditor.tsx`
- `docs/STATUS.md`, `docs/PROGRESS.md`, `docs/RELEASE_CHECKLIST.md`

## Components and licenses

No dependency was installed. The sticky toolbar uses existing Tailwind 4.3.3 (MIT) classes and checked-in shadcn/Base UI buttons and fields backed by `@base-ui/react` 1.8.0 (MIT). The preflight uses the Python standard library (`sqlite3`, hashing, JSON and filesystem reads).

## Verification and limits

- `npm run doctor -- --hackcure-preflight` — source, import, report and loopback checks passed; reviewer gate failed because this local DB has no provisioned reviewer; optional Academy lesson check failed because none is published/assigned. Exit status: `1`.
- `git diff --check` — passed.
- `npm run typecheck -- --pretty false` — passed.
- No broad tests or account/data changes. The Educator sticky toolbar was typechecked, but no new authenticated screenshot was captured because no signed-in Educator browser session was available. Existing authenticated Educator screenshots predate this sticky-toolbar adjustment and are not presented as proof of it.
- The command is not a clean-clone, hosted-service, display-rights, clinical, legal, or institutional acceptance check. It cannot supply missing accounts, artifacts or Academy assignments.
