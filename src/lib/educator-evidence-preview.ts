import type { EducatorAttemptReview, SignalRecord, SignalWindow, StudentSignalViewerEvidence, StudentViewerEvidence } from "./api";

export type EvidencePreviewAssessment =
  | { state: "absent"; message: string }
  | { state: "unavailable"; message: string }
  | { state: "mismatch"; message: string }
  | { state: "ready"; evidence: StudentViewerEvidence };

export function assessEducatorEvidencePreview(
  attempt: Pick<EducatorAttemptReview, "assigned_case" | "viewer_evidence">,
): EvidencePreviewAssessment {
  if (!attempt.viewer_evidence) return { state: "absent", message: "This attempt has no saved scientific viewer evidence." };
  if (!attempt.assigned_case) return { state: "unavailable", message: "The immutable assigned case identity is unavailable; source evidence is hidden." };

  const { assigned_case: assigned, viewer_evidence: evidence } = attempt;
  if (assigned.module !== evidence.kind || assigned.case_id !== evidence.case_id) {
    return { state: "mismatch", message: "The submitted evidence does not match the source case assigned to this lesson." };
  }
  if (evidence.kind === "surgivision" && evidence.frame_id !== assigned.case_id) {
    return { state: "mismatch", message: "The submitted frame does not match the assigned Endoscapes frame." };
  }
  if (evidence.kind === "fistulaguard" && assigned.case_id !== `fisav:${evidence.record_id}`) {
    return { state: "mismatch", message: "The submitted recording does not match the assigned FiSaV source." };
  }
  return { state: "ready", evidence };
}

export function verifyAssignedSignalEvidence(
  evidence: StudentSignalViewerEvidence,
  record: SignalRecord,
  window: SignalWindow,
): void {
  const mismatch = (message: string): never => { throw new Error(`EVIDENCE_MISMATCH: ${message}`); };
  if (record.case_id !== evidence.case_id || record.source_case_id !== evidence.record_id) mismatch("The FiSaV record differs from the assigned case.");
  if (!/^[a-f\d]{64}$/i.test(record.source_sha256)) throw new Error("The FiSaV source checksum is unavailable or invalid.");
  const timeTolerance = 1 / record.sample_rate_hz;
  if (window.case_id !== record.case_id || window.source_sha256 !== record.source_sha256 || window.channel !== evidence.channel) {
    mismatch("The FiSaV window belongs to a different source, checksum, or channel.");
  }
  if (Math.abs(window.start_sec - evidence.start_sec) > timeTolerance || Math.abs(window.duration_sec - evidence.duration_sec) > timeTolerance) {
    mismatch("The FiSaV window does not match the saved learner time range.");
  }
}
