import { describe, expect, it } from "vitest";
import { canSubmitMission, getMissionProgress } from "./academy-mission-progress";

describe("student mission progression", () => {
  it("keeps the learner on evidence selection until source evidence is chosen", () => {
    const progress = getMissionProgress("started", false, ["q1"], {});

    expect(progress.currentIndex).toBe(1);
    expect(progress.completed).toEqual([true, false, false, false, false]);
    expect(canSubmitMission(progress, false)).toBe(false);
  });

  it("requires an answer for every authored question before submit is enabled", () => {
    const progress = getMissionProgress("started", true, ["q1", "q2"], { q1: "A grounded observation" });

    expect(progress.questionsComplete).toBe(false);
    expect(progress.currentIndex).toBe(3);
    expect(canSubmitMission(progress, true)).toBe(false);
  });

  it("marks the mission ready only with source evidence and all question answers", () => {
    const progress = getMissionProgress("started", true, ["q1", "q2"], { q1: "Evidence A", q2: "Limits B" });

    expect(progress.currentIndex).toBe(4);
    expect(progress.completed).toEqual([true, true, true, true, false]);
    expect(canSubmitMission(progress, true)).toBe(true);
  });

  it("shows submitted and reviewed attempts as complete without making them editable", () => {
    const submitted = getMissionProgress("review_required", true, ["q1"], { q1: "Submitted answer" });
    const reviewed = getMissionProgress("graded", true, ["q1"], { q1: "Submitted answer" });

    expect(submitted.completed).toEqual([true, true, true, true, true]);
    expect(submitted.submitted).toBe(true);
    expect(submitted.reviewed).toBe(false);
    expect(reviewed.reviewed).toBe(true);
    expect(canSubmitMission(submitted, true)).toBe(false);
  });
});
