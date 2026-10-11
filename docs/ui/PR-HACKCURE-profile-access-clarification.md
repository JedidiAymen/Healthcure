# HackCure and local profile access guide

Clarified the supported local sign-in paths and the credential status for each documented SQLite profile. The guidance distinguishes usernames that a setup script may create from accounts that actually exist and states that this repository contains no passwords or default/shared credentials.

## Read-only profile inventory

On 2026-10-11, the default `data/local.sqlite3`, HackCure Docker `data/hackcure-docker/medforge.sqlite3`, and isolated `pt_241` `data/openkbp-opt/pt_241/local.sqlite3` had no credentialed role grants. The optional `data/jury-demo.sqlite3` was absent. This inventory did not read usernames or passwords, and made no database changes.

## Files

- `RUN_LOCAL.md` — quick path and credential guide for the local and HackCure launchers.
- `docs/LOCAL_ACCESS_AND_PROFILES.md` — database/profile matrix and exact UI sign-in entry points.
- `docs/HACKCURE_WALKTHROUGH.md` — selected Docker profile credential state and example-username clarification.

No users, learner records, assignments, reports, imports, or credentials were created. The event gates remain: privately prepare the selected HackCure database's matching archived prediction/report and reviewer account, then perform an interactive sign-in and full research-review rehearsal. Password values must be saved by the operator when the provisioning command prints/prompts them; they cannot be recovered from this repository.
