export function formatSourceTime(seconds: number, sampleRateHz: number): string {
  const safeRate = Number.isFinite(sampleRateHz) && sampleRateHz > 0 ? sampleRateHz : 1
  const decimals = Math.min(10, Math.max(4, Math.ceil(Math.log10(safeRate)) + 2))
  return seconds.toFixed(decimals)
}

export function sameSourceSampleTime(leftSeconds: number, rightSeconds: number, sampleRateHz: number): boolean {
  const tolerance = Number.isFinite(sampleRateHz) && sampleRateHz > 0 ? 0.5 / sampleRateHz : 0
  return Math.abs(leftSeconds - rightSeconds) < tolerance
}
