# MEDFORGE v0.5 — Visual System and Component-to-Feature Mapping

**Status:** RECOMMENDED (not locked). Frontend: React + Vite + TypeScript + Tailwind v4 + shadcn/ui. Prefer native accessible primitives and tested open-source components to bespoke reproductions.

## Visual language

**Clinical/research modes:** restrained, precise, spatially consistent, no playful status effects. **Academy:** lively guided navigation and appropriate achievements around exactly the same scientific evidence rendering. **Educator:** document-builder rhythm and explicit source controls. The product brand uses abstract scientific geometry and clear typography, not borrowed institutional logos or fake hospital certification.

## Initial design-token proposal (do not confuse UI colors with medical scales)

| Semantic token | Dark | Light | Purpose |
|---|---|---|---|
| `--app-bg` | `#0B1422` | `#F6F8FA` | Shell |
| `--surface` | `#142334` | `#FFFFFF` | Main panels |
| `--surface-subtle` | `#1B2D40` | `#EDF2F5` | Controls/sidebar |
| `--text-primary` | `#F1F5F9` | `#152433` | Headings and data |
| `--text-secondary` | `#A9BAC7` | `#526476` | Supporting text |
| `--line` | `#314459` | `#DBE3E8` | Borders |
| `--accent` | `#0D9488` | `#0F766E` | Active / primary action |
| `--focus` | `#5EEAD4` | `#0F766E` | Strong keyboard focus |
| `--warning-ui` | `#E7B557` | `#9A6700` | General software warnings only |

Suggested type: Inter or system sans, tabular-nums for measured values; JetBrains Mono / ui-monospace for code, scientific IDs, logs. **Scientific scales are separately sourced and documented**: segmentation class palette, colorblind-aware dose ramp with Gy legend, comparative error ramp with 0/positive/negative semantics, physiological channel accents with labels. Never rely on green/red alone to distinguish diagnosis or correctness.

## Layout metrics

- Desktop design target: 1440x900; verify **1366x768** first (jury laptop likely small). Global header 56px, primary sidebar expanded 240px/collapsed 60px, contextual inspector 280–340px, scientific dock 180–260px; all user-resizable within minimum viewer constraints. Use `minmax` with real overflow tests, not fixed widths summed beyond viewport.
- Tablet 768–1023px: rail navigation, one viewer, inspector as accessible drawer, scientific dock tabbed. No forced 2x2 CT + charts.
- Phone <=767px: full Academy mission + selected images/audio if fit; professional offers case browsing and constrained review; advanced volumetric editing/optimization marked desktop required (no misleading broken drag UI).
- Top-of-viewport context: case, source and model availability. Persistent scientific legend visible when meaningful. Avoid auto-updating charts if doing so moves the cursor during review.

## Typography and spacing

4/8px base spacing; headings 24–32 for product landing, 18–22 for major page, 13–16 for inspector sections; measured numbers 13–18 tabular; scientific axis labels >=11 where practical, with text equivalents available. Respect OS font scaling. Long case titles and file names wrap or truncate with tooltip; do not shrink essential scientific data to 8px just to fit.

## Component map

| MEDFORGE component | Library | Requirement |
|---|---|---|
| Shell/sidebar/command dialog/field controls | shadcn/ui (Radix or selected compatible foundation) | Keyboard, focus, aria labels, validated forms |
| Academy achievements, XP chart, optional streak | Trophy UI canonical `https://github.com/trophyso/ui` | Selectively import only used components; values from backend |
| Simple Academy / Model Lab / cohort charts | Recharts via shadcn Chart | Real data, axes/units/tooltips, sufficient dimensions |
| Scientific audio waveform plots | uPlot | Dense time series, deterministic cursor sync and decimation |
| Acoustic player / selected regions | WaveSurfer.js | Only legitimate audio tracks; synchronized with signal intervals |
| 3D anatomy models | React Three Fiber / Three.js | Derive from validated coordinates; selectable masks, camera controls |
| 2D CT/volume views | Cornerstone3D OR custom array renderer, choose after data spike | Verified ijk->view transform; reuse volume tools when compatible |
| Draggable/resizable research panels | React-Grid-Layout v2 | Explicit drag handles and resize constraints; keyboard presets |
| Sortable educator blocks | dnd-kit current API | Pointer & keyboard reorder; non-drag move up/down fallback |
| Academy/educator transitions | Motion | Short, optional, respect prefers-reduced-motion |
| Icons | lucide-react | Consistent outline stroke and accessible labels |
| Numeric input & schema forms | React Hook Form + Zod if adopted in spike | Validate tool-specific limits both client+server |
| Data fetching/cache | TanStack Query | Case-scoped keys; stale-state warnings; cancel on navigation |
| Ephemeral linked viewer state | Zustand or context selector, module-local | Avoid persist cross-module clinical state |

See official sources: https://ui.shadcn.com/docs/components/base/chart ; https://ui.trophy.so/docs ; https://github.com/react-grid-layout/react-grid-layout ; https://dndkit.com/react/guides/sensors/ ; https://www.cornerstonejs.org/docs/getting-started/overview/ ; https://github.com/leeoniya/uPlot ; https://github.com/katspaugh/wavesurfer.js . Confirm active npm versions and run a Vite/React spike before installing everything.

## Four shared UX primitives to implement first

**EvidenceBadge** (`reference_annotation`, `archived_prediction`, `live_model_inference`, `computed_metric`, `teaching_simulation`): always visible beside result. `CapabilityState` (`ready`, `requires_weights`, `requires_dataset`, `incompatible_runtime`, `restricted`, `unverified`, `failed`) with truthful tooltip/recovery guidance. `ScientificLegend` unit, full min/max, color semantics, source. `InspectionLink` navigates to exact source coordinates (video/frame + bbox; volume voxel/ROI; signal channel/time interval).

## Professional workspace composition

In a 1366px viewport, prefer a rail + main viewer + narrower inspector; open scientific dock on demand; do not insist on four concurrent columns. Use preset tabs `Focus | Compare | Analyze | Research`, resizable panel layout as enhancement. Evidence appears before statistics. Every numeric chart has an inspectable table/CSV path. A chart loading state must not be identical to a real 0 value.

## Academy polish rules

Create excitement in mission wrapper rather than scientific canvas: mission cover, objective chips, progress, optional XP burst, illustration/department icon, debrief cards. Avoid time-pressure, shame-based scoring, streak loss, gambling-like rewards, or a public leaderboard by default. Score evidence reasoning and justified uncertainty, not disease diagnosis or clinical certainty.

## Healthcare-specific visual QA

Check minimum text legibility, focus visibility, screen-reader name, contrast, keyboard navigation, zoom 200%, no motion-only instruction, non-color redundancy, and clear distinction between education/research and patient care. Reference WCAG 2.2 AA criteria and NHS design principles, not unverified compliance claims.
