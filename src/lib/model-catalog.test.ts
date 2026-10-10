import { describe, expect, it } from "vitest";
import type { ModelRecord } from "./api";
import { filterModelCatalog } from "./model-catalog";

const records: ModelRecord[] = [
  {
    id: "ready-dose", module: "dosetwin", name: "Dose Reference Calculator",
    operation_ids: ["dose.summary"], upstream_url: "https://example.test/dose",
    source_revision: "rev-1", source_license: "CC BY 4.0", readiness: "ready",
    details: "Source-derived dose statistics.",
  },
  {
    id: "gated-cvs", module: "surgivision", name: "CVS-AdaptNet",
    operation_ids: ["cvs.inference"], upstream_url: "https://example.test/cvs",
    source_revision: "rev-2", source_license: "Checkpoint terms require review", readiness: "blocked",
    details: "Single-frame inference remains gated.",
  },
  {
    id: "unverified-signal", module: "fistulaguard", name: "Signal Explorer",
    operation_ids: ["signal.inspect"], upstream_url: "https://example.test/signal",
    source_revision: "rev-3", source_license: "Research use", readiness: "unverified",
    details: "Inspect recorded waveforms.",
  },
];

describe("filterModelCatalog", () => {
  it("searches registry names, operations, license terms, and details", () => {
    expect(filterModelCatalog(records, { module: "all", readiness: "all", search: "cvs.inference" }).map((x) => x.id)).toEqual(["gated-cvs"]);
    expect(filterModelCatalog(records, { module: "all", readiness: "all", search: "cc by 4.0" }).map((x) => x.id)).toEqual(["ready-dose"]);
    expect(filterModelCatalog(records, { module: "all", readiness: "all", search: "single-frame" }).map((x) => x.id)).toEqual(["gated-cvs"]);
  });

  it("combines specialty and readiness filters using registry readiness only", () => {
    expect(filterModelCatalog(records, { module: "all", readiness: "ready", search: "" }).map((x) => x.id)).toEqual(["ready-dose"]);
    expect(filterModelCatalog(records, { module: "all", readiness: "gated", search: "" }).map((x) => x.id)).toEqual(["gated-cvs", "unverified-signal"]);
    expect(filterModelCatalog(records, { module: "surgivision", readiness: "gated", search: "" }).map((x) => x.id)).toEqual(["gated-cvs"]);
    expect(filterModelCatalog(records, { module: "surgivision", readiness: "ready", search: "" })).toEqual([]);
  });
});
