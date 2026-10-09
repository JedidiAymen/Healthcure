# 29 — MEDFORGE architecture-lock proposal (v0.7; NOT LOCKED)

## Stable recommendations
1. Three independent modules: SurgiVision, DoseTwin, FistulaGuard.
2. Research/education-only claims; no clinical certification, diagnosis, dose-plan prescription, or claimed same-patient combination.
3. Three distinct UX modes: Professional Studio, Student Academy, Educator Case Builder; shared scientific data and algorithms.
4. Modular monolith: Vite/React/TS/Tailwind/shadcn, FastAPI, scientific adapters/workers; SQLite/file assets for hackathon and PostgreSQL/object storage later.
5. Model Registry and scientific experiments share typed cases, artifacts, versioned run manifests; dynamic readiness; no dummy controls.
6. Case-focused specialist scientific viewers, centralized evidence provenance, server-graded lessons with hidden answers.
7. Strict upstream parity register, pinned commits, legal permissions, API compatibility and test gates; advanced functionality remains in planned adapters.
8. Use real licensed artifacts; typed source kind, data/units and uncertainty. No visual fake medical data in demonstration.
9. DoseTwin first numerical vertical slice; SurgiVision original Endoscapes labels second; FistulaGuard raw recording when available or legitimate clearly labeled fallback.
10. Public demo offline compatible; release status accurately distinguishes proof from planned features.

## Proposed stack — optional components require smoke tests
| Use | Choice | Constraints |
|---|---|---|
| Shell | React 19 + Vite + shadcn/ui + Tailwind | package/build browser test |
| Navigation, forms | Router + TanStack Query + React Hook Form + Zod | version-pinned and shared DTO source |
| Charts and dashboards | Recharts/shadcn Charts | research numbers only; accessibility |
| Dense signals | uPlot and WaveSurfer | real recording/units; avoid duplicate engines |
| Image and dose viewer | 2D canvas benchmark-grid first, optional Cornerstone3D after smoke | OpenKBP isn't native DICOM; avoid invented orientation |
| Selectable 3D organs | R3F/Three.js optional | geometry and performance validation |
| Educator builder | dnd-kit; React Flow deferred | keyboard fallback, answer-safe serialization |
| Gamification display | Trophy UI optional | server XP ledger, no paid backend dependency |
| API/model runners | FastAPI + SciPy/NumPy, separate pinned model environments | dynamic readiness, blocked operations disabled |
| Data | SQLite + local assets for demo | provenance and source permissions; scale later |

## Blocking decisions, exact resolution
| Decision | Current assessment | User/Luna action |
|---|---|---|
| DoseTwin original source real test | source tree checked, no full download in this environment | run loader + official numeric comparison on laptop |
| Endoscapes display permission and frames | source/license read; data not downloaded locally | acquire sample + approve display/license |
| Surgical weights GPU execution | untested, external links | validate on hardware; keep optional |
| FiSaV raw signals | unresolved | verify raw link+license, or approved alternative accurately labeled |
| 2026 AVF feature spreadsheet | documented, but not original sound data | verify spreadsheet and use for feature-explorer-only fallback |
| Frontend compatibility | documentation only | run pnpm install and browser smoke |
| User priority under 37h | lean vertical slice recommended | user explicitly approves MVP vs long-term parity |

## Lock criteria
Only sign `ARCHITECTURE_LOCKED_v1.0.md` when: (a) user agrees product boundaries and release cutline, (b) source/legal manifests exist, (c) complete first vertical slice technically demonstrated, (d) backend/frontend contracts and dependency stack tested, (e) partials/blockers clearly reported, (f) Luna has no ambiguity between R&D integration and hackathon deliverable.

Do NOT mistake drafting these files as approval or successful installation. The user can approve stable product architecture before all scientific runtime gates are green; in that case label `PRODUCT_ARCHITECTURE_FROZEN` while `MVP_EXECUTION_READY` remains conditional.
