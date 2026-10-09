import { describe, expect, it } from 'vitest'
import type { SurgicalFrameRecord } from './api'
import { buildSurgicalFrameReport } from './surgical-evidence'

const frame:SurgicalFrameRecord={
  id:'endoscapes:train:4_26200',dataset_id:'Endoscapes-BBox201',split:'train',video_id:4,frame_number:26200,
  file_name:'4_26200.jpg',width:1920,height:1080,image_sha256:'a'.repeat(64),annotation_sha256:'b'.repeat(64),
  annotations:[{id:7,category_id:2,category_name:'cystic_duct',bbox:[12,24,80,60],segmentation:null}],
  cvs_criteria:[0.667,1,0.333],
}

describe('SurgiVision source-frame evidence export',()=>{
  it('preserves source coordinates, annotation provenance, label meaning and display state without embedding the image',()=>{
    const report=buildSurgicalFrameReport(frame,{show_annotations:true,selected_annotation_id:7})
    expect(report.schema).toBe('medforge.surgivision-source-frame-evidence/v1')
    expect(report.case).toMatchObject({id:frame.id,split:'train',video_id:4,frame_number:26200,width_px:1920,height_px:1080})
    expect(report.source).toMatchObject({license:'CC BY-NC-SA 4.0; non-commercial scientific research',image_sha256:frame.image_sha256,annotation_sha256:frame.annotation_sha256})
    expect(report.evidence.reference_annotations).toEqual(frame.annotations)
    expect(report.evidence.cvs_source_values).toEqual(frame.cvs_criteria)
    expect(report.evidence.cvs_value_interpretation).toContain('means of three annotators')
    expect(report.display_state).toEqual({show_annotations:true,selected_annotation_id:7})
    expect(report.limitations.join(' ')).toContain('not model predictions')
    expect(report).not.toHaveProperty('image_bytes')
  })
})
