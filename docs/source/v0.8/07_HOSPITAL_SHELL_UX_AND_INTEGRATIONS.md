# 07 — Hospital-inspired platform shell, accessibility, interoperability and UI architecture

**Status:** PROPOSED. A hospital-themed navigation metaphor is optional and **must not imply one real patient episode** spanning the three research datasets.

## Product direction

Select a *department-inspired research academy*, not a fictional hospital EHR. The shared spatial metaphor is three specialist labs:

- **Surgery Lab** (SurgiVision): endoscopic video, anatomy, segmentation, CVS and procedures.
- **Radiation Physics Lab** (DoseTwin): head-and-neck CT, structure masks, 3D dose, prediction comparisons, optimization research.
- **Vascular Acoustics Lab** (FistulaGuard): AV fistula signal recordings, sensor positions, spectral analysis, quality and ML research.

Each specialty has independent case ID spaces and origin information; never pair unrelated datasets as though collected from a single patient or integrated into a clinical care pathway. Cross-module navigation is allowed only at the tool/course/research pattern level.

## Three shell designs considered

| Candidate | Description | Recommendation |
|---|---|---|
| Flat dashboard | generic tiles; simplest | reject as primary; feels stitched together |
| 3D hospital map | interactive building navigation | P3 optional; scope/performance/accessibility risk |
| **Department atlas + case-first studio** | 2D research campus/department map cards and direct functional navigation | **RECOMMENDED** |

**Visual behavior:** homepage shows three department panels or stylized floorplan graphic, each with *one unique* scientific visual anchor. Selecting department animates a 150–250ms pane transition (motion reduction respected) into its real workspace. Users can directly navigate from sidebar and keyboard; no mandatory virtual walking/3D transition.

## Navigation specifications

`/` public landing (future marketing; no fake demo stats) -> `/choose` role/profile selector when permitted -> `/academy` or `/studio` or `/educator`.

Professional shell has persistent nav: Departments, Cases, Model Lab, Experiments, Reports. Current case and origin trail always visible. Student shell: Paths, Assignments, Progress and three labs. Educator shell: Evidence, Drafts, Assignments, Reviews, Analytics. Shared account profile but server-enforced role and feature scopes; not separate applications.

On switching mode, preserve case and scientific selection when authorized. Professional `Open as guided preview` performs role projection, never hides reference only with CSS. Student cannot toggle professional controls into their own task.

## Design tokens and UI rules

- Fonts: clear highly legible sans for primary app; monospace tabular numbers for science metrics. Never embed proprietary font in repo without licensed assets.
- Brand accents: controlled cool teal with neutral slate, not all-green medical imagery. Scientific scale colors are separate from brand colors, with continuous legends/units.
- High information density permitted in Professional Studio but must maintain accessible targets and readable labels.
- Student Academy uses small level indicators, concise missions, chapter cards, achievement disclosure; no aggressive dopamine dark patterns or countdown pressure.
- All charts show axis labels, units, data provenance, and distinguish missing data from zero.
- Role or hospital navigation must not ever hide safety limitations/research-only notice where medically important.
- On small mobile, direct students to device-compatible cases; precision 3D/medical annotation work remains desktop-targeted unless fully tested.

## Library choices and boundaries

| Purpose | RECOMMENDED | Not the job of this library |
|---|---|---|
| Shared UI | shadcn/ui + Tailwind + Lucide | clinical algorithms |
| Student XP/achievement presentation | Trophy UI / https://ui.trophy.so/docs | authoritative points ledger (our server) |
| Transition animation | Motion | faking clinical time-series activity |
| Scrollable educational card lists | existing React UI primitives | reconstructing a 3D hospital |
| Educator sortable linear blocks | dnd-kit | scientific plot pan/zoom or workspace panel positioning |
| Advanced future branches | React Flow / xyflow | publishing engine / secret grading |
| Scientific panels | React-Grid-Layout if persisted layouts actually needed | educator question sorting |
| Dose 3D | React Three Fiber mesh geometry | complete RT planning engine |
| Dose CT imaging | Simple OpenKBP preprocessed slice renderer initially; assess Cornerstone3D/OHIF for actual compatible medical format | assuming CSV OpenKBP is native DICOM |
| Acoustic | uPlot + SciPy backend; WaveSurfer only where audio waveform/playback fits source signal | claiming phone mic is clinical sensor |
| Education charts | shadcn/Recharts | plots of unverified scientific quantities |
| Health-content guidance | NHS design/content standards | adopting NHS branding or claiming approval |

**Avoid library pile-up:** installing a second chart library requires a concrete interaction unavailable in the current choice. Write rationale and bundle-cost estimate before adding Plotly to initial P0.

## Institution and healthcare integration roadmap

**MVP:** research-only application using dataset case identifiers, no EHR/patient accounts. Local role demo mode, server-validated grants.

**P2:** institutional course management and export, pseudonymous cohort, educator versioned publishing, assignment scoring and approved case access.

**P3:** LMS/SSO integration via LTI 1.3 / 1EdTech LTI Advantage:
- Deep Linking: share selected challenge within university LMS.
- Assignment and Grade Services: grade passback and comments when enabled by institution.
- Names and Role Provisioning: authorized roster identity mapping.
LTI requires complete OAuth/OIDC signatures, trust registration, appropriate session/deployment policy; don't simulate security-sensitive launch parameters.

**Future clinical/EHR integration only after independent need and validation:** assess FHIR/Medplum for actual authorized clinical data workflows. FHIR is unnecessary for current published research datasets and is not a shortcut to legal authority to store protected patient records. Do not add real patient upload or doctor diagnosis mode during hackathon.

## Content approval and safety

Research assets selected by an educator must have license/source checked; public teaching text authored by a domain expert and reviewed on an explicit cycle. Cite source and version of explanations. This follows the NHS health-content emphasis on clinical approval, source publisher identification, a review schedule, accessibility and user needs: https://service-manual.nhs.uk/content/standard-for-creating-health-content

## Scenario walkthrough: jury demonstration

1. Home shows 3 departments and the Student/Professional/Educator tabs; no claim that cases share one patient.
2. Educator opens DoseTwin case, authors 'Locate disagreement' from real prediction arrays, previews as student and publishes a local v1.
3. Student selects Radiation Lab, uses synchronized CT and DVH to answer and submits observation; reference overlay unlocks after submit.
4. Switch to Professional Studio, same case opens unrestricted evidence view with proper provenance, prediction statistics and research runs.
5. Cross to SurgiVision and FistulaGuard for independently functioning research-case interactions; show module-switch consistency.
6. Return to Educator analytics for one genuine submitted attempt with feedback. No pretending a patient diagnosis was made.

## Acceptance criteria

- All three modules reachable from all appropriate roles without full page reload and without losing case-scoped state.
- Screenreader/keyboard user can navigate departments directly without interaction with decorative map.
- No hallucinated hospital patient metrics, simulated EHR or false care pathway.
- Badge/xp UI absent from professional scientific tools.
- One published student challenge opens existing scientific viewer component with restricted capabilities.
- Institution export can later use signed, minimal grade payloads; outside MVP.

## References

- NHS Design System: https://service-manual.nhs.uk/design-system/index
- NHS content standard: https://service-manual.nhs.uk/content/standard-for-creating-health-content
- Medplum/FHIR clinical software examples (future only): https://www.medplum.com/docs
- 1EdTech LTI Advantage: https://www.1edtech.org/standards/lti/suggested-lti-advantage-requirements-rfps
- React Flow save/restore, future branching: https://reactflow.dev/examples/interaction/save-and-restore
