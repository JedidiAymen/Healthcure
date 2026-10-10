// Plain-language helpers for the CVS self-check. Each Endoscapes CVS value is the
// mean of three annotators, so it maps to a whole number of "achieved" votes.
export type Judgement = 0 | 1

export const CVS_CRITERIA = [
  { id: "two_structures", label: "Two structures visualized" },
  { id: "hepatocystic_triangle", label: "Hepatocystic triangle cleared" },
  { id: "cystic_plate", label: "Cystic plate visualized" },
] as const

export function annotatorVotes(mean: number): number {
  return Math.round(mean * 3)
}

export function describeAnnotatorMean(mean: number): string {
  const votes = annotatorVotes(mean)
  if (votes === 3) return "All 3 annotators marked it achieved"
  if (votes === 0) return "No annotator marked it achieved"
  return `${votes} of 3 annotators marked it achieved (annotators disagreed)`
}

export function isCompleteJudgement(judgements: (Judgement | null)[]): judgements is [Judgement, Judgement, Judgement] {
  return judgements.length === CVS_CRITERIA.length && judgements.every(value => value === 0 || value === 1)
}
