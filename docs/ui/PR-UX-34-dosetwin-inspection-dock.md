# UX-34: DoseTwin inspection dock

## Change

Kept the large linked DoseTwin image planes and moved downstream inspection into a shadcn tabbed dock:

- **Measurements** retains the calculated cumulative DVH, official OpenKBP benchmark metrics, and the method note.
- **Comparison** lazy-loads the existing same-case prediction comparison. It stays unavailable unless a compatible authentic artifact is installed, and remains hidden in learner/guided/read-only mode.
- **Source evidence** retains the dose legend, source revision, SHA-256 hashes, coordinate limits, and dataset terms notice.

The default tab shows measurements; selecting another tab does not reset the selected voxel or overlays. Scientific calculations, APIs, comparison reports, and dataset files were not changed.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed (existing large vtk.js chunk and React module-directive advisories remain).
- `npx playwright test tests/e2e/workspace-shell.spec.ts --grep 'DoseTwin keeps one Gy scale' --workers=1` — passed; checks linked planes, disabled empty-comparison state, measurement rows, source panel, keyboard navigation, zoom/pan, and tablet layout.
- The authentic `pt_241` comparison test now selects the Comparison tab, but a fresh source-backed run and visual captures at desktop/tablet/phone remain pending.

## Files

- `src/pages/DoseViewer.tsx`
- `tests/e2e/dosetwin-comparison-report.spec.ts`
- `tests/e2e/workspace-shell.spec.ts`
- `docs/STATUS.md`
