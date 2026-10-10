import { describe, expect, it } from 'vitest'
import { formatSourceTime, sameSourceSampleTime } from './fistula-time'

describe('FiSaV source-time precision', () => {
  it('formats time finely enough to distinguish adjacent samples', () => {
    const sampleRate = 10_000
    expect(formatSourceTime(1.2345, sampleRate)).toBe('1.234500')
    expect(formatSourceTime(1.2346, sampleRate)).not.toBe(formatSourceTime(1.2345, sampleRate))

    const irregularRate = 44_100
    expect(formatSourceTime(1 / irregularRate, irregularRate)).not.toBe('0.0000')
  })

  it('treats windows as the same only when they resolve within half a source sample', () => {
    expect(sameSourceSampleTime(2, 2.0001, 10_000)).toBe(false)
    expect(sameSourceSampleTime(2, 2.00001, 10_000)).toBe(true)
    expect(sameSourceSampleTime(2, 2.00003, 44_100)).toBe(false)
    expect(sameSourceSampleTime(2, 2, 0)).toBe(false)
  })
})
