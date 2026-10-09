# 05 — LOCK MATRIX: WHAT IS A DECISION AND WHAT STILL NEEDS TESTING

| Item | Status | Frozen rule / unlock evidence |
|---|---|---|
| Color identity | **LOCKED** | B Cobalt/Porcelain. Primary #3955E6, Porcelain #F3F5FA, medical viewport #101624, Academy #FFF8ED, Educator #F6F8FC. No unilateral recolor. |
| UX style | **LOCKED** | Viewer-first research tools, task-first Academy, canvas-first Educator, genuinely distinct role skins. |
| React framework | **LOCKED** | React19/Vite8/TS/Tailwind4/shadcn Base Nova/Base UI; preserve existing API/data stack. |
| Data science | **LOCKED** | No fabricated CT, surgery video, dose predictions, AVF diagnoses, clinical labels. Source provenance visible. |
| Existing scientific functions | **PRESERVE** | Dose 23 official metric checks on pt_201, source 1933 Endoscapes frames, 59 FiSaV recordings on owning local machine, learning auth and grade tests. |
| Fonts | **DESIGN LOCK / install trial** | Inter UI, Plus Jakarta Sans Academy headlines, IBM Plex Mono numeric; check licensed assets and performance before bundling. |
| shadcn/Base Nova, Recharts, uPlot, dnd-kit, Motion | **KEEP** | Already in source. Recompose, don't replace for no reason. |
| Trophy UI | **COMPONENT CHOICE LOCK; integration conditional** | Badge/Grid/Unlocked, Levels Timeline if real level data; component trial React19, opt-in server state and current backend. |
| React Flow UI | **TRIAL** | Only actual supported operation DAG, Vite/React and accessible fallback verified. Not required for Academy MVP. |
| Resizable panels | **TRIAL** | scientific mouse→source pixel/voxel mapping must remain exact. |
| Cornerstone3D | **TRIAL** | custom OpenKBP loader parity, correct orientation labels; existing Canvas fallback is acceptable. |
| Full OHIF | **REFERENCE ONLY** | do not install until genuine dataset semantics and clear ROI/dose integration path exist. |
| Video.js 10 | **GATED** | actual permitted continuous aligned video required. BBox201 frames are not video. |
| react-konva, ECharts | **OPTIONAL** | only if demonstrably improves function and passes parity/performance review. |
| Live CVS model | **GATED** | independent checkpoint provenance and permitted specific use rights; source says CUDA validation already performed, not live action available. |
| OpenKBP-Opt comparisons/solver | **GATED** | original archive malware warning and disk/rights; same-case compatible predictions, validated data and solver permissions. |
| FiSaV stenosis classifier | **GATED** | valid patient-disjoint labels, clinical limitations, independent evaluation; cannot use occlusion field as stenosis outcome. |
| Public hosting | **NOT LOCKED / BLOCKED** | general research-route authorization and data display rights missing. Local-only bound 127.0.0.1. |
| SVG illustration/character styles | **APPROVED AS DECORATION ONLY** | do not replace real evidence, mark examples as illustrative; don't imitate proprietary game imagery. |

## Phase cutline

- **Minimum useful product**: three working source-backed viewers, evidence runs/saves and reports, real Educator→Student loop on rights-cleared source, B skin, Academy vendor components for actually available state, flawless local demo interactions.
- **Next visible step**: spike+implement B shell + large real DoseTwin viewer; this is the fastest discriminator between a real redesign and another decorative homepage.
- **Then**: SurgiVision and FistulaGuard source-backed redesigned UIs, Academy/educator, model/experiments run UX.
- **Explicitly out of first release**: autonomous surgical advice, delivered clinical radiotherapy planning, diagnosing AVF stenosis, backend multiuser deployment or public leaderboards.

## Approval boundary

User chose Option B, *not* every future dependency or external-data permission. That choice authorizes a precise UI implementation **plan**. Do not push to `main`, publish data, bypass licenses or deploy publicly without explicit authorization. Technical trial results decide whether optional libraries are merged. If no real footage/assets exist, show genuine image-only workflow rather than a prettier false feature.
