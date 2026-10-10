import type { SignalFilterQuery } from "./api"

// Same rules as the server, so learners see the problem before a request is sent.
export function validateFilterInput(filter: SignalFilterQuery, sampleRateHz: number): string | null {
  const nyquist = sampleRateHz / 2
  if (filter.mode === "bandpass") {
    if (!(filter.low_hz > 0)) return "A band-pass filter needs a positive low cutoff"
    if (filter.low_hz >= filter.high_hz) return "The low cutoff must be below the high cutoff"
    if (filter.high_hz >= nyquist) return `The high cutoff must be below Nyquist (${nyquist} Hz), half the sample rate`
    return null
  }
  if (!(filter.notch_hz > 0 && filter.notch_hz < nyquist)) return `The notch frequency must be between 0 and the Nyquist frequency (${nyquist} Hz)`
  if (!(filter.q > 0)) return "The notch quality factor must be positive"
  return null
}

type WindowLike = { start_sec: number; samples: { time_sec: number; value: number }[] }
export type OverlayPoint = { t: number; a?: number; b?: number }

// Two windows from the same recording and channel, aligned on time since each window start.
export function overlayWindows(a: WindowLike, b: WindowLike): OverlayPoint[] {
  const points = new Map<number, OverlayPoint>()
  const add = (window: WindowLike, key: "a" | "b") => {
    for (const sample of window.samples) {
      const t = Math.round((sample.time_sec - window.start_sec) * 1e6) / 1e6
      const point = points.get(t) ?? { t }
      point[key] = sample.value
      points.set(t, point)
    }
  }
  add(a, "a")
  add(b, "b")
  return [...points.values()].sort((left, right) => left.t - right.t)
}
