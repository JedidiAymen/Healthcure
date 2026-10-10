# UX-11 — Show the selected scientific source in Educator Studio

**Status: Implemented in `48a2854`; focused code checks passed. Authenticated desktop/tablet/phone visual review is in progress.**

## Change

Educators can inspect a small, read-only preview of the exact source selected for a lesson without leaving the builder:

- DoseTwin: the installed case's CT and reference-dose slice at Z 64.
- SurgiVision: the selected installed Endoscapes still.
- FistulaGuard: the first measured FiSaV channel over a bounded five-second source window.

The preview displays the selected dataset/case, the available license label, and source hashes or source revision beside the evidence. It labels FiSaV's channel unit as uncalibrated. A blocked or synthetic source, missing matching rights record, API error, or mismatched case/hash yields an explicit status and no evidence image. Changing the selected case clears the previous preview and revokes any source-image object URL. The existing publication gate and learner-safe preview are unchanged.

## Files

- `src/components/EducatorSourcePreview.tsx` — shadcn Card, Alert and Badge composition with read-only scientific previews.
- `src/lib/educator-source-preview.ts` and `.test.ts` — source eligibility checks and focused tests.
- `src/pages/LessonEditor.tsx` — places the preview next to the selected research source.

No package was installed. UI dependencies are the project's existing generated shadcn components, Tailwind utilities, and Lucide icons; the scientific evidence comes from the existing FastAPI source endpoints. The preview adds no new dataset or derived medical result.

## Verification

- Focused tests: `npx vitest run src/lib/educator-source-preview.test.ts` — 2 passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed. Existing vtk.js large-chunk and React compiler-directive warnings remain.
- `git diff --check` — passed.
- Actual authenticated visual screenshots at desktop, tablet and phone widths are being captured against an isolated disposable learner database; see this note's status above when complete.

## Limits

This preview is for source selection and lesson preparation, not clinical use. Dataset terms and publication restrictions remain in force. The saved review branch remains local-only for research data; pushing source code does not upload local datasets.
