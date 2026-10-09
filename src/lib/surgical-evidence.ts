import type { SurgicalFrameRecord } from './api'

export function buildSurgicalFrameReport(
  frame:SurgicalFrameRecord,
  displayState:{show_annotations:boolean;selected_annotation_id:number|null},
){
  return {
    schema:'medforge.surgivision-source-frame-evidence/v1',
    title:`Endoscapes source-frame evidence · ${frame.split} · video ${frame.video_id} · frame ${frame.frame_number}`,
    created_at_utc:new Date().toISOString(),
    case:{id:frame.id,dataset_id:frame.dataset_id,split:frame.split,video_id:frame.video_id,frame_number:frame.frame_number,
      file_name:frame.file_name,width_px:frame.width,height_px:frame.height},
    source:{repository:'https://github.com/CAMMA-public/Endoscapes',citation:'Murali et al. (2023), arXiv:2312.12429',
      license:'CC BY-NC-SA 4.0; non-commercial scientific research',image_sha256:frame.image_sha256,annotation_sha256:frame.annotation_sha256},
    evidence:{reference_annotations:frame.annotations,cvs_source_values:frame.cvs_criteria,
      cvs_value_interpretation:'Endoscapes ds values are means of three annotators; fractional means indicate disagreement. Individual annotator votes are unavailable.'},
    display_state:displayState,
    limitations:['This export contains annotation and label data, not the source image.','COCO annotations and CVS values are expert reference data, not model predictions.','Labels do not indicate surgical safety, clearance, or clinical guidance.','Preserve source attribution and CC BY-NC-SA 4.0 terms; non-commercial scientific research only.'],
  }
}
