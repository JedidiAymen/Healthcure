import { describe, expect, it } from "vitest";
import { isAssignmentStartClosed } from "./academy-assignment-state";

describe("Academy assignment start status", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");

  it("closes a not-started assignment when its due time has passed", () => {
    expect(isAssignmentStartClosed("not_started", "2026-10-11T11:59:59Z", now)).toBe(true);
  });

  it("keeps an assignment available until its exact due time", () => {
    expect(isAssignmentStartClosed("not_started", "2026-10-11T12:00:01Z", now)).toBe(false);
    expect(isAssignmentStartClosed("not_started", "2026-10-11T12:00:00Z", now)).toBe(true);
  });

  it("does not close started, submitted, or reviewed work", () => {
    for (const state of ["in_progress", "submitted", "reviewed"] as const) {
      expect(isAssignmentStartClosed(state, "2026-10-10T12:00:00Z", now)).toBe(false);
    }
  });

  it("keeps assignments without a usable due date open rather than guessing", () => {
    expect(isAssignmentStartClosed("not_started", null, now)).toBe(false);
    expect(isAssignmentStartClosed("not_started", "unrecognized", now)).toBe(false);
  });
});
