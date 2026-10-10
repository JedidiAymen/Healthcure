# UX-06 — Trophy Achievement Grid

**Status: Integrated; real earned state pending.** The official Trophy Grid now renders only awards returned by the student's API after opting in. The normal local preview has no educator-reviewed award, so the real grid state is deliberately not fabricated.

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

- Desktop 1440×900, tablet 768×1024 and phone 390×844: no horizontal overflow or browser exceptions. With opt-in disabled, recognition stays off. With opt-in enabled and no award, the honest empty state appears and the award grid stays unmounted.
- Private local captures are ignored by Git under `.local-review/TROPHY-GRID/`.
- `npm run lint`, `npm run typecheck`, `npm run test` (25 passed), and `npm run build` passed.
- Build delta against parent `a72e5cd`: Academy CSS +0.28 kB raw / +0.04 kB gzip; Pages chunk +0.62 kB raw / +0.19 kB gzip. No dependency or remote-asset delta.
- Grid badges are non-interactive list items, so they add no keyboard stops. There is no motion or external image request. A genuine awarded badge has not been exercised in-browser because no authentic reviewed award exists in the disposable account.

## Files

- `src/components/ui/achievement-grid.tsx` — pinned Trophy Grid component source.
- `src/pages/Pages.tsx` — API-gated award mapping in Progress.
- `src/pages/academy.css` — Academy-specific warm reward colors.
- `docs/ui/library-spikes.md` — adoption gate and pending real-award review.
