# UX-01 — Cobalt / Porcelain app shell

**State:** Implemented locally on `redesign/cobalt-porcelain-v3`. Not pushed or deployed.

## What changed

- Replaced the universal dark appearance with the approved role surfaces: Professional `#F3F5FA`, Academy `#FFF8ED`, Educator `#F6F8FC`, white cards, cobalt `#3552D7` actions, and their specified border/text tokens.
- Added the approved focus, coral, gold, success, warning, danger, spacing, and radius tokens. The clinical image and chart encodings remain independent from rewards and brand colors.
- Set the professional toolbar to 60px and the shadcn Sidebar rail to 224px. Sidebar links follow the active workspace; the professional role no longer mixes student and educator navigation into the same list.
- Reworked Home around the real research work: source-backed specialty viewers, actual installed counts (1,933 Endoscapes frames, one OpenKBP case, 59 FiSaV recordings), and the existing illustrative radiology-team photograph. No synthetic clinical metrics or AI analysis were added.
- Self-hosted Inter Variable, Plus Jakarta Sans Variable, and IBM Plex Mono.

## Files changed

- `src/styles.css`
- `src/components/Shell.tsx`
- `src/pages/Pages.tsx`
- `package.json` and the tracked `package-lock.json`
- `scripts/capture_ui_review.mjs`
- `tests/e2e/workspace-shell.spec.ts`

## Existing component and font sources

- Existing shadcn/Base Nova components (`Sidebar`, `Button`, `Card`, `Badge`, `Select`, `Toggle`, `Slider`) continue to use the checked-in component source. Runtime primitive package: `@base-ui/react` 1.8.0, MIT; Tailwind CSS 4.3.3, MIT. No replacement button, card, or modal library was introduced.
- `@fontsource-variable/inter` 5.3.0 — SIL Open Font License 1.1.
- `@fontsource-variable/plus-jakarta-sans` 5.3.0 — SIL Open Font License 1.1.
- `@fontsource/ibm-plex-mono` 5.3.0 — SIL Open Font License 1.1; Latin weights 400/500/600.

Only font CSS and the unicode subset requested by the browser are loaded. The font files are production assets; no font service is called.

## Actual-app screenshot review

All 13 handoff routes were captured at **1440×900, 1280×800, 768×1024, and 390×844** after the shell and DoseTwin changes. The real local app returned HTTP 200, with **0 browser page errors and 0 horizontal overflows across 52 route/viewport captures**. The private screenshot set and exact route/viewport/error report are under `.local-review/UX-02/final/`; it is ignored by Git because some viewers contain source-backed research imagery.

The Academy and Educator routes remain protected in this empty isolated review database, so these captures show the actual access gate, not authenticated student/educator workflows. Those are still required milestones.

## Checks executed

- `npm ci` — passed with the lockfile selected; 0 reported vulnerabilities.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test` — 17 passed.
- `npm run test:e2e -- --workers=1` — 2 passed.
- `npm run build` — passed; app entry 424.43 kB (131.79 kB gzip), stylesheet 133.25 kB (26.05 kB gzip). Font subset assets are emitted separately.
- Existing API tests, contract checks, and data parity tests were run before this frontend-only milestone; none of their source or expected data was replaced.
