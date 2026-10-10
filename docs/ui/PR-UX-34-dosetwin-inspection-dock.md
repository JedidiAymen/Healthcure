# UX-34: DoseTwin inspection dock

## Change

Kept the large linked DoseTwin image planes and moved downstream inspection into a shadcn tabbed dock:

- **Measurements** retains the calculated cumulative DVH, official OpenKBP benchmark metrics, and the method note.
- **Comparison** lazy-loads the existing same-case prediction comparison. It stays unavailable unless a compatible authentic artifact is installed, and remains hidden in learner/guided/read-only mode.
- **Source evidence** retains the dose legend, source revision, SHA-256 hashes, coordinate limits, and dataset terms notice.

The default tab shows measurements; selecting another tab does not reset the selected voxel or overlays. The Base UI tab stack is explicitly vertical, and the phone tab labels fit the available width. Scientific calculations, APIs, comparison reports, and dataset files were not changed.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed (existing large vtk.js chunk and React module-directive advisories remain).
- `npm run test` — 44 tests passed.
- `npx playwright test tests/e2e/workspace-shell.spec.ts --grep 'DoseTwin keeps one Gy scale' --workers=1` — passed; checks linked planes, disabled empty-comparison state, measurement rows, source panel, keyboard navigation, zoom/pan, and tablet layout.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4174 MEDFORGE_API_PORT=18109 npx playwright test tests/e2e/dosetwin-comparison-report.spec.ts --workers=1` — passed against the installed `pt_241` reference and authentic archived prediction using a disposable local API database and artifact folder. It checks the real signed difference view, DVH, report persistence, and source hashes; captures all three viewport sizes and asserts the page and tab strip have no horizontal overflow.
- Actual-source captures: `.local-review/UX-34/dosetwin-{desktop,tablet,phone}.png` and `.local-review/UX-34/dosetwin-{desktop,tablet,phone}-comparison.png` (ignored local review files; not committed).

## Files

- `src/pages/DoseViewer.tsx`
- `tests/e2e/dosetwin-comparison-report.spec.ts`
- `tests/e2e/workspace-shell.spec.ts`
- `docs/STATUS.md`
