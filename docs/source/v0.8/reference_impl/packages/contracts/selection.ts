/** MEDFORGE typed cross-panel selection state. No simulated patient data. */
export type SurgicalSelection = {
  module: "surgivision";
  caseId: string;
  frameId: string;
  annotationId?: string;
  runId?: string;
};
export type DoseSelection = {
  module: "dosetwin";
  caseId: string;
  voxel: [number, number, number];
  structureId?: string;
  doseArtifactId: string;
  runId?: string;
};
export type VascularSelection = {
  module: "fistulaguard";
  caseId: string;
  channelId: string;
  startSample: number;
  endSampleExclusive: number;
  sampleRateHz: number;
  runId?: string;
};
export type WorkspaceSelection = SurgicalSelection | DoseSelection | VascularSelection;

/** Each workspace owns its own selection state and publishes updates to linked panels. */
export function selectionKey(selection: WorkspaceSelection): string {
  switch (selection.module) {
    case "surgivision": return `${selection.caseId}:frame:${selection.frameId}`;
    case "dosetwin": return `${selection.caseId}:voxel:${selection.voxel.join(",")}:dose:${selection.doseArtifactId}`;
    case "fistulaguard": return `${selection.caseId}:channel:${selection.channelId}:${selection.startSample}-${selection.endSampleExclusive}`;
  }
}
