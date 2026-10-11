import type { StudentChallenge } from "@/lib/api";

/** Whether a learner can still start an assignment under the Academy API's due-date rule. */
export function isAssignmentStartClosed(
  state: StudentChallenge["state"],
  dueAt: string | null,
  now = Date.now(),
): boolean {
  if (state !== "not_started" || !dueAt) return false;
  const deadline = Date.parse(dueAt);
  return Number.isFinite(deadline) && deadline <= now;
}
