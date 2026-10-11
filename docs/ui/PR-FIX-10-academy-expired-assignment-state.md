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

## Focused verification

- `npm run test -- src/lib/academy-assignment-state.test.ts` — 4 tests passed.
- `npm run typecheck` — passed.
- `npx eslint src/pages/StudentLearningPath.tsx src/lib/academy-assignment-state.ts src/lib/academy-assignment-state.test.ts` — passed.
- `git diff --check` — passed.

No visual screenshot was captured; the change is a conditional status/action state and did not change the path layout.
