import { describe, expect, it } from "vitest";
import { cvsVoteSummary, filtersFromSearch, filtersToSearch } from "./surgical-frame-filters";

describe("cvsVoteSummary", () => {
  it("shows each criterion as annotator votes out of three", () => {
    expect(cvsVoteSummary([1, 2 / 3, 0])).toBe("C1 3/3 · C2 2/3 · C3 0/3");
    expect(cvsVoteSummary([])).toBe("No CVS label");
  });
});

describe("filtersToSearch / filtersFromSearch", () => {
  it("round-trips filters through URL parameters and drops empty values", () => {
    const filters = { split: "val" as const, category: "tool", agreement: "disputed" as const, criterion: "cystic_plate" as const, min_value: 0.5 };
    const search = filtersToSearch(filters);
    expect(search.get("frames_split")).toBe("val");
    expect(search.has("frames_max_value")).toBe(false);
    expect(filtersFromSearch(search)).toEqual(filters);
  });

  it("ignores unknown or invalid values from a shared URL", () => {
    const parsed = filtersFromSearch(new URLSearchParams("frames_split=nope&frames_agreement=maybe&frames_min_value=7&frames_criterion=bad"));
    expect(parsed).toEqual({});
  });
});
