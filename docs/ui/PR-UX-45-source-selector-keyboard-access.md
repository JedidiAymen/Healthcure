# UX-45 — Keyboard access for installed source selectors

**Status: Verified.** Adds browser evidence for the shared selectors against locally installed source records; this change is test and documentation only.

## Coverage

- Opens global case search on a real FiSaV route, confirms Escape closes it and returns focus to the trigger without changing the route, then selects another installed FiSaV record with ArrowDown and Enter.
- On the FiSaV viewer, verifies Escape cancels an uncommitted query and leaves the current record selected, then commits another recording with the keyboard.
- On the SurgiVision annotated-stills mode, selects installed Endoscapes frame `163_52925` with the keyboard, then verifies Escape cancels a second frame query without changing the selected route.
- In the Educator lesson source picker, selects installed Endoscapes frame `162_6575`, then verifies Escape cancels a different query while preserving the selected source.

## Verification

- `npm run test:e2e -- tests/e2e/source-selectors-keyboard.spec.ts` — **1 passed** against the running local app and disposable source profile (`.local-review/UX-42-profile`). The profile credentials are read from its ignored seed log and are not printed or committed.
- The test reuses installed FiSaV recordings and Endoscapes frame records. It adds no fixture source records and changes no application behavior.
- This is interaction coverage, not a browser chrome zoom capture. The real-source responsive selector captures remain under ignored `.local-review/FIX-01/current-real-app/`.
- Follow-up genuine Chrome page zoom evidence is recorded in [`PR-FIX-01`](PR-FIX-01-global-selectors.md): Chrome Settings → Appearance → Page zoom was set to 200% in a temporary isolated profile, then the actual app and installed long SurgiVision `tr` result set were inspected at effective CSS widths of 720, 768, and 390px. This was Chrome's page zoom setting, not device-scale or CSS zoom emulation. The menu stayed opaque and in-bounds, retained its 12-option cap and 1,212 total-match count, and had no horizontal page overflow. Desktop/tablet/mobile screenshots are under ignored `.local-review/FIX-01/`.
