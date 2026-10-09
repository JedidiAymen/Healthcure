# MEDFORGE / HEALTHCURE — Luna XHigh AGENT GUARDRAILS

Read `00_SEND_TO_LUNA_XHIGH.md`, then `01_LOCKED_BRAND_TOKENS_AND_COMPONENTS.md`, `02_READY_MADE_COMPONENTS_AND_LIBRARY_GATES.md`, `03_EXACT_PAGE_BY_PAGE_REDIRECT.md`, `04_BRANCH_PLAN_TESTS_AND_NO_REGRESSION.md` and `05_LOCK_MATRIX_AND_RELEASE_CUTLINE.md` before proposing edits.

## Design lock

The user chose COBALT / PORCELAIN (Option B). No alternate primary color/themes; professional bright #F3F5FA with dark #101624 medical viewports, Academy warm #FFF8ED, Educator #F6F8FC; accent #3955E6. All roles must be distinct yet cohesive. Do not generate generic card dashboards.

## Build policy

- Component-first: inspect installed shadcn Base Nova components and relevant vetted vendor components before writing another primitive; do not bulk-install registries. Pin exact versions and verify license/compatibility.
- Scientific-first: source data unchanged, coordinate/timestamp integrity, model vs reference labels, displayed units and provenance. No fake CT heatmaps, medical videos, diagnostic claims or fabricated research charts.
- Keep data calculation code and lesson authorization/reveal workflows; cosmetic changes must not rewrite backend behavior.
- Treat audited git commit as baseline; re-check HEAD, use feature branch and small PRs. Do not push to main, publish source data or deploy publicly without permission.
- Every new vendor component needs a dedicated spike: real rendered output, source URL, version, license, keyboard, accessibility, bundle cost, source parity tests.
- For unavailable/gated model/media/solver features, show credible disabled states and precise blockers; never hide them with synthetic animation/results.
- Screenshot actual local Healthcure at 1440×900, 1280×800, 768×1024 and 390×844. If research data cannot legally appear in public CI, keep evidence private and provide redacted fixture snapshots.
- Report tests actually executed, not just commands from earlier status documents. Reject changes that lose verified capabilities or leak student answers.

## Minimum end-to-end acceptance

Source backed DoseTwin + SurgiVision + FistulaGuard views remain functional; real permitted analysis and source evidence save/reopen; educator creates, previews, publishes an authorized lesson; student investigates true evidence, submits and receives manual grading/debrief; role views follow B design; all old numerical/auth/test contracts hold.
