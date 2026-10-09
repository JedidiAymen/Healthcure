# 22 — Architecture lock gates — 2026-10-09

This checklist supersedes outdated status language in file 09. The v0.5 architecture is otherwise preserved. **NOT LOCKED**.

## Product architecture (safe to provisionally adopt)
| Decision | Recommendation | Status |
|---|---|---|
| Three independent research specialties | SurgiVision, DoseTwin, FistulaGuard | User-approved scope |
| One MEDFORGE monorepo and shared evidence/contracts | React+FastAPI, independent scientific workers | Proposed to lock |
| Three experiences | Student Academy, Professional Studio, Educator Case Builder | Proposed to lock |
| Scientific honesty | reference ≠ inference ≠ synthetic, per-asset license/provenance | Required |
| Hackathon demonstration priority | DoseTwin benchmark case first, Endoscapes labels second, vascular raw data only if verified | Proposed to lock |
| Model runtime | Isolated adapters; advanced training/solver after P0 scientific validation | Proposed to lock |
| Gamification | Trophy UI as display; grading on server, opt-in XP | Proposed to lock |
| Hospitals | Department Atlas instead of fake patient journey/3D hospital | Proposed to lock |
| Frontend charts | Recharts ordinary, uPlot dense waveforms, Cornerstone/Three only after spike | Proposed to lock |

## Evidence outcomes: why we cannot call it v1.0 final
| Gate | Status | Exact remaining action |
|---|---|---|
| License/ability to show Endoscapes sample | **OPEN** | full Endoscapes download, written dataset terms and reviewed jury scope |
| CVS-AdaptNet checkpoint and inference on laptop | **OPEN** | download/hash checkpoint, isolate pinned CUDA runtime, reproduce actual inference |
| Selected SurgLatentGraph model weights | **OPEN** | verify each checkpoint individually; cannot infer presence from model source code |
| OpenKBP true source files | **SOURCE VERIFIED** | pt_201 file tree and mask/spacing inspected |
| OpenKBP complete real numerical viewer | **OPEN** | download all pt_201 files on dev machine, run script & official metric comparison; visualize shape/axes |
| OpenKBP-Opt archive 10.19 GB | **OPEN** | transfer a verified patient/prediction subset or defer multi-model comparison |
| FiSaV raw recordings and rights | **BLOCKED** | find actual repository/DOI, license and sample channels; early paper HTML lacks dataset link |
| AVG backup sample | **OPEN** | download Figshare and verify file identities; don't label as AVF |
| React 19 + graphics and gamification libraries | **OPEN** | actual npm lockfile and browser smoke |
| Demo laptop GPU, disk & OS | **OPEN** | run capability inventory on user hardware |
| Scientific reviewer / educational accuracy review | **OPEN** | designate review and disclaimers; avoid unreviewed competency claims |

## Required artifacts before 'v1.0 LOCKED'
1. `DEMO_ASSETS.md` — three case manifests with access + legal status. If an original dataset blocked, explicitly approved fallback scope.
2. `TECH_LOCK.md` — tested pinned npm and Python envs, upstream commits, solver availability, GPU/CPU behavior.
3. `VALIDATION_REPORT.md` — source OpenKBP numeric metrics and axis screenshots, 1 Endoscapes label alignment, 1 real acoustic session if legal access.
4. `PARITY.md` — complete upstream capability taxonomy and status, no silent removal.
5. `MVP_SCOPE.md` — feature-by-feature must/should/future with actual user approval.
6. `RELEASE_CHECKLIST.md` — green status for at least one real end-to-end pathway and honest status for the others.

## Product trade-off we recommend rather than hiding
37 hours is not enough to reproduce every reference research network, optimize radiation treatment plans, validate new biomedical acoustic classifiers, and deliver a complete educational LMS. **Full feature preservation means leaving documented compatible adapter paths and source-backed capabilities intact**, while shipping a limited verified working subset. Scientific claims and UI availability must match what actually ran.

## Decision request when user is ready
Approve (a) research/education-only scope, (b) the modular architecture, (c) DoseTwin as the first proven numerical vertical slice, (d) no fabricated clinical results even if sources are blocked, and (e) staged deep model integration. Lock only after enough feasibility information is available to uphold the desired demo commitment.
