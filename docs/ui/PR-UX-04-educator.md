# UX-04 · Educator lesson builder

## Status

**Implemented for review.** The three-zone builder, verified-source handoff, and learner-safe preview are available. Source publication, assignment, and grading still depend on authorized cohort/source records; this local preview has no released lesson to assign.

## What changed

- Reworked the lesson editor into a source-and-block palette, central lesson canvas, and learner-safe preview at desktop widths.
- Moved source selection, source terms, and publication-use status beside the block palette so lesson authors see the provenance and permission state while arranging content.
- Added a live preview from the current draft. It omits `Reveal` blocks and all rubric/private educator guidance, identifies hidden educator reveal content, and keeps the source attribution visible.
- Added a compact mobile navigation between Source & blocks, Lesson canvas, and Learner preview, plus a two-column tablet layout.
- At compact widths, the three zones use a single active pane so the lesson canvas remains readable; the heading now uses the semantic foreground color. New drafts are labeled “Draft not saved yet” until the API returns a saved draft.
- Added a direct route from a selected source record to its DoseTwin, SurgiVision, or FistulaGuard scientific viewer.
- Retained the existing dnd-kit sortable flow and non-drag move controls, server-owned revision saves, publication preview, source confirmation, permission blockers, immutable version publishing, and rubric point checks.

## Files changed

- `src/pages/LessonEditor.tsx`
- `src/pages/lesson-editor.css` (new, scoped to the educator lesson builder)
- `src/App.tsx` — loads the editor page directly, avoiding a nested lazy component that prevented route rendering.
- `src/pages/Pages.tsx` — removes the obsolete nested editor export and labels the Academy team image as illustrative.
- `tests/e2e/workspace-shell.spec.ts` — route, responsive-pane, and reveal-block privacy regression coverage.
- `docs/ui/PR-UX-04-educator.md`

## Components and libraries

- Existing shadcn Base Nova/Base UI source components: `Card`, `Button`, `Select`, `Field`, `Input`, `Textarea`, `Checkbox`, `Alert`, and `Skeleton`.
- Existing `@base-ui/react` **1.8.0**, MIT; project shadcn source composition follows the official Base UI component guidance: [Card](https://ui.shadcn.com/docs/components/base/card), [Button](https://ui.shadcn.com/docs/components/base/button), [Tabs](https://ui.shadcn.com/docs/components/base/tabs), [Field](https://ui.shadcn.com/docs/components/base/field).
- Existing dnd-kit **@dnd-kit/core 6.3.1**, **@dnd-kit/sortable 10.0.0**, and **@dnd-kit/utilities 3.2.2**, MIT; kept the current pointer and keyboard sensor configuration.
- No new package was installed.

## Checks actually run

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — passed, 17 tests.
- `npm run test:e2e -- --workers=1` — passed, 3 browser tests. Includes actual route rendering, phone pane selection, `Reveal` redaction, and rubric exclusion from learner preview.
- `npm run build` — passed.
- Authenticated local application review at 1440×900, 1280×800, 768×1024, and 390×844 — no horizontal overflow or browser exceptions for Academy home, Academy path, or Educator lesson builder. Screenshot reports are in `.local-review/UX-04/final/` and are excluded from Git because they contain local research context.
- Verified on the 1440×900 capture that the editor renders the actual local case count (1,993 source-verified cases), real source-term/permission status when a case is selected, and the existing dnd-kit controls. The preview database has no released Academy assignment; no lesson was falsely shown as assigned or published.

## Privacy and permission boundaries

- The live preview is a local view of authored learner-facing blocks only. It filters educator `Reveal` blocks and never renders the educator rubric or private guidance.
- The separate publication preview still comes from the server's learner projection and remains the authorization boundary for publishing.
- Existing rights attestation, legal/source blockers, revision conflicts, immutable publication, and private rubric behavior remain in place.
- Local review accounts and data exist only in the ignored temporary preview database under `/tmp`; no local data, screenshots, credentials, or medical records are committed or pushed.

## Actual application screenshots

- Educator builder: `.local-review/UX-04/final/educator-1440x900.png`, `educator-1280x800.png`, `educator-768x1024.png`, `educator-390x844.png`.
- Academy home: `.local-review/UX-04/final/student-1440x900.png`, `student-1280x800.png`, `student-768x1024.png`, `student-390x844.png`.
- Academy path: `.local-review/UX-04/final/student-path-1440x900.png`, `student-path-1280x800.png`, `student-path-768x1024.png`, `student-path-390x844.png`.
