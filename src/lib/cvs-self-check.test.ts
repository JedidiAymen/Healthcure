import { describe, expect, it } from "vitest";
import { annotatorVotes, describeAnnotatorMean, isCompleteJudgement, type Judgement } from "./cvs-self-check";

describe("annotatorVotes", () => {
  it("converts a three-annotator mean into whole votes", () => {
    expect(annotatorVotes(0)).toBe(0);
    expect(annotatorVotes(1 / 3)).toBe(1);
    expect(annotatorVotes(2 / 3)).toBe(2);
    expect(annotatorVotes(1)).toBe(3);
  });
});

describe("describeAnnotatorMean", () => {
  it("states agreement and disagreement in plain words", () => {
    expect(describeAnnotatorMean(1)).toBe("All 3 annotators marked it achieved");
    expect(describeAnnotatorMean(0)).toBe("No annotator marked it achieved");
    expect(describeAnnotatorMean(2 / 3)).toBe("2 of 3 annotators marked it achieved (annotators disagreed)");
    expect(describeAnnotatorMean(1 / 3)).toBe("1 of 3 annotators marked it achieved (annotators disagreed)");
  });
});

describe("isCompleteJudgement", () => {
  it("requires a choice for all three criteria", () => {
    const partial: (Judgement | null)[] = [1, null, 0];
    expect(isCompleteJudgement(partial)).toBe(false);
    expect(isCompleteJudgement([1, 0, 0])).toBe(true);
    expect(isCompleteJudgement([1, 0])).toBe(false);
  });
});
