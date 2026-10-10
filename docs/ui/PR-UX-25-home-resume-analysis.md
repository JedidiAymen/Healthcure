# UX-25 — Resume a saved DoseTwin analysis from Home

## Change

Home now checks the local run history for a completed `openkbp.case_summary` result. When one exists, the primary action is a semantic link labeled **Continue analysis** and carries the saved run ID to Experiments. Experiments selects that exact result and shows its recorded metrics. When no completed summary exists, Home keeps the Professional Studio entry action.

This reads existing API history; it does not create a run, invent a result, or change research calculations. The CTA is styled with the existing generated shadcn Base Nova button variants. The navigation target is a React Router link so it remains keyboard-accessible and has link semantics.

## Evidence

- Focused Playwright test: `npx playwright test tests/e2e/workspace-shell.spec.ts --grep 'home resumes' --workers=1`.
- Responsive Home captures from the running Vite app with a clearly marked API fixture: `.local-review/UX-25-home-resume/home-desktop-1440x900.png`, `home-tablet-768x1024.png`, and `home-phone-390x844.png`.
- `npm run lint`, `npm run typecheck`, `npm run test` (44 passed), and `npm run build` passed.
- Existing UI source: `src/components/ui/button.tsx`, shadcn-generated Base Nova style using Base UI. No dependency was added or upgraded.

## Scope and limits

The browser test uses a fixture run to prove exact-run selection and displayed ROI values; it does not write to a reviewer’s real history. Existing integration smoke verifies live APIs and scientific data separately. No new source dataset, model output, or external service is involved.
