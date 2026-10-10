# UX-43: Educator lesson order persistence

## Scope

Add a real-source browser regression for the Educator Studio lesson builder. The flow creates a disposable lesson using installed FiSaV `pat021`, reorders the blocks with the keyboard-accessible move control and pointer drag, saves through the local FastAPI API, reloads and reopens the server draft, and checks the learner publication preview.

The draft contains two learner blocks and one educator-only Reveal block. The saved draft preserves all three in order. The learner preview preserves the order of the two learner blocks and omits both the Reveal and educator rubric. It does not publish the draft or present the data as a learner outcome.

## Files changed

- `tests/e2e/educator-draft-order-persistence.spec.ts` — source-backed browser regression and responsive captures.
- `docs/PROGRESS.md` — current follow-up status and evidence.
- `docs/STATUS.md` — current working state.
- `docs/ui/PR-UX-43-educator-order-persistence.md` — this record.

## Captures

Captured from the running local application after reopening the saved draft:

- `.local-review/UX-43-educator-order/educator-draft-desktop.png` — 1440×900
- `.local-review/UX-43-educator-order/educator-draft-tablet.png` — 768×1024
- `.local-review/UX-43-educator-order/educator-draft-phone.png` — 390×844

The screenshots are local review evidence and are not committed. Each viewport checks that the document has no horizontal overflow.

## Components and dependencies

No product dependencies or component sources changed. The existing generated shadcn Base Nova editor and `@dnd-kit/core` 6.3.1 / `@dnd-kit/sortable` 10.0.0 controls are exercised as shipped. Their upstream licenses remain MIT.

## Verification

Run the source test with a local API, installed FiSaV data, and educator credentials in a disposable profile:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:<web-port> \
MEDFORGE_E2E_RESEARCH_USERNAME=<local-educator> \
MEDFORGE_E2E_RESEARCH_PASSWORD=<local-password> \
npm run test:e2e -- tests/e2e/educator-draft-order-persistence.spec.ts
```

Verified on 2026-10-10: 1 browser test passed against the local application and API. It created and saved a draft, reloaded and reopened it, checked the publication preview response and UI, verified educator-only content was omitted, and captured all three sizes. The test is marked `@source` because it needs installed source data and a provisioned educator account; ordinary CI excludes source-backed tests unless it provisions both.

## Boundaries

The selected FiSaV source may allow draft creation while independently restricting publication. This check stops at the learner-safe preview; it does not bypass source review, publish the lesson, or treat source material as clinical guidance.
