# UX-13 — Model Lab discovery filters

## Status

Implemented and committed on `review/cobalt-dosetwin-d2-d3` as `ace18e5`.

## What changed

- Added catalog search across registry-provided method names, operation IDs, license terms, and descriptions.
- Added All, Ready, and Gated readiness filters that combine with the existing specialty filters.
- Readiness is taken only from the API registry. The browser does not infer or promote a method's execution status.
- The no-results state explains that the selected query and filters found no registered methods. Clearing search restores discovery.
- Model execution controls and model records were not added or fabricated.

## Files changed

- `src/pages/Pages.tsx` — Model Lab search and readiness controls.
- `src/lib/model-catalog.ts` — pure API-record filtering helper.
- `src/lib/model-catalog.test.ts` — focused registry-field and combined-filter tests.
- `tests/e2e/workspace-shell.spec.ts` — browser coverage for readiness, combined search, no results, and clearing search.

## Components and libraries

- Existing shadcn Base Nova components: `InputGroup`, `ToggleGroup`, `Button`, and the existing catalog `Card` compositions.
- Existing `@base-ui/react` 1.8.0 (MIT), Tailwind CSS 4.3.3 (MIT), and Lucide icons (ISC).
- No dependency, model runtime, checkpoint, or data source was added.

## Checks actually run

- Focused Vitest: 2 passed.
- Focused Playwright Model Lab catalog test: 1 passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `git diff --check` — passed.
- Actual local application with the live seven-record model registry captured at 1440×900, 768×1024, and 390×844. All three requests returned HTTP 200, with no page errors or horizontal overflow. Screenshots and the viewport report are under ignored `.local-review/UX13-model-lab/` (`models-1440x900.png`, `models-768x1024.png`, `models-390x844.png`, `report.json`).

## Review access and data boundaries

Start the default local profile and open <http://127.0.0.1:5173/studio/models>. No account is required for Professional Studio. The student and educator account setup, profile URLs, and isolated `pt_241` launcher are documented in [`LOCAL_ACCESS_AND_PROFILES.md`](../LOCAL_ACCESS_AND_PROFILES.md). Model Lab displays the locally registered source records and their server-provided readiness; gated records remain gated.
