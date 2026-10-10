# PR-UX-21 — FistulaGuard slider keyboard accessibility

**Status: PASS** against authentic locally installed FiSaV `pat001` source data.

## Change

The shared Base Nova Slider wrapper previously forwarded `aria-label` only to the root slider group. Base UI places the focusable range input inside each thumb, so assistive technology and role-based browser tools could not find a named slider. The wrapper now forwards the label with Base UI's `getAriaLabel` thumb API while retaining the named root group. No range math or source-analysis behavior changed.

The existing real-source FiSaV Playwright flow now checks keyboard bounds on the 5-second window: Home selects source time zero, ArrowRight moves one sample interval (`1 / 10,000 Hz = 0.0001 s`), and End selects `duration - window duration`. The accessible waveform time range follows each value; the test also continues to verify checksum-backed channel switching and saved comparison reopen.

## Files

- `src/components/ui/slider.tsx` — pass its existing accessible label down to the actual Base UI slider thumb input.
- `tests/e2e/fistulaguard-authentic.spec.ts` — keyboard-step/bounds assertions and responsive review captures.
- `docs/RELEASE_CHECKLIST.md` — close the pending numeric/slider keyboard browser-review item.
- `docs/STATUS.md` — record the accessibility gap and real-source verification.

## Component provenance

No new dependency. The project uses the local generated shadcn Base Nova Slider wrapper over pinned `@base-ui/react` 1.8.0 (MIT); the API used is Base UI's documented `Slider.Thumb getAriaLabel` prop.

## Verification

- `MEDFORGE_API_PORT=18082 npm run test:e2e -- tests/e2e/fistulaguard-authentic.spec.ts` — **1 passed** with actual `pat001` and `pat011` FiSaV records; no synthetic signal responses.
- Desktop (1440×900), tablet (768×1024), and phone (390×844) captures checked for document-level horizontal overflow. Captures are ignored, local review artifacts: [desktop](../../.local-review/FISTULAGUARD-SLIDER-KEYBOARD-QA/fisav-slider-desktop.png), [tablet](../../.local-review/FISTULAGUARD-SLIDER-KEYBOARD-QA/fisav-slider-tablet.png), [phone](../../.local-review/FISTULAGUARD-SLIDER-KEYBOARD-QA/fisav-slider-phone.png).
- The same E2E run verifies real source hashes, bounded 5/10/20-second windows, channel/time identity and persistence/reopen of the saved source comparison.
- `npm run lint`, `npm run typecheck`, `npm run test` (**44 tests / 13 files**) and `npm run build` — passed. The build retains the pre-existing large vtk.js chunk and React compiler directive warnings.
