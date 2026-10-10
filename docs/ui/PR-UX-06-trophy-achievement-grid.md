# UX-06 — Trophy Achievement Grid

**Status: Integrated; source-backed QA-earned state visually verified.** The official Trophy Grid renders only awards returned by the student's API after opting in. The award shown below was generated in an isolated QA database through an educator-reviewed FiSaV assignment; it is interface evidence, not a real learner's achievement or clinical competency.

## What changed

- Added the official `AchievementGrid` source from Trophy UI commit `81ee8a192b781aa1dff39c972fef692b31e3359e` and connected it to the existing API-authorized achievement list.
- The grid is not mounted while the student is opted out. An opted-in student with no earned award sees the existing explicit empty state. No locked award, rarity, score, or progress is generated.
- Preserved the sourced award description and earned date alongside the badge grid. Labels continue to say the award is activity recognition, not clinical or professional ability.
- Added a porcelain/coral/gold theme treatment scoped to the Academy; no runtime dependency or network call was added.

## Source and license

- Component source: `apps/www/registry/trophy/ui/achievement-grid.tsx` at upstream commit `81ee8a192b781aa1dff39c972fef692b31e3359e`.
- Official docs: [Achievement Grid](https://ui.trophy.so/docs/components/achievement-grid).
- Upstream license: [MIT at the pinned commit](https://github.com/trophyso/ui/blob/81ee8a192b781aa1dff39c972fef692b31e3359e/LICENSE.md).
- Manual source copy/adaptation; uses existing `class-variance-authority`, local `cn`, local AchievementBadge and Tailwind 4. No package was added.

## Verification and actual-app review

- On the current review branch, used the isolated local `review-student` state bound to authentic FiSaV `pat001` evidence and two educator-reviewed rubric attempts. The authenticated API returned 20 opted-in XP and one `First Evidence Investigation` award; the actual Trophy grid, description and earned date rendered at desktop 1440×900, tablet 768×1024 and phone 390×844. All three sizes had no horizontal overflow or browser exceptions. The fixture is temporary QA data, not learner research or evidence of competence.
- Current captures are ignored local files under `.local-review/ACADEMY-AWARD-REVIEW/`; the earlier opt-out and no-award empty-state screenshots remain under `.local-review/TROPHY-GRID/`.
- `npm run lint`, `npm run typecheck`, `npm run test` (25 passed), and `npm run build` passed.
- Build delta against parent `a72e5cd`: Academy CSS +0.28 kB raw / +0.04 kB gzip; Pages chunk +0.62 kB raw / +0.19 kB gzip. No dependency or remote-asset delta.
- Grid badges are non-interactive list items, so they add no keyboard stops. There is no motion or external image request. This QA review verifies authorized award rendering; it does not establish any real learner's progress.

## Files

- `src/components/ui/achievement-grid.tsx` — pinned Trophy Grid component source.
- `src/pages/Pages.tsx` — API-gated award mapping in Progress.
- `src/pages/academy.css` — Academy-specific warm reward colors.
- `docs/ui/library-spikes.md` — adoption gate and pending real-award review.
