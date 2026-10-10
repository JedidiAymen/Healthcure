import type { CaseRecord } from "./api";

type EvidenceReference = { case: Pick<CaseRecord, "id"> } | null | undefined;

export type EducatorSourcePreviewAccess =
  | { state: "unselected"; message: string }
  | { state: "blocked"; message: string }
  | { state: "unavailable"; message: string }
  | { state: "synthetic"; message: string }
  | { state: "ready" };

export function getEducatorSourcePreviewAccess(
  source: CaseRecord | null,
  evidence: EvidenceReference,
): EducatorSourcePreviewAccess {
  if (!source) return { state: "unselected", message: "Choose a source to inspect its installed evidence." };
  if (source.status !== "ready") return { state: "blocked", message: "This source is blocked. No evidence preview is available." };
  if (source.reference_kind === "synthetic-test") {
    return { state: "synthetic", message: "Synthetic test fixtures are not shown as scientific source evidence." };
  }
  if (!evidence || evidence.case.id !== source.id) {
    return { state: "unavailable", message: "Matching source and license records are unavailable. No evidence preview is shown." };
  }
  return { state: "ready" };
}
