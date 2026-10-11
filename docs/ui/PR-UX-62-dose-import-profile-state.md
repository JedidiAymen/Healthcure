# DoseTwin comparison empty state distinguishes installed source from profile import

## Change

The comparison panel no longer says the second array is missing from disk when there is no validated artifact attached to the selected case in the active SQLite profile. It now explains that imports are profile-specific, require a permitted same-case prediction and declared rights basis, and must pass grid and unit checks. It also clarifies that archived outputs are not runnable inference.

This checkout includes authentic OpenKBP `pt_241` CT, reference dose, masks, and archived `set_1` prediction data. The case viewer works without an import; comparison results appear only after a permitted import is recorded in the active profile. No prediction or report was created by this change.

## Files

- `src/features/dosetwin/DoseTwinComparisonPanel.tsx`
- `tests/e2e/workspace-shell.spec.ts`

## Verification

- `npm run test:e2e:ci -- --workers=1 --grep 'DoseTwin keeps one Gy scale|DoseTwin case picker opens'` — passed (2 tests).
- `git diff --check` — passed.

The route fixtures mock the API and do not write to SQLite. The local preview uses a temporary DB; the original profile databases and imports were not changed.
