# MEDFORGE v0.5 — UX ADRs, Options, and Decisions Pending Lock

**None of these UX decisions are approved as irreversible yet.** The three scientific modules and their original-capability preservation remain locked goals. UX details are recommended choices to evaluate with the team and Luna only after the architecture lock.

| ADR | Recommendation | Why | Alternative/trigger to reconsider | Status |
|---|---|---|---|---|
| UX-01 | One global MEDFORGE shell; different mode presets | Consistency and deep link continuity | Different institution brand only after product split | RECOMMENDED |
| UX-02 | Specialty-first Professional, case-first inside specialty | Experts know domain; library still available | General laboratory case-first if users repeatedly switch tasks | RECOMMENDED |
| UX-03 | Professional center viewer priority + inspector + bottom dock | Avoid chart overload and cropped medical evidence | User testing of 1366x768 may prompt simplified dock | RECOMMENDED |
| UX-04 | Dark/neutral research canvas, lighter admin/educator optional | Contrast and scientific focus | User preference/accessibility testing | RECOMMENDED |
| UX-05 | Academy wraps real viewer in mission UI | Preserves scientific truth and reuse | No alternatives that alter measured evidence | RECOMMENDED |
| UX-06 | Department Atlas 2D lightweight, optional | Cohesive exploration; no fake linked patient | Remove if distracting or timing not sufficient | RECOMMENDED |
| UX-07 | No global cross-specialty clinical patient record | Independent cohorts/procedures | Only reconsider with ethically obtained matched data and validation | ESSENTIAL SAFETY BOUNDARY |
| UX-08 | Recharts for common charts; uPlot for dense acoustic data | Simpler and fast appropriately | Proven plotting performance benchmark dictates change | RECOMMENDED |
| UX-09 | Cornerstone3D only if OpenKBP geometry adapter verified | Avoid time sunk into DICOM-conversion assumptions | Custom verified 2D array canvas for MVP | EVALUATE |
| UX-10 | RGL v2 for movable professional panels | Serializable layouts; TS support | CSS grid only for MVP if resizable panel overhead | OPTIONAL ADVANCED |
| UX-11 | dnd-kit with keyboard control in educator | Native reorder semantics | Simpler buttons if authoring scope MVP | RECOMMENDED |
| UX-12 | Trophy UI optional component subset | Reusable Academy reward visuals | Custom simple bars in MVP if install incompatible | RECOMMENDED |
| UX-13 | Source + origin legend always visible | Prevent medical AI/source confusion | None | ESSENTIAL SCIENCE BOUNDARY |
| UX-14 | Student submitted assessment before reference revealed | Limit answer leakage and overreliance | Explicit instructor 'practice mode' might permit early reveal; must be visible | RECOMMENDED |
| UX-15 | Desktop-first advanced science, mobile-first Academy | Device constraints | Improve with real device tests, no silent unsupported gestures | RECOMMENDED |

## Suggested visual design review protocol

Use 3 side-by-side flows under same tokens: (1) Student surgical evidence mission; (2) Research DoseTwin CT/dose comparison; (3) Educator case authoring and preview. Evaluate first 30 seconds for task clarity, time to open correct case, legend visibility, keyboard-only completion, hover-vs-click confusion, screen density, and ability to identify source of each result. Participants must not infer treatment recommendations from demo.

## Source/revision notes

Current recommended library links: shadcn https://ui.shadcn.com/ ; Trophy canonical https://github.com/trophyso/ui ; Cornerstone https://www.cornerstonejs.org/ ; uPlot https://github.com/leeoniya/uPlot ; WaveSurfer https://wavesurfer.xyz/ ; React Grid Layout https://github.com/react-grid-layout/react-grid-layout ; dnd-kit https://dndkit.com/ ; NHS patterns https://service-manual.nhs.uk/design-system/index ; WCAG https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ . Sources researched online, packages not installed or benchmarked in MEDFORGE.
