# UX-51 — Academy submission and feedback status language

## Change

Student Academy and path actions now distinguish a submitted assignment awaiting educator review from a reviewed assignment with feedback available. Submitted work says **Check submission status**; reviewed work says **View educator feedback**. This aligns the visible action with the server-owned state and the existing delayed-feedback gate.

The change is present on the Academy's featured next activity, specialty branch lesson cards, and path lesson rows. On phones, the Academy now also has a persistent three-destination bottom navigation for Learn, Learning paths, and Progress, matching the locked mobile handoff. Its content gets a safe-area-aware bottom inset so the fixed navigation does not cover the last lesson or footer. It does not change assignment state, API behavior, grading, or access.

## Academy handoff audit

- Academy cards and navigation continue to use the checked-in shadcn/Base UI components. Trophy `AchievementBadge`, `AchievementGrid`, and `PointsBadge` are local MIT-vendored source; the Grid receives only earned awards from the Academy progress API. No Trophy SDK, package, fabricated locked badge, level threshold, streak, leaderboard, or XP history was added.
- XP and achievement preferences are learner-controlled and default to off in the API migrations. The API records cosmetic XP and the `First Evidence Investigation` activity award only as part of an educator's manual review while the corresponding preference is enabled. The award does not change assignment access or grades.
- Learning paths and lesson states remain the authenticated cohort API response. Each mission still opens its assigned published version and source-specific viewer; evidence and responses save to the attempt, submission stays idempotent, and references remain withheld until educator review.
- Mobile branch layout already collapses to one source lane at phone widths; this change adds the handoff's bottom destinations. The new navigation was captured from an authenticated, disposable seeded-student session at 1440×900, 768×1024, and 390×844. It is absent at desktop and tablet widths, appears at phone width, has one active destination, and introduces no horizontal overflow. The screenshots show an unassigned learner; they do not claim a published lesson, assignment, or completed Academy task. Existing authenticated Academy multi-viewport review is also recorded in [`PR-UX-35`](PR-UX-35-academy-branch-map.md).

  - [Desktop, 1440×900](../../.local-review/PR-UX-51-academy-mobile-nav/academy-desktop-viewport.png)
  - [Tablet, 768×1024](../../.local-review/PR-UX-51-academy-mobile-nav/academy-tablet-viewport.png)
  - [Phone, 390×844](../../.local-review/PR-UX-51-academy-mobile-nav/academy-mobile-viewport.png)

## Files

- `src/pages/Pages.tsx` — Academy branch and home featured-activity labels.
- `src/pages/StudentLearningPath.tsx` — path lesson action labels.
- `src/components/Shell.tsx` and `src/styles.css` — mobile-only Academy navigation and safe-area spacing.

## Verification

- `npm run typecheck -- --pretty false` — passed.
- `git diff --check` — passed.
- Authenticated disposable-student browser review — passed at desktop, tablet, and phone sizes; one active destination per route, no horizontal overflow or page errors. Learn and Learning paths anchor navigation was checked.
- No broad test suite was run. The navigation is present only in Academy routes and reuses the existing role-gated destinations. Reviewed and submitted state continues to come from the existing authenticated Academy API; opt-in XP/awards remain server-controlled and off by default.
