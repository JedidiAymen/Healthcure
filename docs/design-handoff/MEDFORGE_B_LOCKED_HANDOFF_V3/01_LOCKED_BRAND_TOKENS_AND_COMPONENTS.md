# 01 — LOCKED DESIGN SYSTEM: COBALT / PORCELAIN

## A. Design identity (approved by user)

A premium, bright, software-tool-oriented platform with high legibility. Think scientific editor, not consumer patient portal or generic SaaS dashboard. **Use Porcelain exterior + dark viewport island, not universal dark mode.** Academy is warm and tactile, but medically serious. Educator is a whitespace-forward editor.

### Global primitives

| Token | Exact value | Semantics |
|---|---|---|
| `--brand-primary` | `#3955E6` | logo/brand emphasis, selected CTAs |
| `--brand-primary-active` | `#3552D7` | selected nav/tool state |
| `--brand-primary-hover` | `#2D45C1` | button hover (ensure AA contrast) |
| `--brand-focus` | `#8498FF` | visible keyboard focus ring |
| `--brand-coral` | `#FF806C` | rewards, non-clinical small visual accent |
| `--brand-gold` | `#F3C961` | gamification earned rewards, not warning or scientific values |
| `--success` | `#187D5B` | operation succeeded only when verified |
| `--warning` | `#9C5E16` | warnings, source restrictions |
| `--danger` | `#C53947` | destructive/error state |
| `--info` | `#3955E6` | nonclinical informational status |
| `--font-body` | `Inter` | controls, navigation and scientific text |
| `--font-academy-display` | `Plus Jakarta Sans` | Academy headlines, chapter labels only |
| `--font-measurement` | `IBM Plex Mono` | scientific numeric outputs, trace labels, source short IDs |

### Professional (`data-workspace="professional"`)

| Role | Value |
|---|---|
| canvas/background | `#F3F5FA` |
| paper/card/toolbar | `#FFFFFF` |
| sidebar / section well | `#F8FAFD` |
| foreground | `#161C2E` |
| secondary label | `#667085` |
| subtle muted | `#8993A5` |
| border | `#E0E5F0` |
| viewer outer | `#101624` |
| viewer inside panel | `#171F30` |
| viewer chrome text | `#E9EEF7` |
| viewer chrome border | `#34415C` |
| accent | `#3552D7` |

### Academy (`data-workspace="academy"`)

| Role | Value |
|---|---|
| base | `#FFF8ED` |
| card | `#FFFFFF` |
| section tint | `#F4EDE2` |
| heading/text | `#1D2740` |
| muted | `#626D7F` |
| primary | `#3552D7` |
| coral reward accent | `#FF806C` |
| gold rewards | `#F3C961` |
| soft cyan mission track | `#DFF4F8` |
| outline | `#E8DED2` |
| unlocked completion | `#187D5B` |

### Educator (`data-workspace="educator"`)

| Role | Value |
|---|---|
| base | `#F6F8FC` |
| white canvas | `#FFFFFF` |
| subdued section | `#EDF1F8` |
| text | `#1D2740` |
| muted | `#667085` |
| border | `#E0E5F0` |
| selected/CTA | `#3552D7` |
| preview background | `#F3F5FA` |

### Scientific charts: independent palette system

Note: coral `#FF806C` on white has insufficient contrast for ordinary text; use it for large decorative accents only, never standalone small text or status labels. Brand cobalt `#3955E6` on white has approximately 5.81:1 contrast in our direct WCAG calculation. Brand colors never replace calibrated/numerical encodings. Use familiar perceptually ordered sequential maps for dose values with visible Gy scale; robust diverging maps for *signed real differences* only; stable categorical colors+labels for COCO class overlays; waveforms have channel-stable colors and text/line-style differentiation. Every plot must display axes, units or 'unit unknown', source ID/method, and an accessible values table. No red/green alone, no glowing fake heatmaps, no arbitrary chart curves.

## B. Typography, rhythm, layout (locked)

