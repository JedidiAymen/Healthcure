import { describe, expect, it } from "vitest";
import type { EducatorAttemptReview, SignalRecord, SignalWindow, StudentSignalViewerEvidence } from "./api";
import { assessEducatorEvidencePreview, verifyAssignedSignalEvidence } from "./educator-evidence-preview";

const fisavEvidence: StudentSignalViewerEvidence = { kind: "fistulaguard", case_id: "fisav:pat001", record_id: "pat001", channel: "raw PZT2", start_sec: 12.5, duration_sec: 5 };
const signalRecord: SignalRecord = { id: "pat001", dataset_id: "FiSaV", source_case_id: "pat001", case_id: "fisav:pat001", file_name: "pat001.csv", source_sha256: "a".repeat(64), source_url: "https://osf.io/hypfr/", sample_rate_hz: 10000, duration_sec: 30, channel_units: {}, channels: ["raw PZT2"], sample_count: 300000, origin: "measured-research-recording", limitations: [] };
const signalWindow: SignalWindow = { case_id: "fisav:pat001", channel: "raw PZT2", channel_unit: "source-value (physical unit unspecified)", source_sha256: "a".repeat(64), source_sample_rate_hz: 10000, start_sec: 12.5, duration_sec: 5, original_sample_count: 50000, samples: [], method: "measured samples" };
const attempt = (overrides: Partial<EducatorAttemptReview> = {}): EducatorAttemptReview => ({
  attempt_id: "attempt-1", student_id: "student-1", student_name: "Learner", state: "review_required",
  submitted_at: null, score: null, observations: [], rubric_criteria: [], criterion_scores: [],
  assigned_case: { module: "fistulaguard", case_id: "fisav:pat001", case_label: "FiSaV pat001" },
  viewer_evidence: fisavEvidence,
  ...overrides,
});

describe("educator evidence preview gate", () => {
  it("maps an exact assigned FiSaV source window for checksum-verified preview", () => {
    expect(assessEducatorEvidencePreview(attempt())).toEqual({ state: "ready", evidence: attempt().viewer_evidence });
    expect(() => verifyAssignedSignalEvidence(fisavEvidence, signalRecord, signalWindow)).not.toThrow();
    // Authentic FiSaV response: 5.0 seconds requested, 4.9969 source-aligned seconds, 50,000 samples.
    expect(() => verifyAssignedSignalEvidence(fisavEvidence, signalRecord, { ...signalWindow, duration_sec: 4.9969, original_sample_count: 50000 })).not.toThrow();
    expect(() => verifyAssignedSignalEvidence(fisavEvidence, signalRecord, { ...signalWindow, source_sha256: "b".repeat(64) })).toThrow(/differs from the assigned record/);
    expect(() => verifyAssignedSignalEvidence(fisavEvidence, signalRecord, { ...signalWindow, duration_sec: 4.9, original_sample_count: 50000 })).toThrow(/source duration falls outside/);
    expect(() => verifyAssignedSignalEvidence(fisavEvidence, signalRecord, { ...signalWindow, duration_sec: 4.9969, original_sample_count: 49000 })).toThrow(/source sample count falls outside/);
    expect(() => verifyAssignedSignalEvidence(fisavEvidence, signalRecord, { ...signalWindow, start_sec: 12.5001 })).toThrow(/exact start time/);
  });

  it("distinguishes absent evidence, missing assignment identity, and mismatched sources", () => {
    expect(assessEducatorEvidencePreview(attempt({ viewer_evidence: null })).state).toBe("absent");
    expect(assessEducatorEvidencePreview(attempt({ assigned_case: null })).state).toBe("unavailable");
    expect(assessEducatorEvidencePreview(attempt({ viewer_evidence: { ...fisavEvidence, case_id: "fisav:pat002" } })).state).toBe("mismatch");
    expect(assessEducatorEvidencePreview(attempt({ viewer_evidence: { ...fisavEvidence, record_id: "pat002" } })).state).toBe("mismatch");
  });
});
