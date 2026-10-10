# PR-UX-23 — Model Lab case-specific validation

**Status: PASS for this UI slice; overall MEDFORGE release remains in progress.**

The method detail panel now calls the existing API validation route with the selected compatible, ready source case and registered operation. It renders the returned executable state and exact blockers beside that source identity. Catalog readiness stays separate from per-case validation; the page does not offer an execution action when a gate is blocked. The default case is selected from the model's specialty, preferring Endoscapes for CVS-AdaptNet. The shared source picker now keeps the selected case label visible while allowing search.

## Review evidence

- Actual loopback Healthcure screenshots, not committed because local research assets may have display restrictions:
  - 1440×900: `.local-review/UX-05-model-validation/model-lab-desktop.png`
  - 1280×800: `.local-review/UX-05-model-validation/model-lab-laptop.png`
  - 768×1024: `.local-review/UX-05-model-validation/model-lab-tablet.png`
  - 390×844: `.local-review/UX-05-model-validation/model-lab-phone.png`
- Each viewport had no document-level horizontal overflow. The running page emitted no browser console or JavaScript errors.
- The rendered live API response names the selected Endoscapes case and lists the actual missing worker, checkpoint/manifest, BioClinicalBERT assets and checkpoint-specific terms as blockers.
- Focused E2E uses explicit API response fixtures to verify the returned CVS-AdaptNet and OpenKBP blockers are rendered, and that each validation request carries the selected `case_id` and `operation_id`. These fixtures test transport/UI behavior only; they are not scientific validation.

## Files changed

- `src/pages/Pages.tsx` — source/operation selection and API-backed gate detail.
- `src/components/ResearchCasePicker.tsx` — show the selected source label in searchable mode.
- `tests/e2e/workspace-shell.spec.ts` — verify returned blockers and request identity.
- `docs/STATUS.md`, `docs/RELEASE_CHECKLIST.md`, this milestone record.

## Components, licenses and checks

- No new package or vendor component. Uses installed shadcn/Base Nova `Alert`, `Select`, `Field`, `Badge` and existing `ResearchCasePicker`/API client.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `MEDFORGE_API_PORT=18098 PLAYWRIGHT_BASE_URL=http://127.0.0.1:4174 npx playwright test tests/e2e/workspace-shell.spec.ts --grep 'model lab filters source-linked methods'` — 1 test passed.
- The full frontend/API suites and build were not rerun for this UI-only slice.

## Limits

The installed worker/checkpoint gate remains blocked on this machine. This change surfaces the current blocker accurately; it does not install weights, run inference or claim model results. Other Model Lab and Experiments requirements remain open.