- Main product logo wordmark: `MEDFORGE` typeset; mark optional but do not generate a fake healthcare seal. Professional title 26–30px, section title 18–22px, controls 13–14px, supportive text 13px, scientific values 14–24px tabular. Academy hero display 34–44px desktop / 28px phone. Educator title 27–30px.
- Sidebar body must remain >=13px; scientific annotations >=12px on desktop, use tooltip for small labels. Source hashes truncated with copy affordance and inspect full in provenance drawer, never hidden completely.
- Spacing unit 4px; step scale 4/8/12/16/20/24/32/40. Rounded 10px inputs, 12px normal panels, 16px feature tiles, 20px Academy journey tiles. Scientific canvas corners 8px to maximize area. No fake elevation/shadows around every item.
- Dense professional page is not a thousand badges: show max 2 context badges in main header; place detailed model/source terms in right inspector. Neutral thin dividers, one main CTA per page.
- Motion: 120–180ms hover/dialog, 180–250ms panel, subtle 250–350ms XP completion if user opted in. `prefers-reduced-motion` disables decorative transitions. Scientific measurements and charts should not animate on load.
- Interactive target >=44×44px Academy/editor, >=40×40px professional toolbar; keyboard, labeled icon buttons, visible focus.
- Contrast: WCAG AA target for text and meaningful icons; verify selected blue on white/cream in browser; do not trust swatch appearance alone.

## C. Layout geometry (target desktop 1440×900, not absolute fixed widths)

**Professional shell:** 60px topbar, 224px collapsible app rail (not two competing sidebars), 8–16px gutters, context left case navigator ~208px when needed, right inspector ~304px collapsible and resizeable; bottom analysis dock ~228px or right tab where desktop viewport space is insufficient. Main source viewer stays the largest coherent region (>=55% of *usable workspace* with left navigator collapsed; full-focus control). Do NOT add four always-open columns if width cannot accommodate >=500px main viewport.

**DoseTwin focus layout:** main plane min(100%, ~650px) inside an image viewport; two secondary planes can be in an alternate tab or small strip. Click/drag coordinates must reflect rendered extent and source voxel indices. Avoid stretching source CT so pixels distort or become unlabelled anatomy views.

**SurgiVision:** native 854×480 image fit/contain within viewport, controls outside evidence area, no overlays clipped by CSS zoom; source navigator as drawer on tablet. Use source pixel mapping invariants.

**FistulaGuard:** uPlot waveform full central width; vertically stack PSD/spectrogram and selected source-window comparisons. Exact time selection and sample rate always readable.

**Academy:** 1024–1180px max-width comfortable content (not 3 narrow cards); hero + `Next mission` + visible source-backed paths and achievements. Desktop: journey / XP panel; mobile: 1-column vertical track. Any Trophy UI component only when corresponding authorized server data exists.

**Educator:** at >=1280px, block library ~208px / center editor flexible >=580px / preview+rubric ~300px. At tablet, two-pane with inspector drawer; at phone single pane with bottom navigation between Blocks/Canvas/Preview, no floating tiny three-pane.

## D. Component taxonomy

Base `AppShell`, `RoleSurface`, `CaseNavigator`, `ViewerShell`, `ViewportToolbar`, `ResizableInspector`, `AnalysisDock`, `ScientificMetric`, `SourceProvenanceDrawer`, `ChartWithValuesTable`, `ModelOperationState`, `CurrentMissionCTA`, `AcademyPath`, `RewardSurface`, `LessonBlockEditor`, `LearnerPreview`, `AnswerRevealGate`. Compose using Base UI/shadcn + chosen libraries; do NOT hand-code yet another parallel Button/Card/Modal component library.

### Mandatory anti-slop rule

A page passes only if the largest visual object is **the current task**: CT image for DoseTwin, surgical image for SurgiVision, waveform for FistulaGuard, next activity / skill path for Academy, editable lesson blocks for Educator, real run status/results for Model Lab. Descriptive cards, vendor logos, badges and legal notices cannot occupy more prominent real estate than the core task.
