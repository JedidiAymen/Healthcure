# 07 — Visual layout specimen, B selection, signoff criteria

The user has selected **B COBALT/PORCELAIN**. The HTML in `prototype/MEDFORGE_B_LAYOUT_SPEC.html` shows this locked palette with six navigation targets. It deliberately uses explicit empty **scientific content slots** rather than deceptive generated medical pictures or fake numerical curves.

The associated PNG previews were rendered from the HTML layout using a local Chromium build (not from the actual Healthcure application). Tabs were clicked, four screenshots captured, no page exceptions occurred and a 390px mobile Academy layout reported no page-level overflow. This validates **the spec mockup**, NOT a vendor component integration or application quality.

- `prototype/B_DoseTwin_1440.png`: color/system/workstation layout, blank source slots.
- `prototype/B_Academy_1440.png`: warm learning mode, vendor Trophy component placeholders.
- `prototype/B_Educator_1440.png`: structured lesson editing mode.
- `prototype/B_Academy_390.png`: single-column mobile Academy layout.

## Signoff before broad app migration

1. Show three ACTUAL application screenshots using verified vendor components and permitted real source: DoseTwin research case desktop, Academy home+mission mobile, Educator lesson builder desktop. **These are not the mockup.**
2. Review exact correct source masks, time selection, interactive panel resize, keyboard navigation, focus indication, chart values and protected learner answer projection.
3. If any screen still looks like a status/badge dashboard, rework hierarchy rather than tinkering with colors and shadows.
4. Review learner gamification states (no opt-in, no achievements, genuine achievement award) and check that illustrations never masquerade as clinical data.

## Non-blockers

- Cornerstone acceptance is not required if existing CT canvas becomes a large, source-correct and high-performance viewport.
- React Flow is not required until a real multi-stage runnable workflow is useful.
- Video.js is **not** required without lawful continuous surgical footage.
- No need to replace backend/SQL for a visual overhaul.

## Contrast quick-check

Design B's cobalt `#3955E6` on white calculates to ~5.81:1 text contrast; selected `#3552D7` on white ~6.29:1; muted `#667085` on white ~4.97:1. Coral `#FF806C` on white is only ~2.45:1, so it is **decorative only** on white; do not use it for body text, actionable icons without other cues or essential scientific encoding. Re-evaluate actual renderings with axe/manual review.
