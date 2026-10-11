# Educator preview revision gate

## Change

Bind the student-safe publication preview to the saved draft revision it came from. If the educator edits the draft or saves a newer revision after previewing, the preview is marked out of date. Its source confirmation and review note are disabled, and publication remains blocked until the current saved draft is previewed again. The existing source-rights checks, learner projection, answer redaction, DnD editor, and backend publication flow are unchanged.

This prevents an educator from confirming and publishing an older learner projection while the editor shows newer, unsaved or newly saved content. The server remains authoritative for rights, validation, revision ownership, and publication.

## Files changed

- `src/pages/LessonEditor.tsx` — stores the revision associated with a successful preview, compares it with the current saved revision, shows the stale-preview notice, and gates publication in both the button and handler.
- `tests/e2e/workspace-shell.spec.ts` — added a route-fixture browser flow covering preview, edit, save a newer revision, blocked publish, and fresh-preview recovery. It uses intercepted API responses and does not alter a profile database.

## Components and licensing

- Reused existing local shadcn-style `Alert`, `Card`, `Checkbox`, `Field`, and `Button` source. The project uses the `base-nova` shadcn configuration and installed Base UI primitives.
- No component source or package was added; no new license obligations or bundle weight.

## Verification

- `npm run test:e2e:ci -- tests/e2e/workspace-shell.spec.ts --grep 'educator (lesson editor loads|preview cannot publish)'` — passed, 2 tests.
- `npm run typecheck` — passed.
- `npx eslint src/pages/LessonEditor.tsx` — passed.
- `git diff --check` — passed.
- Stale-preview captures are in ignored `.local-review/UX-61-educator-stale-preview/` at desktop, tablet, and phone widths.
