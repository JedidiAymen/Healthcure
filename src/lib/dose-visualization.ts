export const DOSE_GRID_SIZE = 128

export type DoseAxis = 0 | 1 | 2
export type DoseVoxel = [number, number, number]
export type SlicePoint = { row: number; column: number }
export type CanvasRect = { left: number; top: number; width: number; height: number }

export type DoseSliceLayers = {
  showDose: boolean
  showRoi: boolean
  opacity: number
  doseMaxGy?: number
  ctRange?: [number, number] | null
  roiLayers?: { values: ArrayLike<number>; color: [number, number, number] }[]
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
    // Pointer coordinates describe a continuous point over a raster. Select the
    // nearest voxel center so sub-pixel rounding at the transformed canvas edge
    // does not move a deliberate selection into the preceding voxel.
    column: clampDoseIndex(Math.round(((clientX - rect.left) / rect.width) * DOSE_GRID_SIZE)),
    row: clampDoseIndex(Math.round(((clientY - rect.top) / rect.height) * DOSE_GRID_SIZE)),
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
  const low = layers.ctRange?.[0] ?? sortedCt[Math.floor(sortedCt.length * 0.02)] ?? 0
  const high = layers.ctRange?.[1] ?? sortedCt[Math.floor(sortedCt.length * 0.98)] ?? 1
  const ctSpan = Math.max(1e-8, high - low)
  const maxDose = Number.isFinite(layers.doseMaxGy) && (layers.doseMaxGy ?? 0) > 0 ? layers.doseMaxGy! : 0
  const opacity = Math.min(1, Math.max(0, Number.isFinite(layers.opacity) ? layers.opacity : 0))
  const roiLayers = layers.roiLayers?.length
    ? layers.roiLayers
    : [{ values: roiValues, color: [127, 245, 219] as [number, number, number] }]
  if (roiLayers.some(layer => layer.values.length !== pixelCount)) throw new RangeError(`Expected each ROI plane to contain ${pixelCount} voxels`)
  const pixels = new Uint8ClampedArray(pixelCount * 4)

  const doseColor = (fraction: number): [number, number, number] => {
    const stops: [number, [number, number, number]][] = [
      [0, [58, 77, 207]],
      [0.38, [32, 157, 190]],
      [0.72, [239, 139, 91]],
      [1, [255, 222, 134]],
    ]
    const position = Math.max(0, Math.min(1, fraction))
    const upperIndex = Math.max(1, stops.findIndex(([point]) => point >= position))
    const [fromPoint, fromColor] = stops[upperIndex - 1]
    const [toPoint, toColor] = stops[upperIndex]
    const blend = (position - fromPoint) / Math.max(1e-8, toPoint - fromPoint)
    return [0, 1, 2].map(channel => Math.round(fromColor[channel] * (1 - blend) + toColor[channel] * blend)) as [number, number, number]
  }

  for (let y = 0; y < DOSE_GRID_SIZE; y++) {
    for (let x = 0; x < DOSE_GRID_SIZE; x++) {
      const index = y * DOSE_GRID_SIZE + x
      const gray = Math.round(Math.max(0, Math.min(1, (ct[index] - low) / ctSpan)) * 205)
      const doseFraction = maxDose > 0 ? Math.max(0, Math.min(1, doseValues[index] / maxDose)) : 0
      let red = gray
      let green = gray
      let blue = gray

      if (layers.showDose && maxDose > 0 && doseValues[index] > 0) {
        const blend = opacity
        const [doseRed, doseGreen, doseBlue] = doseColor(doseFraction)
        red = Math.round(red * (1 - blend) + doseRed * blend)
        green = Math.round(green * (1 - blend) + doseGreen * blend)
        blue = Math.round(blue * (1 - blend) + doseBlue * blend)
      }

      if (layers.showRoi) {
        for (const layer of roiLayers) {
          const mask = layer.values
          if (mask[index] <= 0.5) continue
          const edge = x === 0 || y === 0 || x === DOSE_GRID_SIZE - 1 || y === DOSE_GRID_SIZE - 1
            || mask[index - 1] < 0.5 || mask[index + 1] < 0.5
            || mask[index - DOSE_GRID_SIZE] < 0.5 || mask[index + DOSE_GRID_SIZE] < 0.5
          if (edge) [red, green, blue] = layer.color
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
