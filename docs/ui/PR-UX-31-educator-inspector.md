# UX-31 — Put rubric authoring beside the learner preview

## Change

The lesson canvas now stays focused on its ordered authored blocks. The scored rubric and private educator guidance live in the shadcn inspector beside a continuously updated, learner-safe preview. The preview omits Reveal blocks and does not render the rubric. Tablet widths keep the source palette and canvas visible together and open the inspector in a shadcn sheet; phone widths use a three-choice bottom switcher for source/blocks, lesson canvas and preview/rubric. Switching phone panes returns to the top of that pane.

The wide layout follows the approved B proportions: 208px source palette, flexible canvas and 304px inspector, beginning at 1280px. At tablet width the inspector opens from the toolbar. At phone width it is a full-width pane. Source selection, revision saving, rubric total validation, immutable publication preview and rights-review gates retain their existing API flows.

The live review used the real local FiSaV `pat001` source record. Its screen shows the publisher’s CC BY 4.0 terms and that publication review is required; the lesson was not published. The test-only UI fixture continues to verify that Reveal content stays absent from the learner preview.

## Verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — **44 passed across 13 files**.
- `npx playwright test tests/e2e/workspace-shell.spec.ts --grep "educator lesson editor loads" --workers=1` — **1 passed**; verifies the tablet sheet, rubric view, phone pane switching, learner preview redaction, picker geometry and no horizontal overflow.
- `node .local-review/UX-31/capture.mjs` — captured the actual running app at 1440×900, 1280×800, 768×1024 and 390×844; no page errors and the phone document width remained 390px.
- Screenshots are local and ignored by Git: `.local-review/UX-31/desktop-1440x900.png`, `laptop-1280x800.png`, `tablet-768x1024.png`, and `mobile-390x844.png`.
- `npm run build` — passed. Existing vtk.js large-chunk and React Compiler directive warnings remain.

## Components, source and safeguards

- Existing checked-in shadcn/Base UI `Toggle`, `Card`, `Sheet`, `Field`, `Input` and `Textarea` sources; Base UI is pinned at `@base-ui/react` 1.8.0 (MIT). No component package or vendor source was added.
- Existing dnd-kit 6.3.1 (MIT) still provides sortable authored lesson blocks with keyboard and pointer controls.
- No backend, grading, role, publication, permission or student payload code changed. The preview continues to filter Reveal blocks, and private rubric data remains in the educator draft.
- Screenshots stay local because they show installed research-source metadata. No raw dataset was added to Git.

## Files

- `src/pages/LessonEditor.tsx`
- `tests/e2e/workspace-shell.spec.ts`
- `docs/ui/PR-UX-31-educator-inspector.md`
