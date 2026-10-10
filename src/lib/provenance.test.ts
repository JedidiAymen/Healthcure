import { describe, expect, it } from "vitest";
import { PROVENANCE, provenanceCopy } from "./provenance";

describe("provenance taxonomy", () => {
  it("covers the four kinds, each with a what-this-does-not-mean note", () => {
    expect(Object.keys(PROVENANCE).sort()).toEqual(["ARCHIVED_PREDICTION", "IN_APP_MODEL_INFERENCE", "RULE_BASED_METHOD", "SOURCE_BENCHMARK"]);
    for (const entry of Object.values(PROVENANCE)) expect(entry.doesNotMean.length).toBeGreaterThan(20);
  });

  it("never lets an archived prediction read as our inference", () => {
    expect(provenanceCopy("ARCHIVED_PREDICTION").doesNotMean).toMatch(/Not MEDFORGE inference/);
  });
});
