# Case registry rows — Tailwind and shadcn migration

**Status:** implemented on `review/cobalt-dosetwin-d2-d3`. The change replaces
legacy row styling on Professional Studio case and saved-run lists with
Tailwind utilities and semantic shadcn tokens.

## What changed

- Migrated the shared case row layouts in the Studio overview, case registry,
  and Experiments saved-run list to responsive Tailwind utilities.
- Replaced the handwritten source-kind pill with the installed shadcn `Badge`
  and semantic `outline` variant.
- Removed the obsolete `case-list`, `case-row`, `case-module-icon`,
  `case-primary`, `case-origin`, and `case-id` rules from the Tailwind entry
  stylesheet. The source and dataset identity remain visible in each row.
- No data, route, filter, selection, or research behavior changed. No dependency
  was added.

## Installed components

| Library | Version | License | Use |
|---|---:|---|---|
| Tailwind CSS | 4.3.3 | MIT | Responsive layout and semantic token utilities |
| shadcn `Badge` / `Button` | checked-in project components | MIT | Source-kind label and saved-run actions |
| Lucide React | 1.53.0 | ISC | Existing case and action icons |

## Running-app review

Captured the actual local Healthcure app at `/studio/cases` against the
installed 1,993-record source registry. All viewport responses were HTTP 200,
with no browser page errors or horizontal overflow.

- Desktop, 1440×900: `.local-review/CSS-TAILWIND-CASE-ROWS/cases-1440x900.png`
- Tablet, 768×1024: `.local-review/CSS-TAILWIND-CASE-ROWS/cases-768x1024.png`
- Mobile, 390×844: `.local-review/CSS-TAILWIND-CASE-ROWS/cases-390x844.png`

The captures are local review artifacts and stay ignored because they display
source-derived research identifiers.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test` — 28 passed.
- `npm run test:e2e -- --workers=1` — 9 passed.
- `npm run build` — passed; the lazy vtk.js surface chunk remains above the
  bundler's 500 kB advisory threshold.
- Pinned API environment: 34 passed, 1 skipped; contract check passed.
- Real-source local smoke: 1 DoseTwin case, 1,933 SurgiVision frames, 59 FiSaV
  recordings, and all 19 app-shell routes passed.

This increment is a row-style migration, not a claim that every remaining
feature selector in `src/styles.css` has been converted. The stylesheet still
owns Tailwind imports and semantic tokens plus precise scientific renderer
styles and some legacy feature selectors that require separate review.
