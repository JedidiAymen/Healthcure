# UX-58 — Give educators a clear first step on an empty lesson canvas

## Change

When an educator removes the final lesson block, the lesson canvas now explains the evidence-path workflow and offers **Add the first step**. The action adds the existing Instruction block and returns the educator to the same editable canvas. Source selection, drag and keyboard reordering, learner-safe preview, rubric, persistence, and publishing behavior are unchanged.

## Components and dependencies

- Uses the installed shadcn `Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, and `EmptyDescription` composition with the existing `Button`.
- Component source follows the repository's existing Base UI based shadcn setup; no vendor component source, package, or runtime dependency was added.
- Existing `@dnd-kit` lesson reordering is untouched.

## Files

- `src/pages/LessonEditor.tsx`
- `tests/e2e/workspace-shell.spec.ts`
- `docs/ui/PR-UX-58-educator-empty-canvas.md`

## Verification

- The focused educator route browser test passed (1 test), including removal of the final Instruction block, the shadcn empty state, and restoration of the first block.
- The same test verifies the real installed source picker at desktop, tablet, mobile, and constrained viewport geometry. After resetting browser viewport emulation it reopens the source picker so its portal recomputes its anchor. Geometry is checked against actual visible bounds rather than inferred CSS viewport units.
- `npm run typecheck -- --pretty false` — passed.
- `npx eslint src/pages/LessonEditor.tsx` — passed.
- `git diff --check` — passed.
- The route test uses an isolated UI-only local profile; it does not create, publish, or assign a lesson in the application database.

