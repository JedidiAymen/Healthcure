# UX-49: Workspace entry and educator authoring canvas

Updated: 2026-10-10

## Delivered

- The home route now opens with three distinct role choices: Professional Studio, Student Academy, and Educator Studio. The choices appear before the research collections so users can find their workflow immediately. Professional keeps the cobalt/porcelain research shell; Academy has a warm cream surface; Educator has its own light teaching surface.
- The cards use the project's existing shadcn Card composition. Routes still enter the existing professional, student, and educator flows; the professional action resumes a saved completed DoseTwin run when one exists.
- The Academy welcome viewport and its caption now use the actual in-progress lesson from the selected learning path, showing its assignment title and case. If no investigation is in progress, the existing first-lesson/source behavior remains.
- Educator lesson blocks now have a source-aware palette with distinct existing icons and concise descriptions. The authoring canvas numbers each saved step and explains the learner's route through the selected real source. Drag sorting, keyboard sorting, move controls, draft persistence, learner preview, rubric, and publication checks are unchanged.
- DoseTwin's three linked planes now include source-grid scrubbers alongside their existing index inputs. The scrubbers use the established 0–127 processed-grid indices, route through the same linked index handler, and respect the locked-view state.
- HackCure's current compliance snapshot and L3 dossier now describe the DoseTwin local research-review demo and the currently implemented system. The old teammate audit remains explicitly historical, and its unresolved-flagship question now records the later decision.

## Files

- `src/pages/Pages.tsx`
- `src/pages/DoseViewer.tsx`
- `src/pages/LessonEditor.tsx`
- `src/pages/DoseViewer.tsx`
- `src/styles.css`
- `docs/HACKCURE_COMPLIANCE.md`
- `docs/L3_DEPLOYMENT_DOSSIER.md`
- `docs/STATUS.md`
- `docs/PROGRESS.md`
- `docs/RELEASE_CHECKLIST.md`

## UI components and dependencies

No package was installed for this milestone. Cards use the existing local shadcn Card wrapper at `src/components/ui/card.tsx`, backed by Base UI React 1.8.0 (MIT); Tailwind CSS 4.3.3 (MIT) styles the surfaces; Lucide React 1.53.0 (ISC) supplies the icons. The Educator canvas continues to use dnd-kit Core 6.3.1 and Sortable 10.0.0 (MIT), already present in the lockfile.

## Running review

Local app: `http://127.0.0.1:18301/`. DoseTwin: `http://127.0.0.1:18301/studio/dosetwin/cases/openkbp%3Apt_201`. Educator editor: `http://127.0.0.1:18301/educator/cases/new/edit`.

Home role chooser screenshots were manually reviewed at 390×844, 768×1024, 1280×800, and 1440×900. They are local-only in `.local-review/PR-UX-49-home-role-chooser/`. The tablet layout stacks all three role cards; desktop presents three columns. DoseTwin was manually reviewed with its installed `pt_201` source arrays, measurements, and the three slice scrubbers visible. The Educator and Academy changes were not captured in fresh screenshots during this milestone.

## Verification

- `npm run typecheck` passed after the TypeScript/TSX changes.
- `git diff --check` passed.
- Manual viewport review confirmed that the role chooser fits on phone, tablet, laptop, and desktop without horizontal overflow or browser errors.
- Manual running-app review confirmed that the source-backed DoseTwin view renders the primary plane, linked planes, measurements, and scrubber controls for `pt_201`.
- No broad test suite was run for this milestone.

## Limits

These are entry and authoring improvements, not completion of the full approved redesign. The next milestones remain the specialist scientific workstations and their source-specific displays, the Academy investigation presentation, Model Lab, and the remaining locked-handoff requirements. Dataset rights and local-only use boundaries continue to apply.
