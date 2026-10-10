export type StudentAttemptState = "started" | "submitted" | "review_required" | "graded" | "revealed";

export type MissionProgress = {
  completed: boolean[];
  currentIndex: number;
  questionsComplete: boolean;
  submitted: boolean;
  reviewed: boolean;
};

export function getMissionProgress(
  state: StudentAttemptState,
  evidenceSelected: boolean,
  questionIds: string[],
  answers: Record<string, string>,
  selfCheckIds: string[] = [],
  committedSelfChecks: Record<string, boolean> = {},
): MissionProgress {
  const questionsComplete = questionIds.length + selfCheckIds.length > 0
    && questionIds.every((id) => (answers[id] ?? "").trim().length > 0)
    && selfCheckIds.every((id) => committedSelfChecks[id]);
  const submitted = state !== "started";
  const reviewed = state === "graded" || state === "revealed";
  const completed = [true, evidenceSelected, evidenceSelected, questionsComplete, submitted];
  const currentIndex = submitted ? 4 : !evidenceSelected ? 1 : !questionsComplete ? 3 : 4;
  return { completed, currentIndex, questionsComplete, submitted, reviewed };
}

export function canSubmitMission(progress: MissionProgress, evidenceSelected: boolean): boolean {
  return !progress.submitted && evidenceSelected && progress.questionsComplete;
}
