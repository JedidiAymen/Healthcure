import type { components } from '../../packages/contracts/generated-api'
import { queryClient } from './query-client'
import { withResearchSignIn } from './research-write-auth'

type ApiSchemas = components['schemas']

export type Capability = {
  id: string;
  capability_state: "ready" | "requires-setup" | "unverified";
  detail: string;
};
export type CaseRecord = ApiSchemas['Case'];
export type ModelRecord = ApiSchemas['ModelRecord'];
export type VoxelSlice = ApiSchemas['VoxelSlice'];
export type RoiMaskVolume = ApiSchemas['RoiMaskVolume'];
export type DoseArtifact = ApiSchemas['DoseArtifact'];
export type DoseArtifactSlice = ApiSchemas['DoseArtifactSlice'];
export type DoseArtifactComparison = ApiSchemas['DoseArtifactComparison'];
export type DvhSummary = ApiSchemas['DvhSummary'];
export type CaseSummary = {
  case: string;
  grid_shape: number[];
  voxel_dimensions_mm: number[];
  files_sha256: Record<string, string>;
  available_rois: Record<
    string,
    {
      status: string;
      voxels: number;
      volume_cc?: number;
      dmean_gy?: number;
      dmax_voxel_gy?: number;
      d95_gy_interpolated?: number;
      d0_1cc_gy_openkbp?: number;
      d99_gy_openkbp?: number;
      d1_gy_openkbp?: number;
      v20gy_percent?: number;
      note?: string;
    }
  >;
  dose_nonzero_voxels: number;
  ct_nonzero_voxels: number;
  possible_dose_voxels: number;
  dose_reference_kind: string;
  coordinate_frame: string;
};
type RunRecordBase = Omit<ApiSchemas['RunRecord'], 'operation_id' | 'results'>;
export type DoseTwinRunRecord = RunRecordBase & {
  operation_id: "openkbp.case_summary";
  results: CaseSummary | null;
};
export type CvsInferenceResult = {
  case_id: string;
  scores: number[];
  reference_labels: number[];
  image_is_all_black_pixels: boolean;
  score_semantics: string;
  text_preprocessing: Record<string, unknown>;
};
export type CvsInferenceRunRecord = RunRecordBase & {
  operation_id: "cvs.inference";
  results: CvsInferenceResult | null;
};
export type RunRecord = DoseTwinRunRecord | CvsInferenceRunRecord;
export type ModelValidation = ApiSchemas['ModelValidationResponse'];
export type ViewerEvidenceState = {
  case_id: string;
  voxel: [number, number, number];
  axis?: 0 | 1 | 2;
  roi: string;
  dose_overlay: boolean;
  roi_overlay: boolean;
  dose_opacity: number;
};
export type SurgicalAnnotation = ApiSchemas['SurgicalAnnotation'];
export type SurgicalFrameRecord = ApiSchemas['SurgicalFrameRecord'];
export type SurgicalMediaRecord = ApiSchemas['SurgicalMediaRecord'];
export type SurgicalSequenceFrame = ApiSchemas['SurgicalSequenceFrame'];
export type SurgicalClipRecord = ApiSchemas['SurgicalClipRecord'];
export type CholecT50VideoRecord = ApiSchemas['CholecT50VideoRecord'];
export type CholecT50FrameRecord = ApiSchemas['CholecT50FrameRecord'];
export type CvsCoverage = ApiSchemas['CvsCoverage'];
export type SignalRecord = ApiSchemas['SignalRecord'];
export type SignalWindow = ApiSchemas['SignalWindow'];
export type SignalSpectrum = ApiSchemas['SignalSpectrum'];
export type SignalSpectrogram = ApiSchemas['SignalSpectrogram'];
export type SignalFeatures = ApiSchemas['SignalFeatures'];
export type SignalWindowComparison = ApiSchemas['SignalWindowComparison'];
export type EvidenceReport = {
  id: string;
  run_id: string | null;
  case_id: string;
  status: "draft" | "generated" | "failed";
  created_at: string;
  document: {
    schema?: string;
    title?: string;
    generated_at_utc?: string;
    case?: {
      id: string;
      dataset_id?: string;
      source_case_id?: string;
      reference_kind?: string;
      split?: string;
      video_id?: number;
      frame_number?: number;
      file_name?: string;
      width_px?: number;
      height_px?: number;
    };
    analysis?: {
      run_id?: string;
      operation_id?: string;
      status: string;
      method?: string;
    };
    source?: {
      repository: string;
      citation?: string;
      license?: string;
      revision?: string;
      files_sha256?: Record<string, string>;
      model_revision?: string;
      prediction_source_revision?: string;
      checkpoint_sha256?: string;
      rights_basis?: string;
      image_sha256?: string;
      annotation_sha256?: string;
    };
    evidence?: { reference_annotations?: Array<{ id: number; category_name: string; bbox: number[] }>; cvs_source_values?: Array<number | null> };
    display_state?: { show_annotations: boolean; selected_annotation_id: number | null };
    results?: CaseSummary;
    comparison?: DoseArtifactComparison;
    selection?: { roi: string; axis: number; index: number; coordinate_frame: string };
    viewer_state?: ViewerEvidenceState;
    limitations?: string[];
  };
};
export type LessonBlockType =
  | "Instruction"
  | "Evidence view"
  | "Observation"
  | "Measurement"
  | "Question"
  | "Reveal"
  | "CVS self-check";
