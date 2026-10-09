import { describe, expect, it } from 'vitest'
import {
  parseDoseWorkspacePreferences,
  parseSignalWorkspacePreferences,
  parseSurgicalViewPreferences,
} from './workspace-preferences'

describe('DoseTwin workspace preferences', () => {
  const saved = {
    case_id: 'openkbp:pt_201',
    voxel: [81, 63, 47],
    roi: 'Brainstem',
    dose_overlay: true,
    roi_overlay: false,
    dose_opacity: 0.65,
  }

  it('restores a valid case-scoped voxel and display state', () => {
    expect(parseDoseWorkspacePreferences('openkbp:pt_201', saved)).toEqual(saved)
  })

  it('rejects state belonging to another case or invalid array coordinates', () => {
    expect(parseDoseWorkspacePreferences('openkbp:other', saved)).toBeNull()
    expect(parseDoseWorkspacePreferences('openkbp:pt_201', { ...saved, voxel: [128, 2, 3] })).toBeNull()
    expect(parseDoseWorkspacePreferences('openkbp:pt_201', { ...saved, voxel: [1.5, 2, 3] })).toBeNull()
  })

  it('rejects an unknown ROI and an opacity outside the display range', () => {
    expect(parseDoseWorkspacePreferences('openkbp:pt_201', { ...saved, roi: 'InventedROI' })).toBeNull()
    expect(parseDoseWorkspacePreferences('openkbp:pt_201', { ...saved, dose_opacity: 1.1 })).toBeNull()
  })
})

describe('SurgiVision view preferences', () => {
  const saved = {
    frame_id: 'endoscapes:val:125_13175',
    show_boxes: true,
    zoom: 1.75,
    selected_annotation_id: 6,
    pan_ratio: { x: -0.25, y: 0.4 },
  }

  it('restores zoom, annotation and viewport position for the same frame', () => {
    expect(parseSurgicalViewPreferences('endoscapes:val:125_13175', saved)).toEqual({
      show_boxes: true,
      zoom: 1.75,
      selected_annotation_id: 6,
      pan_ratio: { x: -0.25, y: 0.4 },
    })
  })

  it('rejects another frame and out-of-range zoom or pan values', () => {
    expect(parseSurgicalViewPreferences('endoscapes:train:4_26200', saved)).toBeNull()
    expect(parseSurgicalViewPreferences('endoscapes:val:125_13175', { ...saved, zoom: 4 })).toBeNull()
    expect(parseSurgicalViewPreferences('endoscapes:val:125_13175', { ...saved, pan_ratio: { x: 3, y: 0 } })).toBeNull()
    expect(parseSurgicalViewPreferences('endoscapes:val:125_13175', { ...saved, pan_ratio: null })).toBeNull()
  })

  it('accepts older frame-keyed preferences without a normalized pan value', () => {
    const olderState: Partial<typeof saved> = {
      frame_id: saved.frame_id,
      show_boxes: saved.show_boxes,
      zoom: saved.zoom,
      selected_annotation_id: saved.selected_annotation_id,
    }
    expect(parseSurgicalViewPreferences('endoscapes:val:125_13175', olderState)?.pan_ratio).toEqual({ x: 0, y: 0 })
  })
})

describe('FistulaGuard workspace preferences', () => {
  const saved = { record_id: 'pat011', channel: 'raw PZT2', start_sec: 18.5, duration_sec: 10 }

  it('restores a valid record-scoped signal window', () => {
    expect(parseSignalWorkspacePreferences('fisav:pat011', saved)).toEqual(saved)
  })

  it('rejects state from another record, invalid channels and invalid windows', () => {
    expect(parseSignalWorkspacePreferences('pat012', saved)).toBeNull()
    expect(parseSignalWorkspacePreferences('pat011', { ...saved, channel: 'occlusion' })).toBeNull()
    expect(parseSignalWorkspacePreferences('pat011', { ...saved, start_sec: -1 })).toBeNull()
    expect(parseSignalWorkspacePreferences('pat011', { ...saved, duration_sec: 7 })).toBeNull()
    expect(parseSignalWorkspacePreferences('patx', saved)).toBeNull()
  })
})
