# Flagship decision: FistulaGuard, DoseTwin or SurgiVision

**Status:** decided 2026-10-10, then updated the same day: the flagship is DoseTwin, following the teammate proposal (see "Decision update" at the end).
**Date:** 2026-10-10.
**Inputs:** the cahier des charges (source of truth), `docs/HACKCURE_COMPLIANCE.md` (including the reconciliation section), the teammate review of commit `d91632b`, and the FiSaV label fact check.

**Scale:** each criterion is scored 1 (poor) to 5 (strong). Scores are our editorial judgement from the evidence listed, not measurements. Hours are engineering estimates. Statements marked *assumption* must be checked.

## Scores

| Criterion | FistulaGuard (FiSaV) | DoseTwin (OpenKBP) | SurgiVision (Endoscapes, Appendix300, CholecT50) |
|---|---|---|---|
| (a) Can we show it legally, in public or in Docker? | **5.** FiSaV is CC BY 4.0 (README and OSF licence), so public display is allowed with attribution. Docker locally: yes. | **2.** OpenKBP has no dataset licence (personal hackathon use only, per `docs/BLOCKERS.md`). Docker on our own laptop: yes. Public or hosted: no, it needs a labelled synthetic phantom. | **3.** Endoscapes is CC BY-NC-SA 4.0: a non-commercial local demo with attribution is fine, but public hosting is doubtful. Appendix300 is CC BY 4.0. The CholecT50 licence is not verified on this machine. |
| (b) Defensible AI or evidence story with confidence and explanation | **3, with risk.** It would be our own in-app model: a linear model on 9 unit-free features with out-of-fold confidence and per-feature explanation, under a frozen protocol (`docs/FISAV_EVALUATION_PROTOCOL.md`). But n=59, the label criterion is undocumented, and the result is unknown (not yet run). The rule-based signal tools (filters, beats, occlusion marker) are strongly explainable. | **3.** Strongest rigour evidence: the official evaluator cross-check (23 metrics, maximum difference 7.647e-06 Gy), plus reference vs archived prediction with ROI differences and DVHs. But the prediction is **archived, not our inference**, and carries no model confidence. Explanation is good; the "AI" claim is weak. | **2.** Expert annotations, annotator disagreement and the CVS self-check are strong teaching evidence. There's no running AI: CVS-AdaptNet is gated. |
| (c) Realistic route to a domain expert reviewer | **3.** The dataset authors are reachable (contact emails in the README). Nephrologists and dialysis nurses are plausible locally (*assumption*). | **2.** Needs a radiation oncologist or medical physicist, and there are few radiotherapy centres (*assumption*). | **3.** Surgical residents and surgeons are relatively accessible (*assumption*). |
| (d) Fit with a cahier section 1 problem | **5.** ALD follow-up (hemodialysis vascular access), peripheral centres and medical deserts, and degraded networks (Track 2). | **2.** Not among the section 1 problems. The nearest analogue is "sécurisation des prescriptions" (dose plan review), which is a stretch. | **2.** Surgical safety training (bile duct injury) is not among the section 1 problems. |
| (e) Hours to make it compliant as a flagship | About 16 to 20: run the evaluation, the risk panel, consultative review, signal-quality abstention, the FHIR RiskAssessment and the clinical story | About 12 to 16: consultative review, auditable report export, provenance badges, plus a synthetic phantom for anything shown outside the laptop (about 4 to 6 of those) | About 12 to 16, **after** the Endoscapes download finishes (several hours left), plus verifying the CholecT50 licence |
| **Total (a+b+c+d)** | **16** | **9** | **10** |

## Recommendation

**Flagship: FistulaGuard**, framed as "missed AV fistula stenosis in hemodialysis patients: training plus a consultative assistive index". Track 2 primary, with a Track 3 module. This stays conditional on the two FiSaV risks below.

**DoseTwin stays a first-class supporting module** in every scenario. It is our rigour showcase:
- the official evaluator cross-check;
- reference vs archived prediction views, badged ARCHIVED PREDICTION (not our inference);
- the shared consultative review component, with an auditable exported report.

It runs in Docker with read-only OpenKBP mounts. On a hosted instance it shows its normal "requires setup" state. OpenKBP lessons stay unpublishable, with the reason shown.

**SurgiVision stays a supporting teaching module** (CVS self-check, annotator disagreement, frame compare). It is not the flagship.

### Why not DoseTwin as flagship (the teammate's preference)

The teammate is right that DoseTwin is today the most complete end-to-end scientific demo. But it scores lowest on legal display and on section 1 fit, and its AI is archived output we did not produce. Under the cahier's section 6, a jury will ask "what does your model infer, and how confident is it?". DoseTwin's honest answer is "nothing of ours; we compare a published archived prediction". That is excellent rigour, but weak Track 3 positioning.

## Main risks and fallbacks