export type EducatorLessonBlock = {
  id: string;
  type: LessonBlockType;
  title: string;
  content: string;
};
export type RubricCriterion = { id: string; title: string; description: string; max_points: number };
export type RubricCriterionScore = RubricCriterion & { earned_points: number; note: string };
export type EducatorDraftContent = {
  rubric: string;
  rubric_criteria: RubricCriterion[];
  blocks: EducatorLessonBlock[];
};
export type EducatorDraft = {
  id: string;
  title: string;
  case_id: string;
  module: string;
  revision: number;
  updated_at: string;
  content: EducatorDraftContent;
};
export type EducatorDraftSummary = Omit<EducatorDraft, "content">;
export type EducatorDraftInput = {
  title: string;
  case_id: string;
  content: EducatorDraftContent;
};

export type PublishedLessonVersion = {
  version_id: string; lesson_id: string; version: number; title: string;
  module: string; case_id: string; case_label: string; published_at: string;
  review_status: "local-unreviewed";
};
export type EducatorDraftPreview = {
  title: string; module: string; case_id: string; case_label: string;
  dataset_id: string; reference_kind: string; source_license: string;
  publication_review: "required" | "blocked";
  blocks: EducatorLessonBlock[];
};
export type EducatorCohort = { id: string; name: string; student_count: number };
export type EducatorStudent = { id: string; display_name: string };
export type EducatorCohortRoster = { cohort_id: string; cohort_name: string; student_count: number; learners: { display_name: string }[] };
export type EducatorAssignment = {
  id: string; lesson_version_id: string; lesson_title: string; cohort_id: string;
  due_at: string | null; student_count: number;
};
export type StudentChallenge = {
  assignment_id: string; version_id: string; lesson_id: string; title: string;
  module: string; case_id: string; case_label: string; version: number; due_at: string | null;
  state: "not_started" | "in_progress" | "submitted" | "reviewed";
};
export type StudentLearningPathLesson = {
  assignment_id: string;
  case_id: string;
  title: string;
  version: number;
  case_label: string;
  source_license: string;
  due_at: string | null;
  state: StudentChallenge["state"];
};
export type StudentLearningPath = {
  path_id: string;
  title: string;
  module: "surgivision" | "dosetwin" | "fistulaguard";
  description: string;
  objectives: string[];
  prerequisites: string;
  limitation_notice: string;
  assigned_count: number;
  in_progress_count: number;
  submitted_count: number;
  reviewed_count: number;
  lessons: StudentLearningPathLesson[];
  source_attribution: string[];
};
export type LearnerBlock = { id: string; type: LessonBlockType; title: string; content: string };
export type StudentObservation = { block_id: string; response: string };
export type StudentDoseViewerEvidence = { kind: "dosetwin"; case_id: string; voxel: [number, number, number]; roi: string; dose_overlay: boolean; roi_overlay: boolean; dose_opacity: number };
export type StudentSurgiViewerEvidence = { kind: "surgivision"; case_id: string; frame_id: string; selection_x_px: number; selection_y_px: number };
export type StudentSignalViewerEvidence = { kind: "fistulaguard"; case_id: string; record_id: string; channel: "ECG" | "raw PZT1" | "raw PZT2" | "raw PZT3" | "raw PZT4"; start_sec: number; duration_sec: number };
export type StudentViewerEvidence = StudentDoseViewerEvidence | StudentSurgiViewerEvidence | StudentSignalViewerEvidence;
export type StudentAttempt = {
  attempt_id: string; assignment_id: string;
  state: "started" | "submitted" | "review_required" | "graded" | "revealed";
  revision: number;
  challenge: { title: string; module: string; case_id: string; case_label: string; dataset_id: string; reference_kind: string; source_license: string; blocks: LearnerBlock[] };
  observations: StudentObservation[];
  viewer_evidence: StudentViewerEvidence | null;
};
export type EducatorAttemptReview = {
  attempt_id: string; student_id: string; student_name: string;
  state: StudentAttempt["state"]; submitted_at: string | null;
  score: number | null; observations: StudentObservation[];
  rubric_criteria: RubricCriterion[]; criterion_scores: RubricCriterionScore[];
  viewer_evidence: StudentViewerEvidence | null;
  assigned_case: { module: "surgivision" | "dosetwin" | "fistulaguard"; case_id: string; case_label: string } | null;
  cvs_self_checks?: CvsSelfCheckResult[];
};
export type CvsSelfCheckResult = ApiSchemas['CvsSelfCheckResult'];
export type SignalFilterResult = ApiSchemas['SignalFilterResult'];
export type SignalQuality = ApiSchemas['SignalQuality'];
export type TelemetryStatus = ApiSchemas['TelemetryStatus'];
export type AuditVerification = ApiSchemas['AuditVerification'];
export type TelemetryWindow = ApiSchemas['TelemetryWindow'];
export type ResearchReview = ApiSchemas['ResearchReview'];
export type VoxelDifference = ApiSchemas['VoxelDifference'];
export type ResearchReviewDecision = ResearchReview['decision'];
export type ResearchReviewCreate = ApiSchemas['ResearchReviewCreate'];
export type BeatAnalysis = ApiSchemas['BeatAnalysis'];
export type SignalAnnotation = ApiSchemas['SignalAnnotation'];
export type SignalAnnotationCreate = ApiSchemas['SignalAnnotationCreate'];
export type SignalFilterQuery = { mode: "bandpass"; low_hz: number; high_hz: number } | { mode: "notch"; notch_hz: number; q: number };
export type SurgicalFrameBrowse = ApiSchemas['SurgicalFrameBrowse'];
export type SurgicalFrameSummary = ApiSchemas['SurgicalFrameSummary'];
export type SurgicalFrameFilters = {
  split?: "train" | "val" | "test";
  category?: string;
  criterion?: "two_structures" | "hepatocystic_triangle" | "cystic_plate";
  min_value?: number;
  max_value?: number;
  agreement?: "unanimous" | "disputed";
  limit?: number;
  offset?: number;
};
export type StudentReferenceEvidence = {
  kind: "expert_reference";
  case_id: string;
  source: string;
  image_sha256: string;
  annotation_sha256: string;
  annotations: SurgicalAnnotation[];
  cvs_criteria: number[];
  limitations: string[];
};
export type StudentDebrief = { attempt_id: string; score: number; max_score: number; feedback: string; rubric: string; criterion_scores: RubricCriterionScore[]; reveal_blocks: EducatorLessonBlock[]; xp_awarded: number; reference_evidence?: StudentReferenceEvidence | null };
export type StudentProgress = {
  xp: number;
  xp_enabled: boolean;
  achievements_enabled: boolean;
  graded_attempts: number;
  average_score: number | null;
  assigned_activities: number;
  next_activity: { assignment_id: string; title: string; module: string; case_label: string; version: number; due_at: string | null; state: "start" | "resume" | "awaiting_review" } | null;
  rubric_dimensions: { id: string; title: string; description: string; attempts: number; earned_points: number; available_points: number; average_percent: number | null }[];
  rubric_history: { id: string; attempt_id: string; dimension_id: string; dimension_title: string; lesson_title: string; reviewed_at: string; earned_points: number; available_points: number; percent: number | null }[];
  achievements: { key: string; title: string; description: string; earned_at: string }[];
};
export type StudentParticipationRecord = {
  schema: "medforge.education-participation/v1";
  record_type: "local-education-participation";
  exported_at: string;
  notice: string;
  activities: { attempt_id: string; lesson_title: string; module: string; case_label: string; version: number; state: "started" | "submitted" | "review_required" | "graded" | "revealed"; submitted_at: string | null; reviewed_at: string | null; score: number | null; max_score: number | null }[];
};

