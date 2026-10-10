# UX-37 — Source-selected case registry

## Review scope

The registry previously navigated away as soon as a row was chosen. This change keeps the source list visible, selects a record in the URL, and shows a compact inspection view beside the list. It implements the handoff's requested searchable table, source type, selected-source preview and `Open analysis` action.

## Behavior

- Registry records are labeled by their real source type: SurgiVision **Frame**, DoseTwin **Case**, or FistulaGuard **Recording**. Dataset, source ID, registry ID and the API-provided ready/blocked state remain explicit.
- Selecting a row updates the `selected` query parameter and keeps the current search/page query. The selected source falls back to the first visible row when a filter or page makes the previous selection unavailable.
- The preview uses the existing source viewers: Endoscapes images, OpenKBP CT/reference-dose/ROI pixels, and measured FiSaV PZT1 samples. The image and signal are loaded from the local source API; the UI does not substitute illustrative output.
- Latest analysis action comes from the API's run list, which the backend orders by `created_at DESC, id DESC`. It is matched by the exact case ID; absent records say `No saved action`. The label says *analysis action* because the API does not expose other viewer interactions or saved local controls as an action history.
- `Open analysis` is disabled for API-marked blocked records. No model execution, analysis, student access, source files or calculation behavior changed.
- On phones, the selected-source preview appears before the paginated list and the table hides its separate last-action column, placing that text under the source title. At wider sizes the selection remains in a sticky side panel and the table has a dedicated last-action column.

## Components and dependencies

Composed existing checked-in shadcn Base Nova `Table`, `Card`, `Badge`, and `Button` components plus the already-used `SurgicalAtlasView`, `DoseAtlasView`, and `SignalAtlasView`. No component registry changes or dependencies were installed. No new vendor license or package is introduced; see [`library-spikes.md`](library-spikes.md) for the existing UI library inventory.

## Verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test` — 44 passed.
- `npm run build` — passed. Existing Vite output still reports the pre-existing large DoseTwin viewer chunk and React compiler directive notice; this feature adds no vendor bundle.
- Focused Playwright test `case registry keeps a source-selected inspection preview across screen sizes` — passed at 1440×900, 1280×800, 768×1024 and 390×844. It checks selected-source metadata, real-action presentation from a typed API fixture, no document overflow, row selection deep links and the analysis route.
- The local capture script reviewed all 13 app routes at the four required viewports (52 captures). The case-registry route returned HTTP 200 with no JavaScript errors or document overflow at all four sizes. Source-backed captures are local-only under ignored `.local-review/UX-37/`.
- In the live local app, selecting Endoscapes frame `endoscapes:test:162_6575` rendered its actual verified source image. Choosing the next frame updated the URL to `selected=endoscapes:test:162_7325`, the visible frame ID, and the image. The registry listed 1,994 installed source records; no local application database was modified.
- A broader parallel `workspace-shell.spec.ts` run was not clean: 12 of 15 passed at that point. Besides the initial version of this new test (subsequently fixed and passing alone), the pre-existing SurgiVision tablet-label assertion and DoseTwin comparison-tab assertion failed. The complete E2E file has not been re-run after those targeted fixes, so its overall result remains unverified.

## Screenshots

- `.local-review/UX-37/cases-1440x900.png`
- `.local-review/UX-37/cases-1280x800.png`
- `.local-review/UX-37/cases-768x1024.png`
- `.local-review/UX-37/cases-390x844.png`
- `.local-review/UX-37/report.json` (routes, viewport dimensions, HTTP response, document width, and page errors)

Screenshots contain local research images and remain ignored by Git. Rights approval for external display is unchanged; see [`RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md).

## Gate

**PASS for source selection, previews, run-derived last-analysis information, responsive layout and the focused route flow.** The full workspace E2E result and external data-display rights are still open.
