import { describe, expect, it } from 'vitest'
import { dosePlaneAspectRatio } from './comparison-geometry'

describe('DoseTwin comparison plane geometry', () => {
  const spacing: [number, number, number] = [5.422, 5.422, 3]

  it('preserves the source voxel aspect ratio for each research array plane', () => {
    expect(dosePlaneAspectRatio(0, spacing)).toBeCloseTo(3 / 5.422, 8)
    expect(dosePlaneAspectRatio(1, spacing)).toBeCloseTo(3 / 5.422, 8)
    expect(dosePlaneAspectRatio(2, spacing)).toBe(1)
  })

  it('falls back to a square plane when spacing is invalid', () => {
    expect(dosePlaneAspectRatio(0, [5.422, 0, 3])).toBe(1)
    expect(dosePlaneAspectRatio(2, [5.422, Number.NaN, 3])).toBe(1)
  })
})
