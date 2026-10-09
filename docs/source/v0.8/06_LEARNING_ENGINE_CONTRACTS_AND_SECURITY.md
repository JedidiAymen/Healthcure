# 06 — Learning engine: contracts, authorization, scoring, provenance

**Status:** draft v0.4. This is the formal boundary between research engine, educator authoring, Student Academy and future university integrations.

## Core architecture

```
Research dataset -> DatasetAdapter -> EvidenceCaseRegistry -> ScientificArtifactStore
                                              |
                                        CapabilityRegistry
                                              |
                         +--------------------+---------------------+
                         |                    |                     |
                  Professional API     Educator Authoring API    Student Runtime API
                         |                    |                     |
                  Full authorized       Publish immutable       Redacted capability
                  scientific work       challenge version       & answer payloads
                                              |                     |
                                        Published rubric -> Review/Grade service
                                                                  |
                                                    Progress/XP projection and reports
```

**Hard rule:** the same scientific calculation library and viewer component render for students and professionals. Role changes *capability grants* and answer visibility, not algorithm implementations.

## Domain entities (storage)

| Entity | Identity | Key fields / constraints |
|---|---|---|
| `EvidenceCase` | `caseId` | module, dataset/version, subject pseudonym, source hash, artifact refs, data rights |
| `ScientificArtifact` | `artifactId` + hash | kind, modality-specific metadata, origin, source model/annotation, ACL, content URI |
| `CapabilityManifest` | `capabilityId` + version | operation/tool ID, accepted artifact kinds, runtime readiness, UI controls, permissions |
| `LearningPathVersion` | path + version | ordered immutable published challenge version references |
| `ChallengeDraft` | UUID | mutable authoring doc, optimistic revision, owner, review status |
| `ChallengeVersion` | challenge + integer version | immutable blocks, references, learner tool grants, approved reviewer, reveal and rubric policy |
| `Assignment` | assignmentId | challenge version, cohort, availability, reveal and attempt policy |
| `Attempt` | attemptId | challengeVersion, learner pseudonym, state, revision, committed answers |
| `Observation` | observationId | typed coordinates/time/numeric answer, source artifact, draft/submission state |
| `GradeEvent` | UUID | attempt, rubric version, dimensions, evaluator + reviewer, supersedes ID, audit metadata |
| `LearningEvent` | UUID | immutable dedup key, learner, event type, source run, datetime |
| `ProgressProjection` | learner + path | derived from finalized events, not source of grade truth |

## API division: least privilege

**Public/nonrestricted:** module summaries, permitted learning-path metadata, general documentation (never hidden source details).

**Student:**
- `GET /api/v1/academy/paths`
- `GET /api/v1/academy/challenges/:id` -> no answer fields
- `POST /api/v1/academy/challenges/:id/attempts`
- `GET /api/v1/academy/attempts/:attemptId` -> redacted `StudentAttemptManifest`
- `PATCH /api/v1/academy/attempts/:attemptId/draft` -> idempotent optimistic edit
- `POST /api/v1/academy/attempts/:attemptId/submit` -> atomic commit
- `GET /api/v1/academy/attempts/:attemptId/debrief` -> only after policy release
- `GET /api/v1/academy/progress` -> rubric history + cosmetic achievements

**Educator:**
- `GET /api/v1/educator/evidence` -> only eligible licensed and permitted cases
- `POST /api/v1/educator/drafts` / `PATCH /api/v1/educator/drafts/:id`
- `POST /api/v1/educator/drafts/:id/validate`
- `POST /api/v1/educator/drafts/:id/preview-session` -> student redacted view
- `POST /api/v1/educator/drafts/:id/submit-for-review`
- `POST /api/v1/educator/drafts/:id/publish` -> protected transition
- `POST /api/v1/educator/assignments`
- `GET /api/v1/educator/assignments/:id/attempts`
- `POST /api/v1/educator/attempts/:id/grade-review`

**Professional:** unchanged source `GET /cases/:id/viewer-manifest`, `/runs`, `/models`, scientific analysis tools; never authorize student to access full manifests just by changing a UI switch.

## Challenge schema (TypeScript pseudo-contract, to implement as versioned Zod + Pydantic)

```ts
export type Modality = "surgivision" | "dosetwin" | "fistulaguard";
export type EvidenceOrigin =
  | "raw" | "expert_reference" | "model_prediction" | "computed" | "synthetic_teaching";

export type Observation =
  | { kind: "frame_region"; artifactId: string; frameId: string;
      coordinateSystem: "pixel_xy" | "normalized_xy";
      geometry: { kind: "point"; x: number; y: number } |
                { kind: "box"; x: number; y: number; width: number; height: number };
      label?: string; insufficientEvidence?: boolean }
  | { kind: "dose_voxel"; artifactId: string; planId: string; roiId?: string;
      ijk: [number, number, number]; valueGy?: number;
      geometryVersion: string }
  | { kind: "signal_interval"; artifactId: string; channelId: string;
      startSample: number; endSample: number; sampleRateHz: number;
      observedCondition?: "clip" | "noise" | "missing" | "unremarkable" }
  | { kind: "numeric"; artifactId: string; metricId: string; value: number;
      unit: "Gy" | "percent" | "Hz" | "s" | "dB" | "unitless" }
  | { kind: "reasoning"; promptId: string; text: string;
      conclusion: "supported" | "uncertain" | "insufficient" };

export interface PublishedChallenge {
  challengeId: string;
  version: number;
  module: Modality;
  evidenceCaseId: string;
  visibleArtifactIds: string[];
  // Reference ids and grading internals NEVER included in StudentAttemptManifest
  requiredCapabilityIds: string[];
  blocks: ChallengeBlock[];
  releasePolicy: "after_submit" | "after_instructor_review" | "after_date";
  reviewedBy: string | null;
  reviewedAt: string | null;
  sourceRevisionHash: string;
}

export interface StudentAttemptManifest {
  attemptId: string;
  challengeId: string;
  challengeVersion: number;
  state: "draft" | "submitted" | "needs_review" | "graded" | "released";
  viewer: RedactedViewerManifest;
  allowedCapabilityIds: string[];
  blocks: PublicStudentBlock[];
  draftObservations: Observation[];
  revision: number;
}
```

