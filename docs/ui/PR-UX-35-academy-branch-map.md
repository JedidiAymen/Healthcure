# UX-35 — Student Academy specialty branches

## What changed

Replaced the wide pathway rows on `/academy` with a responsive three-branch map for Surgical Evidence, Radiation Physics, and Physiological Signals. Each branch comes from the authenticated Academy path response. Assignment stops are rendered only when the server returns real assignments for that learner; an empty branch says **Not assigned** and provides its source/path overview without implying that a lesson is unlocked.

Each real lesson stop links to its existing `/academy/missions/:assignmentId` investigation and shows its source case label, lesson version, optional due date, and server-backed state. The student-facing terms are **Available**, **In progress**, **Submitted**, and **Reviewed**. Path and assignment list terminology now agree. The existing guided viewers, API, privacy preferences, grading, and delayed feedback flow are unchanged.

At desktop, the map displays three source-specific lanes; at tablet and phone widths, it becomes one vertical sequence suited to the shell's persistent navigation rail. The no-assignment review intentionally contained no fabricated lessons or scientific evidence.

## Files changed

- `src/pages/Pages.tsx` — branch and assignment-stop components; real state labels and path destinations.
- `src/pages/StudentLearningPath.tsx` — align state wording with the Academy overview.
- `src/pages/academy.css` — responsive specialty lanes and vertical investigation tracks using Academy layout styles; card surfaces retain generated shadcn styling.
- `docs/STATUS.md` — current integration record.

## Components and dependencies

- Existing generated shadcn/ui Base Nova `Card`, `Badge`, and `Button` compositions, using the repository's Base UI setup (`@base-ui/react` 1.8.0). Component source is already checked into `src/components/ui/`.
- No dependency was added or upgraded. No dataset, API, or database schema was changed.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test` — 44 tests across 13 files passed.
- `npm run build` — passed; existing vtk.js chunk-size and React module-directive warnings remain.
- Actual authenticated app review used a disposable SQLite database and the local FastAPI path endpoint. No assignments were seeded. At 1440×900, 768×1024, and 390×844, all three configured paths appeared, document width matched viewport width, and there were no browser errors or failed API requests.

Screenshots and the machine-readable browser measurements are ignored local review artifacts:

- `.local-review/UX-35/academy-desktop.png`
- `.local-review/UX-35/academy-tablet.png`
- `.local-review/UX-35/academy-phone.png`
- `.local-review/UX-35/review.json`
