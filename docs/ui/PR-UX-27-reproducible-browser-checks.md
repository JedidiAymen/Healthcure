# UX-27 — Keep browser checks reproducible without private research data

## Change

The GitHub Actions workflow now runs `npm run test:e2e:ci`, a browser suite that is self-contained and needs no local database or large research datasets. The CholecT50 navigation check supplies clearly test-only fixture responses by default; setting `MEDFORGE_E2E_SOURCE_API=1` switches that same test to the installed local source API and retains its real-source verification/captures. Three end-to-end checks that specifically require the local OpenKBP-Opt, FiSaV, or learner source datasets are tagged `@source`; they remain in the full `npm run test:e2e` suite for a provisioned local review checkout.

The review found two stale UI assertions and a popover that exceeded the visible viewport under the 200% zoom simulation. The assertions now target current semantic labels. Combobox popovers and their option lists cap height from the browser's visual viewport, while still honoring Base UI's available-space constraint.

## Verification

- `npm run test:e2e:ci -- --workers=2` — **16 passed**, with no API server or research datasets running on the test port.
- `MEDFORGE_API_PORT=18098 MEDFORGE_E2E_SOURCE_API=1 npx playwright test tests/e2e/cholect50-sampled-review.spec.ts --workers=1` — **1 passed** against the installed CholecT50 source data.
- `npm run lint`, `npm run typecheck`, `npm run test` (**44 passed**), and `npm run build` passed.
- Educator picker visual captures at desktop/tablet/phone and the 720×450, 200%-scale geometry check are local under `.local-review/FIX-01/`; the SurgiVision picker also has a real app tablet capture there.

## Reproduction notes

Run `npm run test:e2e` to include all tests. The three `@source` tests need their stated ignored local source assets and the appropriate API profile. CI intentionally runs the self-contained browser coverage and leaves source-dataset integration to an installed, local review environment; the source checks remain in the repository and are not renamed as fixture verification.

Existing Base UI/shadcn Combobox components were adjusted; no new package was added. No product data or API calculations changed.
