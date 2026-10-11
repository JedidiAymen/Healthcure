# Academy latest reviewed score summary

## Change

Added a compact, responsive summary to the rubric-history panel. When numeric reviews exist for a selected criterion, it now surfaces the latest educator-reviewed percentage, earned/available points, review date, and percentage-point change from the prior review. A single review shows no comparison. The existing chart and accessible review table remain available below it.

The summary uses only `StudentProgress.rubric_history`, already returned for the signed-in learner. It does not infer mastery, create XP or awards, or change preference, privacy, assignment, or API behavior.

## Files changed

- `src/pages/StudentProgressChart.tsx` — derived the latest and prior reviewed values from the selected criterion and rendered the summary.
- `tests/e2e/student-progress-history.spec.ts` — asserted real fixture values and verified that switching criteria updates the summary.

## Components and licensing

- Reused the existing local `StudentProgressChart`, shadcn-style `Card`, and `ChartContainer` source. `components.json` identifies the project style as `base-nova`; the chart uses the existing Recharts `3.10.1` dependency.
- No UI component or package was installed, and no third-party source was copied. There are no new dependency or license obligations.
- The repository already contains local `AchievementBadge` and `AchievementGrid` Trophy components (present before this change). The progress page uses them for server-recorded, opted-in achievements; this score summary does not render awards or alter that behavior.

## Verification

- `npm run test:e2e:ci -- --grep 'rubric history keeps same-second reviews separate and arrow-key inspectable'` — passed (1 test) with an isolated API fixture.
- `npm run typecheck` — passed.
- ESLint passed for `StudentProgressChart.tsx`; the configured ESLint excludes the Playwright test file, which it reported as ignored.
- `git diff --check` — passed.
