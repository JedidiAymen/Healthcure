import { describe, expect, it } from "vitest";
import { overlayWindows, validateFilterInput } from "./signal-tools";

describe("validateFilterInput", () => {
  it("mirrors the server rules with plain messages", () => {
    expect(validateFilterInput({ mode: "bandpass", low_hz: 20, high_hz: 800 }, 10000)).toBeNull();
    expect(validateFilterInput({ mode: "bandpass", low_hz: 800, high_hz: 20 }, 10000)).toMatch(/low cutoff must be below/);
    expect(validateFilterInput({ mode: "bandpass", low_hz: 20, high_hz: 6000 }, 10000)).toMatch(/Nyquist \(5000 Hz\)/);
    expect(validateFilterInput({ mode: "notch", notch_hz: 50, q: 30 }, 10000)).toBeNull();
    expect(validateFilterInput({ mode: "notch", notch_hz: 0, q: 30 }, 10000)).toMatch(/notch frequency/);
    expect(validateFilterInput({ mode: "notch", notch_hz: 50, q: 0 }, 10000)).toMatch(/quality factor/);
  });
});

describe("overlayWindows", () => {
  it("puts two windows on one relative time axis", () => {
    const a = { start_sec: 10, samples: [{ time_sec: 10, value: 1 }, { time_sec: 10.5, value: 2 }] };
    const b = { start_sec: 40, samples: [{ time_sec: 40, value: 5 }, { time_sec: 40.25, value: 6 }] };
    expect(overlayWindows(a, b)).toEqual([
      { t: 0, a: 1, b: 5 },
      { t: 0.25, b: 6 },
      { t: 0.5, a: 2 },
    ]);
  });
});
