// Shared prediction-provenance taxonomy. Every displayed output carries one of these kinds.
export type ProvenanceKind = "SOURCE_BENCHMARK" | "ARCHIVED_PREDICTION" | "RULE_BASED_METHOD" | "IN_APP_MODEL_INFERENCE"

export const PROVENANCE: Record<ProvenanceKind, { label: string; meaning: string; doesNotMean: string }> = {
  SOURCE_BENCHMARK: {
    label: "Source benchmark",
    meaning: "Values or annotations published with the source dataset.",
    doesNotMean: "Not a clinical record of a real treatment or diagnosis, and not produced by MEDFORGE.",
  },
  ARCHIVED_PREDICTION: {
    label: "Archived prediction",
    meaning: "Output of a published research model, imported as a file.",
    doesNotMean: "Not MEDFORGE inference, not a new prediction, and not a clinically validated output.",
  },
  RULE_BASED_METHOD: {
    label: "Rule-based method",
    meaning: "A documented, deterministic calculation on the source data (for example a filter or beat detector).",
    doesNotMean: "Not a learned model and not a diagnostic test.",
  },
  IN_APP_MODEL_INFERENCE: {
    label: "In-app model inference",
    meaning: "A model run by MEDFORGE in an isolated worker, with a recorded checkpoint hash.",
    doesNotMean: "Not a finding or diagnosis; a consultative research output for expert review only.",
  },
}

export function provenanceCopy(kind: ProvenanceKind) {
  return PROVENANCE[kind]
}
