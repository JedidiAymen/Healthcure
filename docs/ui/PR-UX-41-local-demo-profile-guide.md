# UX-41 — Local education demo accounts

## Change

Updated `RUN_LOCAL.md` and `docs/LOCAL_ACCESS_AND_PROFILES.md` to explain the demo seeder as the quick path for a fresh Academy/Educator review. It creates a local educator and student, places the student in a cohort, and creates draft lessons only for sources available on that computer. The guide identifies the supported profiles, where to sign in, how generated credentials are delivered, and how another reviewer creates independent credentials on their own checkout.

Passwords remain randomly generated and are printed once when their accounts are first created. The database stores salted password hashes. Existing credentials are neither reset nor reprinted. The docs explicitly keep passwords and local learning data out of Git and explain that seeded lessons are drafts requiring educator review and publication before learner delivery.

## Verification

- `apps/api/.venv/bin/python -m pytest -q apps/api/tests/test_seed_demo.py` — **3 passed**.
- `git diff --check` — passed.
- Documentation only; no application screenshot or UI claim is added by this milestone.

