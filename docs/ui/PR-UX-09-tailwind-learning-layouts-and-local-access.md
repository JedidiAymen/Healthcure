# Learning layout cleanup and local profile guide

**Status:** implemented on `review/cobalt-dosetwin-d2-d3`.

## What changed

- Replaced the remaining lesson-editor workspace breadcrumb styling with Tailwind utilities.
- Replaced Academy progress links, recognition statistics and educator assignment rows with semantic Tailwind utilities. Removed the corresponding unused legacy selectors from `src/styles.css` and `src/pages/academy.css`; the Tailwind entry stylesheet is now 12,567 bytes.
- Added [`docs/LOCAL_ACCESS_AND_PROFILES.md`](../LOCAL_ACCESS_AND_PROFILES.md) with start commands, profile URLs, local account setup and credential handling. It clarifies there are no seeded/shared credentials, the only provisionable sign-in roles are student and educator, and Professional Studio is local unauthenticated research browsing.
- Linked the profile guide from the README and local-run instructions.
- Reused the machine's already-installed source datasets through ignored, local-only links; the data are not committed. This checkout contains one OpenKBP case (`pt_201`), 1,933 Endoscapes annotated stills and 59 FiSaV recordings. It has no continuous surgical video or second dose case.

## Components and libraries

No dependency was added. The changed views use installed shadcn Card, Badge and Empty compositions, Tailwind CSS 4.3.3 (MIT), and Lucide React 1.53.0 (ISC). The local profile guide documents account provisioning by the existing Python utility; it does not include passwords or test credentials.

## Visual evidence

The populated case registry captures for desktop (1440×900), tablet (768×1024) and mobile (390×844) are in `.local-review/CSS-TAILWIND-EMPTY-CASES/`. These are the unchanged actual-app views used as the previous migration's regression evidence. The current increment is a utility-class migration on Academy and educator rows; it adds no new scientific evidence or sample patient data.

## Verification

After the code changes, the following passed: `npm run typecheck`, `npm run lint`, `npm run test` (28), `npm run test:e2e -- --workers=1` (10), and `npm run build`. API tests and source-backed route smoke also passed in the same review cycle. The lazy vtk.js chunk-size notice remains an advisory; it does not fail the build.