const API = import.meta.env.VITE_API_URL ?? "";
let sessionToken: string | null = null;
export function setApiSessionToken(token: string | null) {
  if (sessionToken !== token) queryClient.clear()
  sessionToken = token;
}
async function request<T>(path: string, timeoutMs = 3500): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail?.message ?? `API returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}
async function post<T>(path: string, body: unknown, extraHeaders: Record<string, string> = {}, timeoutMs = 15000): Promise<T> {
  const response = await withResearchSignIn(path, () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
    return fetch(`${API}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(
      detail?.detail?.message ?? `API returned ${response.status}`,
    );
  }
  return response.json() as Promise<T>;
}
async function put<T>(path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  const response = await fetch(`${API}${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(
      detail?.detail?.message ?? `API returned ${response.status}`,
    );
  }
  return response.json() as Promise<T>;
}
export const api = {
  health: () =>
    request<{
      status: string;
      reference_harness: boolean;
      public_deployment_ready: boolean;
    }>("/healthz"),
  localLogin: (username: string, password: string) =>
    post<{
      access_token: string;
      token_type: "bearer";
      expires_at: string;
      user: {
        id: string;
        display_name: string;
        role: "student" | "educator" | "researcher" | "admin";
      };
    }>("/api/v1/auth/local-login", { username, password }),
  localMe: () =>
    request<{
      id: string;
      display_name: string;
      role: "student" | "educator" | "researcher" | "admin";
    }>("/api/v1/auth/me"),
  localLogout: () => post<{ status: string }>("/api/v1/auth/logout", {}),
  educatorEvidence: () =>
    request<
      {
        case: CaseRecord;
        license_label: string;
        draft_use: "available";
        publication_review: "required" | "blocked";
        publication_note: string;
      }[]
    >("/api/v1/educator/evidence"),
  educatorDrafts: () =>
    request<EducatorDraftSummary[]>("/api/v1/educator/drafts"),
  educatorDraft: (id: string) =>
    request<EducatorDraft>(`/api/v1/educator/drafts/${encodeURIComponent(id)}`),
  educatorDraftPreview: (id: string) => request<EducatorDraftPreview>(`/api/v1/educator/drafts/${encodeURIComponent(id)}/preview`),
  createEducatorDraft: (draft: EducatorDraftInput) =>
    post<EducatorDraft>("/api/v1/educator/drafts", draft),
  saveEducatorDraft: (
    id: string,
    draft: EducatorDraftInput,
    expected_revision: number,
  ) =>
    put<EducatorDraft>(`/api/v1/educator/drafts/${encodeURIComponent(id)}`, {
      ...draft,
      expected_revision,
    }),
  studentChallenges: () =>
    request<StudentChallenge[]>("/api/v1/academy/challenges"),
  studentLearningPaths: () =>
    request<StudentLearningPath[]>("/api/v1/academy/paths"),
  studentProgress: () => request<StudentProgress>("/api/v1/academy/progress"),
  studentProgressExport: () => request<StudentParticipationRecord>("/api/v1/academy/progress/export"),
  updateStudentLearningPreferences: (xp_enabled: boolean) =>
    put<{ xp_enabled: boolean }>("/api/v1/academy/preferences", { xp_enabled }),
  updateStudentAchievementPreferences: (achievements_enabled: boolean) =>
    put<{ achievements_enabled: boolean }>("/api/v1/academy/preferences/achievements", { achievements_enabled }),
  studentStartAttempt: (assignmentId: string) => post<StudentAttempt>("/api/v1/academy/attempts", { assignment_id: assignmentId }),
  studentAttempt: (attemptId: string) => request<StudentAttempt>(`/api/v1/academy/attempts/${encodeURIComponent(attemptId)}`),
  saveStudentAttempt: (attemptId: string, expected_revision: number, observations: StudentObservation[], viewer_evidence: StudentViewerEvidence | null) =>
    put<StudentAttempt>(`/api/v1/academy/attempts/${encodeURIComponent(attemptId)}/draft`, { expected_revision, observations, viewer_evidence }),
  submitStudentAttempt: (attemptId: string, expected_revision: number, idempotencyKey: string) =>
    post<{ attempt_id: string; state: "review_required"; submitted_at: string }>(`/api/v1/academy/attempts/${encodeURIComponent(attemptId)}/submit`, { expected_revision }, { "Idempotency-Key": idempotencyKey }),
  studentDebrief: (attemptId: string) => request<StudentDebrief>(`/api/v1/academy/attempts/${encodeURIComponent(attemptId)}/debrief`),
  educatorStudents: () => request<EducatorStudent[]>("/api/v1/educator/students"),
  educatorCohorts: () => request<EducatorCohort[]>("/api/v1/educator/cohorts"),
  educatorCohortRoster: (cohortId: string) => request<EducatorCohortRoster>(`/api/v1/educator/cohorts/${encodeURIComponent(cohortId)}/students`),
  createEducatorCohort: (name: string) => post<EducatorCohort>("/api/v1/educator/cohorts", { name }),
  addStudentToCohort: (cohortId: string, studentId: string) => post<{ cohort_id: string; student_count: number }>(`/api/v1/educator/cohorts/${encodeURIComponent(cohortId)}/students`, { student_id: studentId }),
  educatorVersions: () => request<PublishedLessonVersion[]>("/api/v1/educator/versions"),
  publishEducatorDraft: (draftId: string, source_terms_confirmed: boolean, source_review_note: string) =>
    post<PublishedLessonVersion>(`/api/v1/educator/drafts/${encodeURIComponent(draftId)}/publish`, { source_terms_confirmed, source_review_note }),
  educatorAssignments: () => request<EducatorAssignment[]>("/api/v1/educator/assignments"),
  createEducatorAssignment: (lesson_version_id: string, cohort_id: string, due_at: string | null) =>
    post<EducatorAssignment>("/api/v1/educator/assignments", { lesson_version_id, cohort_id, due_at }),
  educatorAssignmentAttempts: (assignmentId: string) => request<EducatorAttemptReview[]>(`/api/v1/educator/assignments/${encodeURIComponent(assignmentId)}/attempts`),
  gradeEducatorAttempt: (attemptId: string, criterion_scores: { criterion_id: string; earned_points: number; note: string }[], feedback: string, reason: string, idempotencyKey: string) =>
    post<EducatorAttemptReview>(`/api/v1/educator/attempts/${encodeURIComponent(attemptId)}/grade`, { criterion_scores, feedback, reason }, { "Idempotency-Key": idempotencyKey }),
  modules: () => request<Capability[]>("/api/v1/modules"),
  // The first listing after an API start can take several seconds on Docker Desktop mounts.
  cases: () => request<CaseRecord[]>("/api/v1/cases", 30000),
  caseDetails: (caseId: string) => request<CaseRecord>(`/api/v1/cases/${encodeURIComponent(caseId)}`),
  surgicalFrame: (frameId: string) =>
    request<SurgicalFrameRecord>(
      `/api/v1/surgivision/frames/${encodeURIComponent(frameId)}`,
    ),
  surgicalMedia: () => request<SurgicalMediaRecord[]>("/api/v1/surgivision/media"),
  surgicalMediaRecord: (mediaId: string) => request<SurgicalMediaRecord>(`/api/v1/surgivision/media/${encodeURIComponent(mediaId)}`),
  surgicalSequenceFrames: (mediaId: string) => request<SurgicalSequenceFrame[]>(`/api/v1/surgivision/media/${encodeURIComponent(mediaId)}/sampled-frames`),
  surgicalClips: () => request<SurgicalClipRecord[]>("/api/v1/surgivision/clips"),
  signalFiltered: (recordId: string, channel: string, startSec: number, durationSec: number, filter: SignalFilterQuery) => {
    const query = new URLSearchParams({ channel, start_sec: String(startSec), duration_sec: String(durationSec), ...Object.fromEntries(Object.entries(filter).map(([key, value]) => [key, String(value)])) });
    return request<SignalFilterResult>(`/api/v1/fistulaguard/records/${encodeURIComponent(recordId)}/filtered?${query}`, 30000);
  },
  signalBeats: (recordId: string, channel: string, startSec: number, durationSec: number) =>
    request<BeatAnalysis>(`/api/v1/fistulaguard/records/${encodeURIComponent(recordId)}/beats?${new URLSearchParams({ channel, start_sec: String(startSec), duration_sec: String(durationSec) })}`, 30000),
  signalAnnotations: (recordId: string) => request<SignalAnnotation[]>(`/api/v1/fistulaguard/records/${encodeURIComponent(recordId)}/annotations`),
  createSignalAnnotation: (recordId: string, input: SignalAnnotationCreate) =>
    post<SignalAnnotation>(`/api/v1/fistulaguard/records/${encodeURIComponent(recordId)}/annotations`, input),
  deleteSignalAnnotation: async (annotationId: string) => {
    const response = await fetch(`${API}/api/v1/fistulaguard/annotations/${encodeURIComponent(annotationId)}`, {
      method: "DELETE", headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.detail?.message ?? `API returned ${response.status}`);
    }
  },
  signalQuality: (recordId: string, channel: string, startSec: number, durationSec: number) =>
    request<SignalQuality>(`/api/v1/fistulaguard/records/${encodeURIComponent(recordId)}/quality?${new URLSearchParams({ channel, start_sec: String(startSec), duration_sec: String(durationSec) })}`, 30000),
  telemetryDevices: () => request<TelemetryStatus>('/api/v1/telemetry/devices'),
  telemetryWindow: (deviceId: string, seconds = 5) => request<TelemetryWindow>(`/api/v1/telemetry/devices/${encodeURIComponent(deviceId)}/window?seconds=${seconds}`),
  doseVoxel: (caseId: string, artifactId: string, voxel: [number, number, number]) =>
    request<VoxelDifference>(`/api/v1/cases/${encodeURIComponent(caseId)}/dose-artifacts/${encodeURIComponent(artifactId)}/voxel?x=${voxel[0]}&y=${voxel[1]}&z=${voxel[2]}`, 15000),
  researchReviews: (caseId: string, artifactId: string) =>
    request<ResearchReview[]>(`/api/v1/research-reviews?case_id=${encodeURIComponent(caseId)}&artifact_id=${encodeURIComponent(artifactId)}`, 15000),
  createResearchReview: (input: ResearchReviewCreate) => post<ResearchReview>('/api/v1/research-reviews', input, {}, 30000),
  auditVerify: () => request<AuditVerification>('/api/v1/audit/verify', 15000),
  accountExport: () => request<unknown>('/api/v1/account/export', 15000),
  accountErase: (password: string) => post<{ status: string; learner_code: string; display_name: string }>('/api/v1/account/erase', { password, confirm: 'ERASE MY ACCOUNT' }),
  researchReviewDocument: (reviewId: string, format: 'export' | 'fhir') =>
    request<unknown>(`/api/v1/research-reviews/${encodeURIComponent(reviewId)}/${format}`, 15000),
  surgicalFrames: (filters: SurgicalFrameFilters = {}) => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)]));
    return request<SurgicalFrameBrowse>(`/api/v1/surgivision/frames${query.size ? `?${query}` : ""}`);
  },
  cvsSelfCheck: async (attemptId: string, blockId: string): Promise<CvsSelfCheckResult | null> => {
    const response = await fetch(`${API}/api/v1/academy/attempts/${encodeURIComponent(attemptId)}/cvs-self-check/${encodeURIComponent(blockId)}`, {
      headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}, signal: AbortSignal.timeout(3500),
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.detail?.message ?? `API returned ${response.status}`);
    }
    return response.json() as Promise<CvsSelfCheckResult>;
  },
  commitCvsSelfCheck: (attemptId: string, blockId: string, judgements: [0 | 1, 0 | 1, 0 | 1]) =>
    post<CvsSelfCheckResult>(`/api/v1/academy/attempts/${encodeURIComponent(attemptId)}/cvs-self-check/${encodeURIComponent(blockId)}`, { judgements }),
  surgicalClipVideoUrl: (clipId: string) => `${API}/api/v1/surgivision/clips/${encodeURIComponent(clipId)}/video`,
  cholecT50Videos: () => request<CholecT50VideoRecord[]>("/api/v1/surgivision/cholect50"),
  cholecT50Frames: (videoId: string) => request<CholecT50FrameRecord[]>(`/api/v1/surgivision/cholect50/${encodeURIComponent(videoId)}/frames`),
  cholecT50ImageUrl: (videoId: string, frameNumber: number) => `${API}/api/v1/surgivision/cholect50/${encodeURIComponent(videoId)}/frames/${frameNumber}/image`,
  surgicalCoverage: () => request<CvsCoverage>("/api/v1/surgivision/cvs-coverage"),
  surgicalImage: async (frameId: string) => {
    const headers: Record<string, string> = {};
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
    const response = await fetch(`${API}/api/v1/surgivision/frames/${encodeURIComponent(frameId)}/image`, { headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.detail?.message ?? `API returned ${response.status}`);
    }
    return URL.createObjectURL(await response.blob());
  },
  signalRecord: (recordId: string) =>
    request<SignalRecord>(
      `/api/v1/fistulaguard/records/${encodeURIComponent(recordId)}`,
    ),
  signalWindow: (
    recordId: string,
    channel: string,
    startSec: number,
    durationSec: number,
  ) =>
    request<SignalWindow>(
      `/api/v1/fistulaguard/records/${encodeURIComponent(recordId)}/waveform?channel=${encodeURIComponent(channel)}&start_sec=${startSec}&duration_sec=${durationSec}`,
    ),
  signalSpectrum: (
    recordId: string,
    channel: string,
    startSec: number,
    durationSec: number,
  ) =>
    request<SignalSpectrum>(
      `/api/v1/fistulaguard/records/${encodeURIComponent(recordId)}/spectrum?channel=${encodeURIComponent(channel)}&start_sec=${startSec}&duration_sec=${durationSec}`,
    ),
  signalSpectrogram: (
    recordId: string,
    channel: string,
    startSec: number,
    durationSec: number,
  ) =>
    request<SignalSpectrogram>(
      `/api/v1/fistulaguard/records/${encodeURIComponent(recordId)}/spectrogram?channel=${encodeURIComponent(channel)}&start_sec=${startSec}&duration_sec=${durationSec}`,
    ),
  signalFeatures: (
    recordId: string,
    channel: string,
    startSec: number,
    durationSec: number,
  ) =>
    request<SignalFeatures>(
      `/api/v1/fistulaguard/records/${encodeURIComponent(recordId)}/features?channel=${encodeURIComponent(channel)}&start_sec=${startSec}&duration_sec=${durationSec}`,
    ),
  signalComparisons: (caseId: string) =>
    request<SignalWindowComparison[]>(`/api/v1/comparisons?case_id=${encodeURIComponent(caseId)}`),
  signalComparison: (comparisonId: string) =>
    request<SignalWindowComparison>(`/api/v1/comparisons/${encodeURIComponent(comparisonId)}`),
  allSignalComparisons: (limit = 25, offset = 0) =>
    request<SignalWindowComparison[]>(`/api/v1/comparisons?limit=${limit}&offset=${offset}`),
  createSignalComparison: (input: ApiSchemas['SignalWindowComparisonCreate']) =>
    post<SignalWindowComparison>('/api/v1/comparisons', input),
  models: () => request<ModelRecord[]>("/api/v1/models"),
  validateModel: (modelId: string, caseId: string, operationId: string) =>
    post<ModelValidation>(`/api/v1/models/${encodeURIComponent(modelId)}/validate`, {
      case_id: caseId,
      operation_id: operationId,
    }),
  runs: () => request<RunRecord[]>("/api/v1/runs"),
  createRun: (caseId: string) =>
    post<DoseTwinRunRecord>("/api/v1/runs", {
      case_id: caseId,
      operation_id: "openkbp.case_summary",
    }),
  createCvsRun: (caseId: string, attempt = 1) =>
    post<CvsInferenceRunRecord>("/api/v1/runs", {
      case_id: caseId,
      operation_id: "cvs.inference",
      attempt,
    }, {}, 180000),
  reports: () => request<EvidenceReport[]>("/api/v1/reports"),
  createSurgicalFrameReport: (frame_id: string, display_state: { show_annotations: boolean; selected_annotation_id: number | null }) =>
    post<EvidenceReport>("/api/v1/reports/surgivision-frame", { frame_id, ...display_state }),
  createReport: (runId: string, viewerState?: ViewerEvidenceState) =>
    post<EvidenceReport>("/api/v1/reports", {
      run_id: runId,
      ...(viewerState ? { viewer_state: viewerState } : {}),
    }),
  createDoseComparisonReport: (caseId: string, artifactId: string, roi: string, axis: number, index: number) =>
    post<EvidenceReport>('/api/v1/reports/dosetwin-comparison', { case_id: caseId, artifact_id: artifactId, roi, axis, index }),
  slice: (
    caseId: string,
    axis: number,
    index: number,
    layer: "ct" | "dose" | "roi",
    roi: string,
  ) =>
    request<VoxelSlice>(
      `/api/v1/cases/${encodeURIComponent(caseId)}/viewer/slice?axis=${axis}&index=${index}&layer=${layer}&roi=${encodeURIComponent(roi)}`,
    ),
  dvh: (caseId: string, roi: string) =>
    request<DvhSummary>(
      `/api/v1/cases/${encodeURIComponent(caseId)}/viewer/dvh?roi=${encodeURIComponent(roi)}`,
    ),
  roiVolume: (caseId: string, roi: string) =>
    request<RoiMaskVolume>(
      `/api/v1/cases/${encodeURIComponent(caseId)}/viewer/roi-volume?roi=${encodeURIComponent(roi)}`,
    ),
  doseArtifacts: (caseId: string) =>
    request<DoseArtifact[]>(`/api/v1/cases/${encodeURIComponent(caseId)}/dose-artifacts`),
  doseArtifactComparison: (caseId: string, artifactId: string) =>
    request<DoseArtifactComparison>(`/api/v1/cases/${encodeURIComponent(caseId)}/dose-artifacts/${encodeURIComponent(artifactId)}/comparison`),
  doseArtifactSlice: (caseId: string, artifactId: string, axis: number, index: number) =>
    request<DoseArtifactSlice>(`/api/v1/cases/${encodeURIComponent(caseId)}/dose-artifacts/${encodeURIComponent(artifactId)}/slice?axis=${axis}&index=${index}`),
  importDoseArtifact: async (caseId: string, file: File, metadata: {
    sourceRevision: string; modelRevision: string; checkpointSha256: string;
    rightsBasis: string; spacingMm: [number, number, number];
  }) => {
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const fileHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const headers: Record<string, string> = {
      'Content-Type': 'text/csv', 'X-Dose-Origin': 'archived_model_prediction',
      'X-Dose-Model-Revision': metadata.modelRevision, 'X-Dose-Checkpoint-SHA256': metadata.checkpointSha256,
      'X-Dose-Source-Case': caseId,
      'X-Dose-Source-Revision': metadata.sourceRevision, 'X-Dose-Rights-Basis': metadata.rightsBasis,
      'X-Dose-Rights-Confirmed': 'true', 'X-Dose-Unit': 'Gy',
      'X-Dose-Index-Convention': 'x-major-y-middle-z-fastest', 'X-Dose-Array-Shape': '128,128,128',
      'X-Dose-Spacing-MM': metadata.spacingMm.join(','), 'X-Dose-File-SHA256': fileHash,
    };
    const path = `/api/v1/cases/${encodeURIComponent(caseId)}/dose-artifacts?file_name=${encodeURIComponent(file.name)}`;
    const response = await withResearchSignIn(path, () => fetch(`${API}${path}`, {
      method: 'PUT', headers: sessionToken ? { ...headers, Authorization: `Bearer ${sessionToken}` } : headers,
      body: bytes, signal: AbortSignal.timeout(90000),
    }));
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.detail?.message ?? `API returned ${response.status}`);
    }
    return response.json() as Promise<DoseArtifact>;
  },
};
