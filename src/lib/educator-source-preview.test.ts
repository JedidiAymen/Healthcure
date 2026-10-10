import { describe, expect, it } from "vitest";
import type { CaseRecord } from "./api";
import { getEducatorSourcePreviewAccess } from "./educator-source-preview";

const source = (overrides: Partial<CaseRecord> = {}): CaseRecord => ({
  id: "fisav:pat001",
  module: "fistulaguard",
  dataset_id: "FiSaV",
  source_case_id: "pat001",
  reference_kind: "research",
  status: "ready",
  label: "FiSaV pat001",
  ...overrides,
});

const evidence = (id = "fisav:pat001") => ({ case: { id } });

describe("educator source preview access", () => {
  it("only allows a ready source with its matching case record", () => {
    expect(getEducatorSourcePreviewAccess(source(), evidence())).toEqual({ state: "ready" });
    expect(getEducatorSourcePreviewAccess(source(), evidence("fisav:pat002")).state).toBe("unavailable");
  });

  it("does not fetch blocked, synthetic, or unselected sources", () => {
    expect(getEducatorSourcePreviewAccess(null, null).state).toBe("unselected");
    expect(getEducatorSourcePreviewAccess(source({ status: "blocked" }), evidence()).state).toBe("blocked");
    expect(getEducatorSourcePreviewAccess(source({ reference_kind: "synthetic-test" }), evidence()).state).toBe("synthetic");
  });
});
