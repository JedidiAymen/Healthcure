# HealthCure / MEDFORGE review checkpoint

**Snapshot date:** 2026-10-09
**Purpose:** hand off the current implementation to a reviewer; work continues after review.

## What is in this repository

MEDFORGE is a local-first research and clinician education application for SurgiVision, DoseTwin, and FistulaGuard. The shipped source includes the React/Vite/Tailwind app, shadcn Base Nova components, FastAPI service, learning workflows, source-acquisition and validation scripts, API contracts, and the supplied v0.8 product and architecture handoff under `docs/source/v0.8/`.

The Student Academy and educator workflow include pathway pages, cohort assignments, learner-safe lesson attempts, educator scoring and debrief, progress summaries/history, participation export, and opt-in XP/activity achievements. Assignment, privacy, grading, and gamification behavior have API regression coverage. This is a substantial working slice, not a finished curriculum: instructor-approved competency mapping and complete authored learning content are still outstanding.

## Verification recorded for this snapshot

- Frontend: `npm run lint`, `npm run build`, and `npm run test` — 17 tests passed.
- API: `python3 -m pytest -q apps/api/tests` — 30 tests passed.
- Local source/route smoke: `npm run smoke:local` — 19 app routes plus installed-source checks passed.
- Responsive review: Academy assignment/pathway and Progress layouts checked at 390×844 and 768×1024; no horizontal page overflow. Keyboard focus was seen on the assigned lesson link.

The Progress screen currently has no educator-reviewed grades in its isolated preview database. Therefore populated rubric-history chart interaction/keyboard review and full keyboard traversal of the new pathway screens remain open. See `docs/RELEASE_CHECKLIST.md` for the exact gates and `docs/STATUS.md` for the implementation history.

## What remains open

- Finish interactive review of a populated Progress chart, criterion selector, values table, and keyboard access; complete Academy pathway keyboard traversal.
- Complete instructor-approved competency mapping and the authored curriculum.
- Keep the service bound to loopback. General research routes do not have production authorization, and hosting is disabled.
- Resolve dataset display/redistribution rights for the intended audience before sharing any data-backed screenshots or running a public demo. OpenKBP data rights and CVS-AdaptNet checkpoint-specific terms/provenance remain unresolved; other sources also have attribution and scope requirements. See `docs/BLOCKERS.md` and `docs/RELEASE_CHECKLIST.md`.

## Data and local setup

This push contains application source and documentation, **not** the locally installed research datasets, pretrained weights, generated evidence, SQLite databases, or preview accounts. Those files are excluded by `.gitignore` because they are large, local-only, or still subject to display/use review. A fresh clone must follow `RUN_LOCAL.md` and `docs/BLOCKERS.md`; expect the research viewers to have no installed cases until each allowed source is acquired locally.

To run the application shell, install the documented Python API and Node dependencies, then launch `./scripts/start_local.sh`. It binds to `127.0.0.1`; do not expose it to a network. Do not reuse or publish temporary preview credentials.

## Supplied handoff

The supplied v0.8 handoff documents are preserved under `docs/source/v0.8/`. They describe the intended product and acceptance gates. This checkpoint describes implementation evidence and remaining work; it does not claim every handoff requirement is complete.