`PublishedChallenge` should itself be represented by public/secret projections; any reference IDs or scoring internals belong to a server-private evaluator record. `RedactedViewerManifest` must enumerate only granted assets and signed/authorized URLs.

## Crucial modality typing and validation

| Data type | Guardrails |
|---|---|
| Surgery frame geometry | store frame dimensions, resizing transform, frame ID; translate screen pixels to original coordinates in a tested function; empty annotations != no anatomy |
| Dose voxel | validate `ijk` in bounds, grid geometry, dose units and plan ID; unknown affine/origin means no world-coordinate alignment claims |
| Dose reference comparison | same subject/case and compatible geometry before subtraction; separate measured differences from clinical acceptability |
| Signal interval | enforce `0 <= startSample < endSample <= nSamples`, channel unit and sample rate; channel-specific sample rate explicit |
| Text reasoning | length limits, input sanitization, do not automatically grade ambiguous medical judgments |
| Dataset splits | training vs evaluation partitions respected; subject/video-level leakage prohibited |

## Authorization, asset URLs and content integrity

- RBAC/ABAC policy enforced server-side for **dataset access**, **model execution**, **reference reveal**, **assignment/cohort**, **published state**.
- Student permissions grant a tool + operation on a case/asset subset, not arbitrary API routes.
- `/viewer-manifest` projection depends on JWT session and role grant. No source annotations reachable through guessed full asset endpoints or static public bundles if answer is hidden.
- Training cases use anonymized, permitted research materials; do not accept real clinical uploads without separately designed privacy/security program.
- Educator markdown/rich text must be sanitized and validated; forbid untrusted scripts, remote embeds and arbitrary HTML.
- Expired or revoked source licensing invalidates future access; historical grade metadata may remain without redistributing forbidden pixels.
- Password/secret/PHI scrubbing on logs and telemetry. Case ID isn't guaranteed anonymous unless validated.
- Any external agent skill or code is pinned/reviewed before running inside development machine; never execute fetched code without review.

## Attempt lifecycle and idempotency

```
created -> draft -> submitted -> auto_graded -> released
                       |             \
                       |              -> needs_review -> reviewed -> released
                       -> canceled_by_policy (exceptional)
```

- All grade changes are **append-only**; each newer grade supersedes old one, with reason.
- `attemptId + clientSubmissionKey` unique; duplicate POST yields exact accepted receipt, no repeated score.
- XP recomputed deterministically from finalized distinct grade events. No awarding XP from browser-supplied points.
- `released` only after reveal policy passes and server checks content rights.
- Updating source model result does not retroactively change already published answers or past grading.
- If source becomes invalid, stop new attempts and flag affected grading review, don't silently replace evidence.

## Grading algorithm policy

- Objective numeric tolerance is specified by educator in real units and reviewed against data precision; floating point tolerance must have stable rounding.
- Spatial localization uses pixel/voxel coordinate and known transform; specify IoU/point-distance threshold and ambiguity policy.
- Reference mask multiple annotators? Preserve label disagreement where available; don't force false certainty.
- Optional model outputs are **teaching context**, not default grading ground truth.
- Manual-review dimensions are `pending` until completed and cannot be silently counted as zero or full marks.
- Scores must be explanations: evidence chosen, reference source, criterion and awarded dimension.

## Minimum event schema

```json
{
  "eventId":"uuid",
  "eventType":"attempt.submitted",
  "actorId":"learner-pseudonym",
  "attemptId":"uuid",
  "challengeId":"M-DOSE-001",
  "challengeVersion":1,
  "sourceRevisionHash":"sha256:...",
  "idempotencyKey":"opaque-client-key",
  "occurredAt":"2026-10-09T12:00:00+01:00",
  "dataClassification":"education-research"
}
```

No case images, raw patient data, student free text, tokens or acoustic data in analytics events.

## Critical tests for implementation

1. Fetch hidden reference as a student before authorized reveal -> HTTP 403/404, no leaks through nested fields or image URLs.
2. Educator preview uses real student projection, not an educator full manifest with hidden tabs.
3. A client changes `allowedCapabilityIds` locally -> API rejects unauthorized tool run.
4. Random forged voxel coordinates / audio time intervals -> 422, no grade mutation.
5. Retry submit with same/different idempotency keys -> only one committed answer set and one valid grade.
6. Reviewer changes a grade -> history has both grade events and deterministic progress projection.
7. Published version v1 and new v2 coexist; assignment pins v1 for all its attempts.
8. Source asset hash no longer matches published manifest -> block new attempt; show source integrity warning.
9. Model checkpoint absent -> no fabricated inference artifacts; student task may run using clearly labeled references only.
10. User revokes optional leaderboard participation -> never appears with identifiable name on public board.

## Implementation approach

- For hackathon: SQLite transactions + migrations, typed Zod/Pydantic schemas, single API process, opaque asset IDs, directory-backed storage and explicit fixture migrations.
- For multi-user platform later: PostgreSQL; consent/approval workflow; stronger asset authorization; worker isolation/queues; testing and assessment scale.
- Strict shared IDs across professional viewer and student player, but separate API projections and scopes.
