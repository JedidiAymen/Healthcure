# UX-59 · Model Lab provenance search

## Changes

- Extended the existing Model Lab catalog search to find methods by stable registry ID, specialty key, pinned source revision, and upstream URL, in addition to the already searchable name, registered operations, terms, and details.
- Search uses only fields returned in each `ModelRecord`. It does not derive readiness, claim a model is executable, or fabricate run output.

## Files changed

- `src/lib/model-catalog.ts`
- `src/lib/model-catalog.test.ts`
- `docs/ui/PR-UX-59-model-lab-provenance-search.md`

## Components, versions, licenses

- No new UI component or dependency. The existing shadcn Base Nova catalog UI remains unchanged.

## Checks

- `npx vitest run src/lib/model-catalog.test.ts` — run for this focused catalog behavior.
- `git diff --check` — run for patch formatting.

## Limits

- This improves discovery of registered provenance only. It does not enable gated inference, install checkpoints, alter source permissions, or create new runs.