1. **FiSaV label criterion undocumented.** Mitigation: label it as "stenosis presence as recorded in the dataset sheet (criterion not documented)" and contact the dataset authors. If a clinician says the label is unusable, drop the model and keep FistulaGuard as Track 2 training with the rule-based signal-quality index.
2. **FiSaV evaluation weak** (AUROC CI includes 0.5, or permutation p of at least 0.05). Mitigation, pre-registered: present it as "not shown to be better than chance; used to teach evaluation". Track 3 then rests on the transparent rule-based methods and on honest evaluation, not on a working detector. Track 2 becomes the primary claim.
3. **Small cohort, single centre.** Always show the CI, the baselines and the limits. Never present predictions for recordings outside the 59 as out-of-fold estimates.
4. **Team explainability (section 6 quality warning).** The FiSaV pipeline is small enough to explain fully: Welch PSD, band ratios, R peaks, logistic regression.
5. **Upstream churn.** The collaborator is actively changing SurgiVision and DoseTwin, so shared files need coordinated merges.

## What we would show in each case

| Case | Show |
|---|---|
| FistulaGuard flagship (recommended) | Illustrative case vignette, then a real CC BY recording. Then beats, filters and the occlusion-test marker as a protocol event, then the signal-quality index. Then the consultative risk index with out-of-fold probability, spread, cohort AUROC CI, feature contributions in plain words and the bias panel. Then educator review in 3 steps, the audit entry, and FHIR export. Then the training loop with offline submit. DoseTwin follows as the rigour module. |
| DoseTwin flagship | Local Docker only. OpenKBP `pt_201` slices, DVH and official cross-check. Then `pt_241` reference vs archived prediction (badged ARCHIVED PREDICTION), ROI difference, consultative review and auditable report. A hosted URL shows a labelled synthetic phantom. |
| SurgiVision flagship | Only after Endoscapes is installed. Frame browser with disagreement filter, compare, CVS self-check lesson, educator review. Clearly no AI. |

## Decision needed

Approve one of:
1. **FistulaGuard flagship with DoseTwin and SurgiVision supporting** (recommended).
2. **DoseTwin flagship** (teammate preference).
3. **Defer** until the FiSaV evaluation result and the label-criterion answer are in. The evaluation can run now, since the protocol is frozen at v1.1. Results would be reported before any UI work.

## Decision (2026-10-10, recorded from the product owner)

- **Flagship:** FistulaGuard is the capstone of one curriculum, "Safe use of clinical evidence and AI", for care teams. The three modules are linked educationally, never through a combined patient story, because the datasets come from unrelated people.
  1. **SurgiVision, "How reliable is the reference?"** Annotator disagreement and the CVS self-check: a reference standard is not ground truth.
  2. **DoseTwin, "How do you judge a model's output against a reference?"** Reference vs archived prediction (badged ARCHIVED PREDICTION, not our inference), the official evaluator cross-check, and a consultative accept or reject for further expert review.
  3. **FistulaGuard, "Using a consultative index in practice."** Measured signals, the signal-quality check, the consultative risk index with confidence and explanation, and the clinician's decision, which is logged.
- **All three modules stay fully usable on their own** (Professional Studio, Educator, Academy). The learning path links them; it does not replace them.
- **Deployment:** local only, on the demo PC in Docker. There is no public or hosted site. OpenKBP and Endoscapes are shown only on this machine, under their terms (OpenKBP personal use; Endoscapes non-commercial with attribution). FiSaV is CC BY 4.0 with attribution.
- **Use of the cahier des charges:** confirmed with the supervisor that it is guidance, not a checklist to follow to the letter. The education-first idea stays. Cahier items are adopted where they add real value: security, offline submit, audit, explainability and human review.

## Decision update (2026-10-10, supersedes the decision above)

**What changed.** The product owner chose to follow the teammate's `docs/review/MEDFORGE_HackCure_Platform_Enhancement_Proposal (1).md` (reviewed commit `7f151cc`). The teammate's agent executes the same plan, and one shared plan avoids two diverging implementations.

- **Flagship:** DoseTwin, as a guided research review of the same-case pt_241 reference vs the archived set_1 prediction. It includes a difference inspector, a reviewer decision with a required rationale ("Accept for further expert assessment", "Request revision", "Reject research candidate"), and a reopenable, exportable report. This is never treatment approval.
- **Supporting modules, all still usable:** SurgiVision, FistulaGuard, Academy and Educator.
- **FiSaV risk index:** deferred to the proposal's phase 4 (only after a verified outcome definition and clinician collaborators). `docs/FISAV_EVALUATION_PROTOCOL.md` stays frozen at v1.1 and has not been run. The FiSaV quality inspector stays in scope.
- **Rule:** "No confidence theater". No probability, risk grade or uncertainty band without a model that supports it.
- **Deployment:** local Docker on the demo PC only. OpenKBP and Endoscapes are shown only on this machine.

**Work split** (using the proposal's roles, to avoid duplicate work):

| Owner | Proposal phases | Scope |
|---|---|---|
| Teammate's agent | Phase 1 | DoseTwin guided assessment, difference inspector, review decision, durable report (scientific and frontend lead roles) |
| This branch (`upgrade/hackcure-compliance`) | Phases 0, 2, 3 | CI repair and contract lock, Docker offline packaging, security (hash-chained audit log, SQLCipher, TLS 1.3, role checks), claims checker, FHIR-shaped export, L1/L3 dossier (backend/security and integration/testing lead roles) |

**Integration point:** the review decision should be logged with `audit.append(conn, action=..., ...)` from `apps/api/app/audit.py`, inside the same transaction as the decision write, rather than through a second event log. Add the action name to `ACTIONS` in that module. `model_output.review` and `expert_review.record` are already reserved.
