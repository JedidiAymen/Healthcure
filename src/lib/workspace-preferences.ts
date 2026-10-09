export const DOSE_ROIS = [
  'Brainstem', 'SpinalCord', 'RightParotid', 'LeftParotid', 'Esophagus',
  'Larynx', 'Mandible', 'PTV56', 'PTV63', 'PTV70',
] as const

export const FISTULA_CHANNELS = ['ECG', 'raw PZT1', 'raw PZT2', 'raw PZT3', 'raw PZT4'] as const

export type DoseWorkspacePreferences = {
  case_id: string
  voxel: [number, number, number]
  roi: typeof DOSE_ROIS[number]
  dose_overlay: boolean
  roi_overlay: boolean
  dose_opacity: number
}

export type SurgicalViewPreferences = {
  show_boxes: boolean
  zoom: number
  selected_annotation_id: number | null
  pan_ratio: { x: number; y: number }
}

export type SignalWorkspacePreferences = {
  record_id: string
  channel: typeof FISTULA_CHANNELS[number]
  start_sec: number
  duration_sec: number
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function parseDoseWorkspacePreferences(caseId: string, value: unknown): DoseWorkspacePreferences | null {
  const state = objectValue(value)
  if (!state || state.case_id !== caseId || !Array.isArray(state.voxel) || state.voxel.length !== 3
      || !state.voxel.every(index => Number.isInteger(index) && Number(index) >= 0 && Number(index) <= 127)
      || typeof state.roi !== 'string' || !DOSE_ROIS.includes(state.roi as typeof DOSE_ROIS[number])
      || typeof state.dose_overlay !== 'boolean' || typeof state.roi_overlay !== 'boolean'
      || typeof state.dose_opacity !== 'number' || !Number.isFinite(state.dose_opacity)
      || state.dose_opacity < 0 || state.dose_opacity > 1) return null
  return {
    case_id: caseId,
    voxel: state.voxel as [number, number, number],
    roi: state.roi as typeof DOSE_ROIS[number],
    dose_overlay: state.dose_overlay,
    roi_overlay: state.roi_overlay,
    dose_opacity: state.dose_opacity,
  }
}

export function parseSurgicalViewPreferences(frameId: string, value: unknown): SurgicalViewPreferences | null {
  const state = objectValue(value)
  if (!state || (state.frame_id !== undefined && state.frame_id !== frameId)
      || typeof state.show_boxes !== 'boolean' || typeof state.zoom !== 'number'
      || !Number.isFinite(state.zoom) || state.zoom < 1 || state.zoom > 3
      || !(state.selected_annotation_id === undefined || state.selected_annotation_id === null
        || (typeof state.selected_annotation_id === 'number' && Number.isInteger(state.selected_annotation_id) && state.selected_annotation_id >= 0))) return null
  const pan = state.pan_ratio === undefined ? { x: 0, y: 0 } : objectValue(state.pan_ratio)
  if (!pan) return null
  if (typeof pan.x !== 'number' || !Number.isFinite(pan.x) || Math.abs(pan.x) > 2
      || typeof pan.y !== 'number' || !Number.isFinite(pan.y) || Math.abs(pan.y) > 2) return null
  return {
    show_boxes: state.show_boxes,
    zoom: state.zoom,
    selected_annotation_id: state.selected_annotation_id == null ? null : state.selected_annotation_id as number,
    pan_ratio: { x: pan.x, y: pan.y },
  }
}

export function parseSignalWorkspacePreferences(recordId: string, value: unknown): SignalWorkspacePreferences | null {
  const state = objectValue(value)
  const sourceId = recordId.startsWith('fisav:') ? recordId.slice('fisav:'.length) : recordId
  if (!state || !/^pat\d{3}$/.test(sourceId) || (state.record_id !== undefined && state.record_id !== sourceId)
      || typeof state.channel !== 'string' || !FISTULA_CHANNELS.includes(state.channel as typeof FISTULA_CHANNELS[number])
      || typeof state.start_sec !== 'number' || !Number.isFinite(state.start_sec) || state.start_sec < 0
      || typeof state.duration_sec !== 'number' || ![5, 10, 20].includes(state.duration_sec)) return null
  return {
    record_id: sourceId,
    channel: state.channel as typeof FISTULA_CHANNELS[number],
    start_sec: state.start_sec,
    duration_sec: state.duration_sec as 5 | 10 | 20,
  }
}
