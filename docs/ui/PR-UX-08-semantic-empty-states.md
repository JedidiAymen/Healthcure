# Registry and research empty states — shadcn and Tailwind

**Status:** implemented on `review/cobalt-dosetwin-d2-d3`. This increment
replaces custom empty-state CSS in the case registry and research flows with
the installed shadcn `Empty` component and semantic Tailwind utilities.

## What changed

- The no-source case registry now uses `Empty`, `EmptyHeader`, `EmptyMedia`,
  `EmptyTitle`, and `EmptyDescription`, with semantic routes for all three
  research specialties. It continues to state that no sample patient is
  seeded.
- Shared saved-run empty states use shadcn `Empty`; loading states use explicit
  status regions and Tailwind layout.
- `EmptyTitle` now exposes `role="heading"` and level 2 so the shared title is
  announced in the heading structure.
- Replaced registry filters, count, and pagination spacing rules with utility
  classes, and removed the corresponding unused CSS selectors. Tailwind's
  entry stylesheet shrank from 16,533 to 14,172 bytes in this increment.
- Added an end-to-end regression for the empty registry at 390×844. Its API
  fixture returns an empty source set; it does not introduce medical data.

## Components and libraries

| Library/component | Version | License | Use |
|---|---:|---|---|
| Tailwind CSS | 4.3.3 | MIT | Semantic layout and responsive utility classes |
| shadcn `Empty` | checked-in project component | MIT | Consistent empty-state composition |
| Lucide React | 1.53.0 | ISC | Existing source and specialty icons |

No dependency was added.

## Actual-app screenshots

Captured populated `/studio/cases` against the local API with all 1,993
installed records. Each route returned HTTP 200, had no browser page errors,
and fit the viewport width.

- Desktop, 1440×900: `.local-review/CSS-TAILWIND-EMPTY-CASES/cases-1440x900.png`
- Tablet, 768×1024: `.local-review/CSS-TAILWIND-EMPTY-CASES/cases-768x1024.png`
- Mobile, 390×844: `.local-review/CSS-TAILWIND-EMPTY-CASES/cases-390x844.png`

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test` — 28 passed.
- `npm run test:e2e -- --workers=1` — 10 passed, including the empty-source
  regression.
- `npm run build` — passed; the lazy vtk.js surface chunk remains above the
  bundler's 500 kB advisory threshold.
- API suite, generated-contract check, and source-backed local smoke remain
  green from the previous review; this increment changes only frontend UI,
  component semantics, and documentation.
