# UX-54: Professional specialty atlas at desktop width

## Change

The Professional Studio specialty atlas now moves to three equal columns at the `xl` breakpoint. At common 1440px desktop widths, SurgiVision, DoseTwin, and FistulaGuard appear together as one balanced row instead of leaving the third real research workspace by itself below a two-card row. Smaller tablet and phone layouts retain their existing two-column and one-column behavior.

The tiles continue to render the locally available, source-backed Endoscapes frame, OpenKBP dose view, and FiSaV waveform with the existing counts and routes. No medical values, calculations, or source-selection behavior changed.

## Verification

- Actual running app reviewed at 1440×900, 768×1024, and 390×844.
- All three routes returned HTTP 200, with no browser page errors or horizontal overflow.
- `npm run typecheck -- --pretty false` passed.
- `npx eslint src/pages/Pages.tsx` passed.
- `git diff --check` passed.
- Screenshots: `.local-review/PR-UX-54-specialty-atlas/` (local review artifacts; ignored by Git).

## Files

- `src/pages/Pages.tsx`
- `.local-review/PR-UX-54-specialty-atlas/studio-1440.png`
- `.local-review/PR-UX-54-specialty-atlas/studio-768.png`
- `.local-review/PR-UX-54-specialty-atlas/studio-390.png`
