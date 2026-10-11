import { describe, expect, it } from "vitest"
import { SIGNAL_FEATURE_DEFINITIONS } from "./signal-feature-definitions"

describe("signal feature definitions", () => {
  it("explain every descriptive feature shown in the FiSaV workspace, once each", () => {
    const shown = ["Mean", "Median", "Standard deviation", "RMS", "Peak-to-peak", "Exact zero fraction", "Adjacent repeats"]
    expect(SIGNAL_FEATURE_DEFINITIONS.map(item => item.label)).toEqual(shown)
  })

  it("state the population standard deviation and the non-detrended RMS used by the API", () => {
    const byLabel = Object.fromEntries(SIGNAL_FEATURE_DEFINITIONS.map(item => [item.label, item]))
    expect(byLabel["Standard deviation"].formula).toContain("/ N")
    expect(byLabel.RMS.note).toMatch(/not detrended/i)
  })
})
