# HackCure reviewer preflight follows the effective login role

The read-only HackCure preflight now resolves reviewer readiness with the same role priority used by local sign-in. A credentialed user granted both `clinical_reviewer` and a higher-priority `educator` or `student` role no longer incorrectly makes the reviewer gate appear ready; an effective `admin` remains accepted. The check reports no account names or credentials.

The preflight can confirm a matching local credential record and the role sign-in will select. It cannot verify the private password or prove an interactive session works. The event operator still needs to sign in as the reviewer in the selected Docker profile and complete one real research-review cycle.

## Files

- `scripts/doctor.py` — effective-role readiness query.
- `apps/api/tests/test_doctor.py` — precedence and credential-presence regression coverage using an in-memory SQLite database only.
- `docs/HACKCURE_WALKTHROUGH.md` — clarified the reviewer gate and its password limitation.

## Focused verification

- `apps/api/.venv/bin/python -m pytest -q apps/api/tests/test_doctor.py` — passed.
- `python3 -m py_compile scripts/doctor.py` — passed.
- `git diff --check` — passed.

No local profile database, account, password, import, report, assignment, or deployment state was changed. The current event reviewer remains an operator setup gate.
