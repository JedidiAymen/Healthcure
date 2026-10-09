export const DOSE_GRID_SIZE = 128

export type DoseAxis = 0 | 1 | 2
export type DoseVoxel = [number, number, number]
export type SlicePoint = { row: number; column: number }
export type CanvasRect = { left: number; top: number; width: number; height: number }

export type DoseSliceLayers = {
  showDose: boolean
  showRoi: boolean
  opacity: number
}

export function clampDoseIndex(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(Math.min(DOSE_GRID_SIZE - 1, Math.max(0, value)))
}

export function voxelFromPlaneSelection(
  current: DoseVoxel,
  axis: DoseAxis,
  row: number,
  column: number,
): DoseVoxel {
  const next: DoseVoxel = [...current]
  if (axis === 0) {
    next[1] = clampDoseIndex(row)
    next[2] = clampDoseIndex(column)
  } else if (axis === 1) {
    next[0] = clampDoseIndex(row)
    next[2] = clampDoseIndex(column)
  } else {
    next[0] = clampDoseIndex(row)
    next[1] = clampDoseIndex(column)
  }
  return next
}

export function voxelWithAxisIndex(current: DoseVoxel, axis: DoseAxis, index: number): DoseVoxel {
  const next: DoseVoxel = [...current]
  next[axis] = clampDoseIndex(index)
  return next
}

export function crosshairForPlane(axis: DoseAxis, voxel: DoseVoxel): SlicePoint {
  if (axis === 0) return { row: voxel[1], column: voxel[2] }
  if (axis === 1) return { row: voxel[0], column: voxel[2] }
  return { row: voxel[0], column: voxel[1] }
}

export function slicePointFromCanvasPosition(
  clientX: number,
  clientY: number,
  rect: CanvasRect,
): SlicePoint | null {
  if (!(rect.width > 0) || !(rect.height > 0)) return null
  return {
    column: clampDoseIndex(Math.floor(((clientX - rect.left) / rect.width) * DOSE_GRID_SIZE)),
    row: clampDoseIndex(Math.floor(((clientY - rect.top) / rect.height) * DOSE_GRID_SIZE)),
  }
}

export function renderDoseSlicePixels(
  ctValues: ArrayLike<number>,
  doseValues: ArrayLike<number>,
  roiValues: ArrayLike<number>,
  layers: DoseSliceLayers,
): Uint8ClampedArray {
  const pixelCount = DOSE_GRID_SIZE * DOSE_GRID_SIZE
  if (ctValues.length !== pixelCount || doseValues.length !== pixelCount || roiValues.length !== pixelCount) {
    throw new RangeError(`Expected three ${DOSE_GRID_SIZE}×${DOSE_GRID_SIZE} dose planes`)
  }

  const ct = Array.from(ctValues)
  const sortedCt = [...ct].sort((a, b) => a - b)
  const low = sortedCt[Math.floor(sortedCt.length * 0.02)] ?? 0
  const high = sortedCt[Math.floor(sortedCt.length * 0.98)] ?? 1
  const ctSpan = Math.max(1e-8, high - low)
  const positiveDose = Array.from(doseValues).filter(value => value > 0).sort((a, b) => a - b)
  const maxDose = positiveDose[Math.floor(positiveDose.length * 0.98)] ?? 1
  const opacity = Math.min(1, Math.max(0, Number.isFinite(layers.opacity) ? layers.opacity : 0))
  const pixels = new Uint8ClampedArray(pixelCount * 4)

  for (let y = 0; y < DOSE_GRID_SIZE; y++) {
    for (let x = 0; x < DOSE_GRID_SIZE; x++) {
      const index = y * DOSE_GRID_SIZE + x
      const gray = Math.round(Math.max(0, Math.min(1, (ct[index] - low) / ctSpan)) * 205)
      const doseFraction = Math.max(0, Math.min(1, doseValues[index] / maxDose))
      let red = gray
      let green = gray
      let blue = gray

      if (layers.showDose && doseValues[index] > 0) {
        const blend = opacity * Math.min(0.94, 0.34 + doseFraction * 0.56)
        red = Math.round(red * (1 - blend) + (23 + 218 * doseFraction) * blend)
        green = Math.round(green * (1 - blend) + (105 + 140 * doseFraction) * blend)
        blue = Math.round(blue * (1 - blend) + (137 - 86 * doseFraction) * blend)
      }

      if (layers.showRoi && roiValues[index] > 0.5) {
        const edge = x === 0 || y === 0 || x === DOSE_GRID_SIZE - 1 || y === DOSE_GRID_SIZE - 1
          || roiValues[index - 1] < 0.5 || roiValues[index + 1] < 0.5
          || roiValues[index - DOSE_GRID_SIZE] < 0.5 || roiValues[index + DOSE_GRID_SIZE] < 0.5
        if (edge) {
          red = 127
          green = 245
          blue = 219
        }
      }

      const offset = index * 4
      pixels[offset] = red
      pixels[offset + 1] = green
      pixels[offset + 2] = blue
      pixels[offset + 3] = 255
    }
  }

  return pixels
}
