# FIX-10 — Academy expired assignment state

## Gap and change

The student learning path previously rendered every `not_started` lesson as available, even after its due date. The Academy API rejects starting an assignment once that deadline passes. That mismatch sent students into an action that could only fail.

The path now shows an expired, not-yet-started assignment as **Closed**, disables its start action, and explains that the learner should ask their educator about reopening it. An assignment that expires while the path remains open updates in place. Started, submitted, and reviewed work remains accessible. Missing or malformed due dates are not treated as closed by the UI; the API remains authoritative.

## Source of truth and safeguards

- API rule: `apps/api/app/learning.py`, `student_attempt_start` rejects a due date at or before current UTC time.
- The UI helper follows that rule for the display state; it does not grant access or replace server authorization.
- No student data, credentials, assignments, grades, or database state were changed.
- Existing shadcn Base Nova `Badge` and `Button` are used; no component source or runtime dependency was added. The project uses `@base-ui/react` 1.8.0. Its license remains the package's existing upstream license; this change does not vendor new source.

## Files

- `src/lib/academy-assignment-state.ts` — due-date display rule.
- `src/lib/academy-assignment-state.test.ts` — boundary and state coverage.
- `src/pages/StudentLearningPath.tsx` — closed state, disabled action and deadline refresh.
- `tests/e2e/academy-path-deadline-responsive.spec.ts` — API-fixture regression for expired state and responsive row sizing.

## Focused verification

- `npm run test -- src/lib/academy-assignment-state.test.ts` — 4 tests passed.
- `npm run typecheck` — passed.
- `npx eslint src/pages/StudentLearningPath.tsx src/lib/academy-assignment-state.ts src/lib/academy-assignment-state.test.ts` — passed.
- `git diff --check` — passed.
- A browser run against the live local Vite app at `/academy/paths/radiation-physics` used intercepted local-login and `/api/v1/academy/paths` responses. The expired assignment was a UI-only fixture (`no research case`); no real account, database write, research source, or credential was used. The real route, Shell, role gate, and components rendered.
- The browser check passed the **Closed** badge, disabled **Assignment closed** button, educator reopening guidance, no page errors, and no horizontal overflow at 1440, 768, and 390 CSS pixels. Body and document widths both equaled each viewport width.

## Visual evidence and responsive review

Captures are full-page screenshots from the live route, produced at these browser viewport sizes. Raster height reflects the full rendered page; viewport width is the device width used for layout.

| Viewport | Capture | Raster size | Visual result |
|---|---|---:|---|
| Desktop, 1440 × 1000 | `.local-review/ACADEMY-FIX-10/academy-path-desktop.png` | 1440 × 1132 | Closed state and reopening guidance are legible; two-column lesson row remains. |
| Tablet, 768 × 1024 | `.local-review/ACADEMY-FIX-10/academy-path-tablet.png` | 768 × 1866 | Lesson card switches to one column; title and metadata are readable. No horizontal overflow. |
| Mobile, 390 × 844 | `.local-review/ACADEMY-FIX-10/academy-path-mobile.png` | 390 × 2027 | Closed state and guidance remain readable in the single-column layout; no horizontal overflow. |

Absolute local capture paths:

- `/home/aymmzn/Documents/projects/HealthCure/medforge-dosetwin-vtkjs-spike/.local-review/ACADEMY-FIX-10/academy-path-desktop.png`
- `/home/aymmzn/Documents/projects/HealthCure/medforge-dosetwin-vtkjs-spike/.local-review/ACADEMY-FIX-10/academy-path-tablet.png`
- `/home/aymmzn/Documents/projects/HealthCure/medforge-dosetwin-vtkjs-spike/.local-review/ACADEMY-FIX-10/academy-path-mobile.png`

Screenshots are local review artifacts under the repository's ignored `.local-review/` directory. The tablet wrapping issue found in the first review is corrected and rechecked below.

## Tablet layout correction

The first 768px screenshot exposed an intrinsic-width problem: the row's explanatory text made the `auto` action column too wide while the `sm` two-column breakpoint was already active, leaving too little room for the lesson title. The lesson card now keeps its stacked content/action layout until the `lg` breakpoint; desktop keeps the side-by-side layout. The overview and mobile layout are unchanged.

The focused Playwright regression uses intercepted local-login and Academy-path responses on the real route, asserts one card-content column at tablet/mobile and two at desktop, checks the title region exceeds 250px at tablet, checks the disabled expired state and guidance, and asserts document/body widths match each viewport. It passed at 1440 × 1000, 768 × 1024, and 390 × 844 with no page errors. `npm run typecheck`, `npx eslint src/pages/StudentLearningPath.tsx`, and `git diff --check` also passed. No database, account, or research data was used or changed.
