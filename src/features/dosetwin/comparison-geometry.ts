import type { DoseAxis } from '@/lib/dose-visualization'

export function dosePlaneAspectRatio(axis: DoseAxis, spacingMm: [number, number, number]): number {
  const rowAxis = axis === 0 ? 1 : 0
  const columnAxis = axis === 2 ? 1 : 2
  const rowSpacing = spacingMm[rowAxis]
  const columnSpacing = spacingMm[columnAxis]

  if (!Number.isFinite(rowSpacing) || !Number.isFinite(columnSpacing) || rowSpacing <= 0 || columnSpacing <= 0) {
    return 1
  }

  return columnSpacing / rowSpacing
}
