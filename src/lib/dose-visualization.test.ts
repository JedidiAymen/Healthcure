import { describe, expect, it } from 'vitest'
import {
  clampDoseIndex,
  crosshairForPlane,
  DOSE_GRID_SIZE,
  renderDoseSlicePixels,
  slicePointFromCanvasPosition,
  voxelFromPlaneSelection,
  voxelWithAxisIndex,
  type DoseVoxel,
} from './dose-visualization'

describe('DoseTwin linked voxel coordinates', () => {
  const voxel: DoseVoxel = [11, 22, 33]

  it('maps selected row and column to the two free coordinates on every plane', () => {
    expect(voxelFromPlaneSelection(voxel, 0, 44, 55)).toEqual([11, 44, 55])
    expect(voxelFromPlaneSelection(voxel, 1, 44, 55)).toEqual([44, 22, 55])
    expect(voxelFromPlaneSelection(voxel, 2, 44, 55)).toEqual([44, 55, 33])
  })

  it('places the linked crosshair at the same voxel in each plane orientation', () => {
    expect(crosshairForPlane(0, voxel)).toEqual({ row: 22, column: 33 })
    expect(crosshairForPlane(1, voxel)).toEqual({ row: 11, column: 33 })
    expect(crosshairForPlane(2, voxel)).toEqual({ row: 11, column: 22 })
  })

  it('clamps axis-index controls to whole grid indices and preserves the other coordinates', () => {
    expect(voxelWithAxisIndex(voxel, 1, 44.6)).toEqual([11, 45, 33])
    expect(voxelWithAxisIndex(voxel, 2, 999)).toEqual([11, 22, 127])
    expect(voxelWithAxisIndex(voxel, 0, -1)).toEqual([0, 22, 33])
    expect(clampDoseIndex(Number.NaN)).toBe(0)
  })

  it('converts pointer positions to bounded row/column indices, including the far edge', () => {
    const rect = { left: 10, top: 20, width: 128, height: 128 }
    expect(slicePointFromCanvasPosition(10, 20, rect)).toEqual({ row: 0, column: 0 })
    expect(slicePointFromCanvasPosition(74, 84, rect)).toEqual({ row: 64, column: 64 })
    expect(slicePointFromCanvasPosition(138, 148, rect)).toEqual({ row: 127, column: 127 })
    expect(slicePointFromCanvasPosition(9, 19, rect)).toEqual({ row: 0, column: 0 })
    expect(slicePointFromCanvasPosition(20, 30, { ...rect, width: 0 })).toBeNull()
  })

  it('maps pointer positions after anisotropic display sizing, zoom and pan', () => {
    const portraitPlane = { left: 318, top: 74, width: 320, height: 578 }
    const zoomedPannedPlane = { left: 410, top: 162, width: 480, height: 867 }
    expect(slicePointFromCanvasPosition(478, 363, portraitPlane)).toEqual({ row: 64, column: 64 })
    expect(slicePointFromCanvasPosition(650, 595.5, zoomedPannedPlane)).toEqual({ row: 64, column: 64 })
  })

  it('keeps dose, ROI boundary and CT display layers independently controllable', () => {
    const ct = new Float32Array(DOSE_GRID_SIZE ** 2).fill(0.5)
    const dose = new Float32Array(DOSE_GRID_SIZE ** 2)
    const roi = new Float32Array(DOSE_GRID_SIZE ** 2)
    const center = 64 * DOSE_GRID_SIZE + 64
    dose[center] = 0.5
    roi[center] = 1
    const pixel = (values: Uint8ClampedArray, index: number) => Array.from(values.slice(index * 4, index * 4 + 4))

    const ctOnly = renderDoseSlicePixels(ct, dose, roi, { showDose: false, showRoi: false, opacity: 0.56, doseMaxGy: 1, ctRange: [0, 1] })
    expect(pixel(ctOnly, center)).toEqual([103, 103, 103, 255])
    expect(pixel(renderDoseSlicePixels(ct, dose, roi, { showDose: true, showRoi: false, opacity: 0, doseMaxGy: 1, ctRange: [0, 1] }), center)).toEqual(pixel(ctOnly, center))
    expect(pixel(renderDoseSlicePixels(ct, dose, roi, { showDose: true, showRoi: false, opacity: 0.56, doseMaxGy: 1, ctRange: [0, 1] }), center)).toEqual([104, 130, 132, 255])
    expect(pixel(renderDoseSlicePixels(ct, dose, roi, { showDose: false, showRoi: true, opacity: 0.56, doseMaxGy: 1, ctRange: [0, 1] }), center)).toEqual([127, 245, 219, 255])
  })

  it('marks the ROI contour while leaving interior ROI pixels on the source layer', () => {
    const ct = new Float32Array(DOSE_GRID_SIZE ** 2).fill(0.5)
    const dose = new Float32Array(DOSE_GRID_SIZE ** 2)
    const roi = new Float32Array(DOSE_GRID_SIZE ** 2)
    for (let y = 63; y <= 65; y++) for (let x = 63; x <= 65; x++) roi[y * DOSE_GRID_SIZE + x] = 1
    const pixels = renderDoseSlicePixels(ct, dose, roi, { showDose: false, showRoi: true, opacity: 1, doseMaxGy: 1, ctRange: [0, 1] })
    expect(Array.from(pixels.slice((64 * DOSE_GRID_SIZE + 64) * 4, (64 * DOSE_GRID_SIZE + 64) * 4 + 3))).toEqual([103, 103, 103])
    expect(Array.from(pixels.slice((64 * DOSE_GRID_SIZE + 63) * 4, (64 * DOSE_GRID_SIZE + 63) * 4 + 3))).toEqual([127, 245, 219])
  })

  it('rejects incomplete source planes instead of producing a partial image', () => {
    expect(() => renderDoseSlicePixels([0], [0], [0], { showDose: true, showRoi: true, opacity: 0.5 })).toThrow(RangeError)
  })

  it('keeps the same Gy value on one stable color when neighboring slices have different maxima', () => {
    const ct = new Float32Array(DOSE_GRID_SIZE ** 2).fill(0.5)
    const empty = new Float32Array(DOSE_GRID_SIZE ** 2)
    const first = new Float32Array(DOSE_GRID_SIZE ** 2)
    const second = new Float32Array(DOSE_GRID_SIZE ** 2)
    const center = 64 * DOSE_GRID_SIZE + 64
    first[center] = 40
    second[center] = 40
    second[center + 1] = 70
    const layers = { showDose: true, showRoi: false, opacity: 0.7, doseMaxGy: 80, ctRange: [0, 1] as [number, number] }
    const imageA = renderDoseSlicePixels(ct, first, empty, layers)
    const imageB = renderDoseSlicePixels(ct, second, empty, layers)
    expect(Array.from(imageA.slice(center * 4, center * 4 + 3))).toEqual(Array.from(imageB.slice(center * 4, center * 4 + 3)))
  })

  it('draws selected structure boundaries using independent stable colors', () => {
    const ct = new Float32Array(DOSE_GRID_SIZE ** 2).fill(0.5)
    const dose = new Float32Array(DOSE_GRID_SIZE ** 2)
    const fallback = new Float32Array(DOSE_GRID_SIZE ** 2)
    const first = new Float32Array(DOSE_GRID_SIZE ** 2)
    const second = new Float32Array(DOSE_GRID_SIZE ** 2)
    for (let y = 10; y <= 12; y++) for (let x = 10; x <= 12; x++) first[y * DOSE_GRID_SIZE + x] = 1
    for (let y = 20; y <= 22; y++) for (let x = 20; x <= 22; x++) second[y * DOSE_GRID_SIZE + x] = 1
    const image = renderDoseSlicePixels(ct, dose, fallback, { showDose: false, showRoi: true, opacity: 1, roiLayers: [
      { values: first, color: [255, 0, 0] }, { values: second, color: [0, 0, 255] },
    ] })
    expect(Array.from(image.slice((10 * DOSE_GRID_SIZE + 11) * 4, (10 * DOSE_GRID_SIZE + 11) * 4 + 3))).toEqual([255, 0, 0])
    expect(Array.from(image.slice((20 * DOSE_GRID_SIZE + 21) * 4, (20 * DOSE_GRID_SIZE + 21) * 4 + 3))).toEqual([0, 0, 255])
  })
})
