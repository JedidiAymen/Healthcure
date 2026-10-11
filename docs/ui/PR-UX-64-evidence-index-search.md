# UX-64 — Saved evidence index search

## Change

Evidence Reports can search loaded saved records by case ID, source, method, frame, report ID, channel and available source hash. Specialty filters follow the existing record kinds: DoseTwin, SurgiVision and FiSaV. A live count clarifies that search covers the records currently loaded; existing FiSaV pagination remains available. A shadcn `Empty` state offers reset when filters have no matches.

Search and filters are client-side only. No API, saved evidence, pagination, authorization, or profile behavior changed, and no new dependency was added.

## Files

- `src/pages/Pages.tsx` — evidence indexing/search and specialty filter UI.
- `docs/PROGRESS.md` — milestone record.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `git diff --check` — passed.
- No tests were run for this UI-only change.
