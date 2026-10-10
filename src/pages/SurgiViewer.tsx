import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Check, ChevronLeft, ChevronRight, Download, FlaskConical, Image, LoaderCircle, Move, Save, ZoomIn, ZoomOut } from 'lucide-react'
import { api, type CvsCoverage, type CvsInferenceRunRecord, type EvidenceReport, type ModelValidation, type StudentReferenceEvidence, type StudentSurgiViewerEvidence, type StudentViewerEvidence, type SurgicalAnnotation, type SurgicalClipRecord, type SurgicalFrameRecord, type SurgicalMediaRecord, type SurgicalSequenceFrame } from '../lib/api'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { parseSurgicalViewPreferences, type SurgicalViewPreferences } from '@/lib/workspace-preferences'
import { buildSurgicalFrameReport } from '@/lib/surgical-evidence'
import { searchSurgicalFrames, type SurgicalFrameOption } from '@/lib/source-picker'
import { SurgicalFrameTools } from '@/features/surgivision/SurgicalFrameTools'
import { describeAnnotatorMean } from '@/lib/cvs-self-check'
import { CholecT50Review } from '@/components/surgivision/CholecT50Review'
import { NeutralVideoSkin, Video, VideoPlayer } from '@videojs/react/video'
import '@videojs/react/video/neutral-skin.css'

type FrameOption=SurgicalFrameOption

function downloadSurgicalFrameEvidence(frame:SurgicalFrameRecord,showAnnotations:boolean,selectedAnnotationId:number|null){
  const document=buildSurgicalFrameReport(frame,{show_annotations:showAnnotations,selected_annotation_id:selectedAnnotationId})
  const blob=new Blob([JSON.stringify(document,null,2)],{type:'application/json'})
  const url=URL.createObjectURL(blob),anchor=window.document.createElement('a')
  anchor.href=url
  anchor.download=`medforge-${frame.id.replace(/[^a-z0-9-]/gi,'-')}-evidence.json`
  anchor.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}

function readSurgicalViewPreferences(frameId:string):SurgicalViewPreferences|null{
  try{
    const raw=localStorage.getItem(`medforge:surgivision:${frameId}`)
    return raw?parseSurgicalViewPreferences(frameId,JSON.parse(raw)):null
  }catch{/* Ignore unavailable storage and malformed saved state. */}
  return null
}

const categoryColors:Record<string,string>={cystic_plate:'#f3bd57',calot_triangle:'#7bb7ff',cystic_artery:'#e87979',cystic_duct:'#b79cff',gallbladder:'#61c4a7',tool:'#f28c55'}
const pretty=(name:string)=>name.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const cvsCriteria=[
  'Seeing two structures: cystic duct and cystic artery',
  "Clear dissection of Calot's triangle or hepatocystic triangle",
  'Cystic plate visualization with complete separation of the gallbladder body',
]
const formatClipTime=(seconds:number)=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`
const formatClipTimeExact=(seconds:number)=>{const totalMicroseconds=Math.round(seconds*1_000_000);const wholeSeconds=Math.floor(totalMicroseconds/1_000_000);const microseconds=totalMicroseconds%1_000_000;return `${formatClipTime(wholeSeconds)}.${microseconds.toString().padStart(6,'0')}`}
const formatPhaseLabel=(phase:string)=>phase.replace(/([a-z])([A-Z])/g,'$1 $2')

export function SurgiViewer({frameId,availableFrameIds,guided=false,releasedReference,viewerEvidence,onEvidenceChange,locked=false}:{frameId:string;availableFrameIds:string[];guided?:boolean;releasedReference?:StudentReferenceEvidence|null;viewerEvidence?:StudentViewerEvidence|null;onEvidenceChange?:(evidence:StudentSurgiViewerEvidence)=>void;locked?:boolean}) {
  const navigate=useNavigate()
  const [searchParams]=useSearchParams()
  const reportId=searchParams.get('report')
  const maskCanvas=useRef<HTMLCanvasElement>(null)
  const viewportRef=useRef<HTMLDivElement>(null)
  const savedPreferences=useMemo(()=>guided||reportId?null:readSurgicalViewPreferences(frameId),[guided,frameId,reportId])
  const [activeFrameId,setActiveFrameId]=useState(frameId)
  const [frameSearch,setFrameSearch]=useState('')
  const [frame,setFrame]=useState<SurgicalFrameRecord|null>(null)
  const [sourceMedia,setSourceMedia]=useState<SurgicalMediaRecord|null>(null)
  const [sourceMediaError,setSourceMediaError]=useState('')
  const [sampledFrames,setSampledFrames]=useState<SurgicalSequenceFrame[]>([])
  const [sampledFramesError,setSampledFramesError]=useState('')
  const [publicClip,setPublicClip]=useState<SurgicalClipRecord|null>(null)
  const [publicClips,setPublicClips]=useState<SurgicalClipRecord[]>([])
  const [publicClipLoading,setPublicClipLoading]=useState(true)
  const [showPublicClip,setShowPublicClip]=useState(false)
  const publicVideoRef=useRef<HTMLVideoElement>(null)
  const publicVideoRegionRef=useRef<HTMLDivElement>(null)
  const [publicClipCurrentSecond,setPublicClipCurrentSecond]=useState(0)
  const [pendingClipSeek,setPendingClipSeek]=useState(false)
  // Shared frame-comparison or filter links open on the annotated stills.
  const [mediaMode,setMediaMode]=useState(()=>guided||searchParams.has('compare')||[...searchParams.keys()].some(key=>key.startsWith('frames_'))?'annotated-frames':'native-video')
  const [frameEvidenceMode,setFrameEvidenceMode]=useState<'labels'|'model'>('labels')
  const sampledMediaId=sourceMedia?.media_id
  const sampledMediaCount=sourceMedia?.sampled_frame_count
  const publicClipAnnotation=publicClip?.source_annotation
  const sourceEventToleranceSeconds=publicClip?.frames_per_second?0.5/publicClip.frames_per_second:0.02
  const sourceEventVisible=Boolean(publicClipAnnotation&&Math.abs(publicClipCurrentSecond-publicClipAnnotation.timestamp_seconds)<=sourceEventToleranceSeconds)
  const sourcePhaseTrack=publicClip?.phase_track??[]
  const sourcePhaseFrame=publicClip?.frames_per_second?Math.floor(publicClipCurrentSecond*publicClip.frames_per_second):0
  const sourcePhase=sourcePhaseTrack.find(interval=>interval.first_frame<=sourcePhaseFrame&&interval.last_frame>=sourcePhaseFrame)
  useEffect(()=>{
    if(!pendingClipSeek||!showPublicClip||!publicClipAnnotation)return
    const video=publicVideoRef.current
    if(!video)return
    const seekToEvent=()=>{
      video.currentTime=publicClipAnnotation.timestamp_seconds
      setPendingClipSeek(false)
      window.requestAnimationFrame(()=>publicVideoRegionRef.current?.scrollIntoView({block:'start',behavior:'auto'}))
    }
    if(video.readyState>=1){seekToEvent();return}
    video.addEventListener('loadedmetadata',seekToEvent,{once:true})
    return()=>video.removeEventListener('loadedmetadata',seekToEvent)
  },[pendingClipSeek,showPublicClip,publicClipAnnotation])
  const [imageUrl,setImageUrl]=useState('')
  const [imageError,setImageError]=useState('')
  const [imageSize,setImageSize]=useState<{width:number;height:number}|null>(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [showBoxes,setShowBoxes]=useState(()=>savedPreferences?.show_boxes??true)
  const [showMasks,setShowMasks]=useState(true)
  const [selected,setSelected]=useState<number|null>(()=>savedPreferences?.selected_annotation_id??null)
  const [zoom,setZoom]=useState(()=>savedPreferences?.zoom??1)
  const [pan,setPan]=useState({x:0,y:0})
  const [drag,setDrag]=useState<{x:number;y:number;px:number;py:number}|null>(null)
  const [evidencePoint,setEvidencePoint]=useState<{x:number;y:number}|null>(null)
  const [coordinateDraft,setCoordinateDraft]=useState({x:'',y:''})
  const [cvsValidation,setCvsValidation]=useState<ModelValidation|null>(null)
  const [cvsRun,setCvsRun]=useState<CvsInferenceRunRecord|null>(null)
  const [cvsCoverage,setCvsCoverage]=useState<CvsCoverage|null>(null)
  const [cvsCoverageError,setCvsCoverageError]=useState('')
  const [cvsLoading,setCvsLoading]=useState(false)
  const [cvsError,setCvsError]=useState('')
  const [savingFrameReport,setSavingFrameReport]=useState(false)
  const [savedFrameReport,setSavedFrameReport]=useState<EvidenceReport|null>(null)
  const [saveFrameReportError,setSaveFrameReportError]=useState('')
  const [openedReportError,setOpenedReportError]=useState('')
  const setScale=(value:number)=>{const next=Math.max(1,Math.min(3,value));setZoom(next);if(next===1)setPan({x:0,y:0})}
  useEffect(()=>{if(guided||reportId||!frame||frame.id!==activeFrameId)return;const bounds=viewportRef.current?.getBoundingClientRect();if(!bounds||bounds.width<=0||bounds.height<=0)return;const clampRatio=(value:number,size:number)=>Math.max(-2,Math.min(2,value/size));try{localStorage.setItem(`medforge:surgivision:${activeFrameId}`,JSON.stringify({frame_id:activeFrameId,show_boxes:showBoxes,zoom,selected_annotation_id:selected,pan_ratio:{x:clampRatio(pan.x,bounds.width),y:clampRatio(pan.y,bounds.height)}} satisfies SurgicalViewPreferences & {frame_id:string}))}catch{/* Local persistence is optional when browser storage is unavailable. */}},[guided,reportId,activeFrameId,frame,showBoxes,zoom,selected,pan])
  useEffect(()=>{if(guided||!frame||frame.id!==activeFrameId)return;const bounds=viewportRef.current?.getBoundingClientRect();if(savedPreferences&&bounds&&bounds.width>0&&bounds.height>0)setPan({x:savedPreferences.pan_ratio.x*bounds.width,y:savedPreferences.pan_ratio.y*bounds.height})},[guided,frame,activeFrameId,savedPreferences])
  useEffect(()=>{if(viewerEvidence?.kind==='surgivision'){const point={x:viewerEvidence.selection_x_px,y:viewerEvidence.selection_y_px};setEvidencePoint(point);setCoordinateDraft({x:String(point.x),y:String(point.y)})}else{setEvidencePoint(null);setCoordinateDraft({x:'',y:''})}},[viewerEvidence])
  useEffect(()=>setActiveFrameId(frameId),[frameId])
  useEffect(()=>{
    if(!reportId||guided||!frame||frame.id!==activeFrameId)return
    let live=true
    setOpenedReportError('')
    api.reports().then(reports=>{
      if(!live)return
      const report=reports.find(item=>item.id===reportId)
      if(!report||report.document.schema!=='medforge.surgivision-source-frame-evidence/v1'||report.document.case?.id!==activeFrameId){setOpenedReportError('This saved frame report does not match the selected source frame.');return}
      const state=report.document.display_state
      if(!state){setOpenedReportError('This frame report does not contain a saved overlay view.');return}
      setShowBoxes(state.show_annotations);setShowMasks(state.show_annotations);setSelected(state.selected_annotation_id);setScale(1);setPan({x:0,y:0})
    }).catch(error=>{if(live)setOpenedReportError(error instanceof Error?error.message:'Saved frame view could not be reopened')})
    return()=>{live=false}
  },[reportId,guided,activeFrameId,frame])
  useEffect(()=>{
    if(guided)return
    let live=true
    api.surgicalCoverage().then(value=>{if(live)setCvsCoverage(value)}).catch(error=>{if(live)setCvsCoverageError(error instanceof Error?error.message:'Source label coverage could not be loaded')})
    return()=>{live=false}
  },[guided])
  useEffect(()=>{
    setCvsValidation(null);setCvsRun(null);setCvsError('')
    if(guided||frameEvidenceMode!=='model')return
    let live=true
    api.validateModel('cvs-adaptnet',activeFrameId,'cvs.inference')
      .then(value=>{if(live)setCvsValidation(value)})
      .catch(error=>{if(live)setCvsError(error instanceof Error?error.message:'Model readiness could not be checked')})
    api.runs().then(records=>{
      if(live)setCvsRun(records.find((item):item is CvsInferenceRunRecord=>item.operation_id==='cvs.inference'&&item.case_id===activeFrameId)??null)
    }).catch(()=>{})
    return()=>{live=false}
  },[activeFrameId,guided,frameEvidenceMode])
  useEffect(()=>{let live=true;const saved=guided||reportId?null:readSurgicalViewPreferences(activeFrameId);setLoading(true);setFrame(null);setSelected(saved?.selected_annotation_id??null);setShowBoxes(saved?.show_boxes??true);setShowMasks(true);setScale(saved?.zoom??1);setPan({x:0,y:0});api.surgicalFrame(activeFrameId).then(value=>{if(live){setFrame(value);setError('')}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Unable to load local frame')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[activeFrameId,guided,reportId])
  useEffect(()=>{let live=true;let objectUrl='';setImageUrl('');setImageSize(null);setImageError('');api.surgicalImage(activeFrameId).then(url=>{objectUrl=url;if(live)setImageUrl(url);else URL.revokeObjectURL(url)}).catch(e=>{if(live)setImageError(e instanceof Error?e.message:'Unable to load the assigned source image')});return()=>{live=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[activeFrameId])
  useEffect(()=>{
    if(guided||!frame)return
    let live=true
    setSourceMedia(null);setSourceMediaError('')
    const mediaId=`endoscapes-bbox201:${frame.split}:video-${frame.video_id}`
    api.surgicalMediaRecord(mediaId).then(record=>{if(live)setSourceMedia(record)}).catch(error=>{if(live)setSourceMediaError(error instanceof Error?error.message:'Source media capability could not be verified')})
    return()=>{live=false}
  },[guided,frame])
  useEffect(()=>{
    if(guided||!sampledMediaId||!sampledMediaCount){setSampledFrames([]);return}
    let live=true
    setSampledFramesError('')
    api.surgicalSequenceFrames(sampledMediaId)
      .then(value=>{if(live)setSampledFrames(value)})
      .catch(error=>{if(live)setSampledFramesError(error instanceof Error?error.message:'The sampled frame sequence could not be loaded')})
    return()=>{live=false}
  },[guided,sampledMediaId,sampledMediaCount])
  useEffect(()=>{
    if(guided){setPublicClip(null);setShowPublicClip(false);return}
    let live=true
    setPublicClipLoading(true)
    api.surgicalClips().then(items=>{if(live){setPublicClips(items);const clip=items[0]??null;setPublicClip(clip);setPublicClipCurrentSecond(0);setShowPublicClip(Boolean(clip))}}).catch(()=>{if(live){setPublicClip(null);setPublicClips([])}}).finally(()=>{if(live)setPublicClipLoading(false)})
    return()=>{live=false}
  },[guided])
  const referenceIsReleased=Boolean(frame && releasedReference?.case_id===frame.id)
  const displayedAnnotations=useMemo(()=>referenceIsReleased ? releasedReference!.annotations : frame?.annotations ?? [],[referenceIsReleased,releasedReference,frame])
  const displayedCvs=useMemo(()=>referenceIsReleased ? releasedReference!.cvs_criteria : frame?.cvs_criteria ?? [],[referenceIsReleased,releasedReference,frame])
  const selectedAnnotation=useMemo(()=>displayedAnnotations.find(a=>a.id===selected)??null,[displayedAnnotations,selected])
  const framePixelDimensionsMatch=!frame||!imageSize||(imageSize.width===frame.width&&imageSize.height===frame.height)
  useEffect(()=>{if(frame&&selected!==null&&!frame.annotations.some(annotation=>annotation.id===selected))setSelected(null)},[frame,selected])
  const frameOptions=useMemo<FrameOption[]>(()=>availableFrameIds.map(id=>{
    const [,split,stem]=id.split(':')
    const [video,frameNumber]=stem?.split('_')??[]
    const sourceSplit=split??'unknown',sourceVideo=video??'unknown',sourceFrame=frameNumber??'unknown'
    return {id,split:sourceSplit,video:sourceVideo,frame:sourceFrame,label:`${sourceSplit} · video ${sourceVideo} · frame ${sourceFrame}`}
  }),[availableFrameIds])
  const visibleFrameOptions=useMemo(()=>{
    return searchSurgicalFrames(frameOptions,frameSearch,activeFrameId,12)
  },[frameOptions,frameSearch,activeFrameId])
  const selectedFrameOption=frameOptions.find(option=>option.id===activeFrameId)??null
  useEffect(()=>{
    const canvas=maskCanvas.current
    if(!canvas||!frame)return
    canvas.width=frame.width;canvas.height=frame.height
    const context=canvas.getContext('2d')
    if(!context)return
    context.clearRect(0,0,frame.width,frame.height)
    if(!showMasks)return
    const output=context.createImageData(frame.width,frame.height)
    for(const annotation of displayedAnnotations){
      const segmentation=annotation.segmentation
      if(!segmentation||Array.isArray(segmentation))continue
      const counts=segmentation.counts,size=segmentation.size
      if(typeof counts!=='string'||!Array.isArray(size)||size[0]!==frame.height||size[1]!==frame.width)continue
      try{paintCocoMask(output.data,frame.width,frame.height,counts,categoryColors[annotation.category_name]??'#fff')}
      catch{continue}
    }
    context.putImageData(output,0,0)
  },[frame,showMasks,displayedAnnotations])
  const pointerDown=(event:PointerEvent<HTMLDivElement>)=>{if(zoom===1)return;event.currentTarget.setPointerCapture(event.pointerId);setDrag({x:event.clientX,y:event.clientY,px:pan.x,py:pan.y})}
  const pointerMove=(event:PointerEvent<HTMLDivElement>)=>{if(drag)setPan({x:drag.px+event.clientX-drag.x,y:drag.py+event.clientY-drag.y})}
  const reset=()=>{setScale(1);setPan({x:0,y:0});setSelected(null)}
  const runCvsModel=async()=>{
    if(!frame||!cvsValidation?.executable||cvsLoading)return
    setCvsLoading(true);setCvsError('')
    try{setCvsRun(await api.createCvsRun(frame.id))}
    catch(error){setCvsError(error instanceof Error?error.message:'The local CVS-AdaptNet run failed')}
    finally{setCvsLoading(false)}
  }
  const showAnyAnnotations=showBoxes||showMasks
  const reportMatchesView=savedFrameReport?.document.schema==='medforge.surgivision-source-frame-evidence/v1'
    &&savedFrameReport.document.case?.id===frame?.id
    &&savedFrameReport.document.display_state?.show_annotations===showAnyAnnotations
    &&savedFrameReport.document.display_state?.selected_annotation_id===selected
  const saveFrameEvidence=async()=>{
    if(!frame||guided||savingFrameReport||reportMatchesView)return
    setSavingFrameReport(true);setSaveFrameReportError('')
    try{setSavedFrameReport(await api.createSurgicalFrameReport(frame.id,{show_annotations:showAnyAnnotations,selected_annotation_id:selected}))}
    catch(error){setSaveFrameReportError(error instanceof Error?error.message:'Could not save this frame evidence to Reports')}
    finally{setSavingFrameReport(false)}
  }
  const selectEvidencePoint=(event:ReactMouseEvent<HTMLDivElement>)=>{
    if(!guided||locked||referenceIsReleased||!frame||!onEvidenceChange)return
    const bounds=event.currentTarget.getBoundingClientRect()
    const x=Math.max(0,Math.min(frame.width-1,Math.round((event.clientX-bounds.left)/bounds.width*frame.width)))
    const y=Math.max(0,Math.min(frame.height-1,Math.round((event.clientY-bounds.top)/bounds.height*frame.height)))
    setEvidencePoint({x,y})
    setCoordinateDraft({x:String(x),y:String(y)})
    onEvidenceChange({kind:'surgivision',case_id:frame.id,frame_id:frame.id,selection_x_px:x,selection_y_px:y})
  }
  const updateCoordinateDraft=(axis:'x'|'y',value:string)=>{
    const next={...coordinateDraft,[axis]:value}
    setCoordinateDraft(next)
    if(!guided||locked||referenceIsReleased||!frame||!onEvidenceChange||next.x===''||next.y==='')return
    const x=Number(next.x),y=Number(next.y)
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=frame.width||y<0||y>=frame.height)return
    const point={x,y}
    setEvidencePoint(point)
    onEvidenceChange({kind:'surgivision',case_id:frame.id,frame_id:frame.id,selection_x_px:x,selection_y_px:y})
  }
  if(loading)return <div className="my-6 grid min-h-40 content-center gap-3"><Skeleton className="h-24 w-full"/><p className="text-sm text-muted-foreground">Loading verified image and annotation record…</p></div>
  if(error||!frame)return <Alert variant="destructive" className="my-6 min-h-36 items-center"><AlertCircle/><AlertDescription><strong className="block font-semibold">Endoscapes sample is unavailable</strong>{error||'No validated frame record was returned.'}</AlertDescription></Alert>
  return <section className="mt-4 grid min-w-0 gap-3" aria-label="SurgiVision frame review">
    {openedReportError&&<div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{openedReportError}</div>}
    {reportId&&!openedReportError&&<div role="status" className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">Reopened the saved Endoscapes frame and annotation view.</div>}
    <Tabs value={mediaMode} onValueChange={value=>{if(value)setMediaMode(value)}} className="min-w-0 flex-col gap-3">
      <TabsList aria-label={guided?'Assigned surgical source':'Surgical media modes'} className={`!grid h-auto w-full grid-cols-1 gap-1 lg:grid-cols-3 ${guided?'sr-only':''}`}>
        {guided?<TabsTrigger className="!h-10" value="annotated-frames">Assigned source frame</TabsTrigger>:<><TabsTrigger className="!h-10" value="native-video">Continuous video · source labels</TabsTrigger><TabsTrigger className="!h-10" value="sampled-replay">Sampled replay · source labels</TabsTrigger><TabsTrigger className="!h-10" value="annotated-frames">Annotated stills</TabsTrigger></>}
      </TabsList>
      {!guided&&<TabsContent value="native-video" className="mt-0 grid min-w-0 gap-3">
      {publicClip&&<Card role="region" className="overflow-hidden border-border shadow-sm" aria-label={`${publicClip.dataset_id} video with source labels`}>
      <CardHeader className="gap-2"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{sourcePhaseTrack.length?'Frame-matched source phases':'Source event aligned'}</Badge><Badge variant="secondary">{publicClip.procedure_label} · {publicClip.duration_sec.toFixed(1)} sec</Badge></div><div className="flex flex-wrap items-end justify-between gap-3"><div className="min-w-0"><CardTitle>{publicClip.dataset_id} · source video</CardTitle><CardDescription className="mt-1">{publicClip.dataset_id==='Cholec80'?'Full-rate 25 fps cholecystectomy footage with the publisher’s source phase label matched to the exact current frame. Labels are ground truth, not model output or surgical guidance.':'Authentic laparoscopic appendectomy footage with one publisher-timed event and source-reported grade. It has no tool masks, triplets, phase labels or model output.'}</CardDescription></div><div className="grid w-full gap-1.5 sm:w-80"><label className="text-xs font-medium text-muted-foreground" htmlFor="surgi-video-source">Video source</label><Select items={publicClips.map(clip=>({label:`${clip.dataset_id} · ${clip.procedure_label}`,value:clip.clip_id}))} value={publicClip.clip_id} onValueChange={value=>{const next=publicClips.find(item=>item.clip_id===value);if(next){setPublicClip(next);setPublicClipCurrentSecond(0);setPendingClipSeek(false)}}}><SelectTrigger id="surgi-video-source" aria-label="Select continuous surgical video" className="w-full"><SelectValue/></SelectTrigger><SelectContent>{publicClips.map(clip=><SelectItem key={clip.clip_id} value={clip.clip_id}>{clip.dataset_id} · {clip.procedure_label}</SelectItem>)}</SelectContent></Select></div></div></CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,2.55fr)_minmax(17rem,1fr)]">
        <div className="grid min-w-0 content-start gap-3">
        {showPublicClip?<VideoPlayer key={publicClip.clip_id}><div ref={publicVideoRegionRef} className="relative scroll-mt-20"><NeutralVideoSkin className="w-full overflow-hidden rounded-lg bg-[#101624]" style={{aspectRatio:'16 / 9'}}><Video ref={publicVideoRef} onTimeUpdate={event=>{const second=event.currentTarget.currentTime;setPublicClipCurrentSecond(current=>Math.abs(current-second)<0.02?current:second)}} className="size-full" src={api.surgicalClipVideoUrl(publicClip.clip_id)} playsInline preload="metadata" aria-label={`${publicClip.dataset_id} ${publicClip.procedure_label} source video`}/></NeutralVideoSkin>{sourcePhaseTrack.length>0&&sourcePhase?<div role="group" aria-live="off" aria-label="Publisher phase annotation for the current video frame" className="pointer-events-none absolute left-3 top-3 max-w-[min(90%,34rem)] rounded-md border border-primary-foreground/25 bg-background/95 p-2.5 text-foreground shadow-lg"><Badge variant="outline" className="mb-1">Publisher phase · frame {sourcePhaseFrame.toLocaleString()}</Badge><p className="m-0 text-sm font-semibold">{formatPhaseLabel(sourcePhase.phase)}</p><p className="m-0 text-xs text-muted-foreground">Cholec80 phase label for the current frame · 25 fps source track · not model output</p></div>:sourceEventVisible&&publicClipAnnotation?<div role="status" className="pointer-events-none absolute left-3 top-3 max-w-[min(90%,34rem)] rounded-md border border-primary-foreground/25 bg-background/95 p-2.5 text-foreground shadow-lg"><Badge variant="outline" className="mb-1">Publisher source annotation · {formatClipTimeExact(publicClipAnnotation.timestamp_seconds)}</Badge><p className="m-0 text-sm font-semibold">{publicClipAnnotation.event_label}</p><p className="m-0 text-xs text-muted-foreground">Final laparoscopic grade: {publicClipAnnotation.final_laparoscopic_grade} · Gomes scale</p></div>:null}</div></VideoPlayer>:<Button variant="outline" className="w-fit" onClick={()=>setShowPublicClip(true)}>Load source video</Button>}
        {publicClipAnnotation&&<div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Publisher source annotation for this video">
          <div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><Badge variant="outline">Source annotation</Badge><span className="text-xs tabular-nums text-muted-foreground">{formatClipTimeExact(publicClipAnnotation.timestamp_seconds)}</span></div><p className="m-0 text-sm font-semibold">{publicClipAnnotation.event_label}</p><p className="m-0 text-xs leading-5 text-muted-foreground">Final laparoscopic grade {publicClipAnnotation.final_laparoscopic_grade} · Gomes scale. This is the dataset label, not an AI prediction.</p></div>
          <Button variant="outline" className="shrink-0" onClick={()=>{setShowPublicClip(true);setPendingClipSeek(true)}}>Jump to source event</Button>
        </div>}
        {publicClip.dataset_id==='Cholec80'&&<div className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">Tool-presence labels are available only at 1 fps and are intentionally not drawn across unsampled frames. The overlay shows the full-rate source phase annotation only.</div>}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="m-0 text-sm font-semibold">Inspect CholecT50 sampled-frame annotations</p><p className="m-0 text-xs leading-5 text-muted-foreground">Official boxes and action labels appear only on their matching sampled frames.</p></div>
          <Button variant="outline" className="shrink-0" onClick={()=>setMediaMode('sampled-replay')}>View labeled samples<ChevronRight data-icon="inline-end"/></Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground"><span>{publicClip.license_label} · SHA-256 {publicClip.sha256.slice(0,12)}…</span><a className="text-primary hover:underline" href={publicClip.source_url} target="_blank" rel="noreferrer">{publicClip.dataset_id} source and license ↗</a></div>
        <p className="m-0 text-xs leading-relaxed text-muted-foreground">{publicClip.citation}</p>
        </div>
        <aside className="grid min-w-0 content-start gap-3 rounded-lg border bg-card p-3 sm:p-4" aria-label="Video evidence inspector">
          <div className="flex min-w-0 flex-col gap-2 border-b pb-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="m-0 text-xs font-medium text-muted-foreground">Evidence inspector</p><h3 className="m-0 mt-1 text-base font-semibold">At the current frame</h3></div><Badge variant="outline" className="w-fit tabular-nums">{formatClipTimeExact(publicClipCurrentSecond)}</Badge></div>
          {sourcePhaseTrack.length>0?<div className="grid min-w-0 gap-2 border-b pb-3 last:border-0 last:pb-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Publisher phase</Badge><Badge variant="secondary">Frame {sourcePhaseFrame.toLocaleString()} · 25 fps</Badge></div>{sourcePhase?<p className="m-0 text-sm font-semibold">{formatPhaseLabel(sourcePhase.phase)}</p>:<p className="m-0 text-sm text-muted-foreground">No phase interval is recorded for this frame.</p>}<p className="m-0 text-xs leading-5 text-muted-foreground">Source track for this video; reference label, not model output.</p></div>:publicClipAnnotation?<div className="grid min-w-0 gap-2 border-b pb-3 last:border-0 last:pb-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Publisher event</Badge><Badge variant="secondary">{formatClipTimeExact(publicClipAnnotation.timestamp_seconds)}</Badge></div>{sourceEventVisible?<><p className="m-0 text-sm font-semibold">{publicClipAnnotation.event_label}</p><p className="m-0 text-xs text-muted-foreground">Final laparoscopic grade {publicClipAnnotation.final_laparoscopic_grade} · Gomes scale</p></>:<p className="m-0 text-sm text-muted-foreground">No source event is annotated at {formatClipTimeExact(publicClipCurrentSecond)}. The published event is at {formatClipTimeExact(publicClipAnnotation.timestamp_seconds)}.</p>}<Button variant="outline" size="sm" className="w-full" onClick={()=>{setShowPublicClip(true);setPendingClipSeek(true)}}>Jump to source event</Button></div>:<div className="grid min-w-0 gap-2 border-b pb-3 last:border-0 last:pb-0"><Badge variant="outline">No aligned labels</Badge><p className="m-0 text-sm text-muted-foreground">The installed video source has no annotations at this time.</p></div>}
          <div className="grid min-w-0 gap-2 border-b pb-3 last:border-0 last:pb-0"><div className="flex items-center gap-2"><Badge variant="outline">Model output</Badge><Badge variant="secondary">Unavailable</Badge></div><p className="m-0 text-sm text-muted-foreground">No temporal prediction stream is installed for this recording.</p><p className="m-0 text-xs leading-5 text-muted-foreground">CVS-AdaptNet is a separate single-frame operation and is not aligned to this video.</p></div>
          <div className="grid min-w-0 gap-2"><p className="m-0 text-xs font-medium text-muted-foreground">Source record</p><p className="m-0 break-all font-mono text-[11px] leading-relaxed">{publicClip.dataset_id} · {publicClip.clip_id}</p><p className="m-0 text-xs leading-5 text-muted-foreground">{publicClip.license_label} · SHA-256 {publicClip.sha256.slice(0,12)}…</p><a className="text-xs text-primary hover:underline" href={publicClip.source_url} target="_blank" rel="noreferrer">Dataset source and license ↗</a></div>
        </aside>
        </div>
      </CardContent></Card>}
      {!publicClip&&<Card><CardHeader><CardTitle>{publicClipLoading?'Checking installed surgical video…':'No native surgical video is installed'}</CardTitle><CardDescription>{publicClipLoading?'The local media manifest determines which authorized recordings are available.':'The sampled and annotated frame modes remain available for checksum-verified source evidence.'}</CardDescription></CardHeader></Card>}
      </TabsContent>}
      {!guided&&<TabsContent value="sampled-replay" className="mt-0 min-w-0"><CholecT50Review/></TabsContent>}
      <TabsContent value="annotated-frames" className="mt-0 grid min-w-0 gap-3">
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0 flex-1">
        {guided ? (
          <>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Assigned source frame</p>
            <p className="m-0 truncate text-sm font-semibold">{referenceIsReleased ? 'Reference annotations released after educator review' : 'One checksum-verified frame · reference labels withheld'}</p>
          </>
        ) : (
          <>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="endoscapes-frame">Jump to surgical frame · annotated stills</label>
            <Combobox
              items={visibleFrameOptions.items}
              filter={null}
              value={selectedFrameOption}
              inputValue={frameSearch}
              onInputValueChange={setFrameSearch}
              onValueChange={option => {
                if (option) {
                  setFrameSearch('')
                  navigate(`/studio/surgivision/cases/${encodeURIComponent(option.id)}`)
                }
              }}
              itemToStringLabel={option => option.label}
              itemToStringValue={option => option.id}
              isItemEqualToValue={(option, value) => option.id === value.id}
              autoHighlight
            >
              <ComboboxInput className="w-full md:max-w-xl" id="endoscapes-frame" aria-label="Jump to surgical frame by split, video, or frame number" placeholder="Search split, video, or frame" showClear />
              <ComboboxContent>
                {frameSearch.trim()&&<ComboboxEmpty>No matching Endoscapes frames.</ComboboxEmpty>}
                <ComboboxList>{option => <ComboboxItem key={option.id} value={option} className="items-start"><span className="grid min-w-0 gap-0.5"><span className="font-medium">{option.label}</span><span className="truncate font-mono text-[11px] text-muted-foreground">{option.id}</span></span></ComboboxItem>}</ComboboxList>
                <div className="border-t border-border px-3 py-2 text-[11px] leading-4 text-muted-foreground" role="status" aria-live="polite">{frameSearch.trim()?`Showing ${visibleFrameOptions.items.length} of ${visibleFrameOptions.total.toLocaleString()} matches — refine your search`: `Showing the selected frame and nearby samples · ${availableFrameIds.length.toLocaleString()} verified frames`}</div>
              </ComboboxContent>
            </Combobox>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">{frame.split}</Badge><Badge variant="outline">Video {frame.video_id} · frame {frame.frame_number}</Badge><Badge variant="outline">{frame.width} × {frame.height} px</Badge>{guided&&!referenceIsReleased?<Badge variant="outline">Reference labels withheld</Badge>:<><Badge variant="outline">{displayedAnnotations.length} annotations</Badge><Badge variant="outline">{displayedAnnotations.filter(annotation=>annotation.segmentation&&!Array.isArray(annotation.segmentation)).length} RLE masks</Badge>{!guided&&<span className="text-[11px]">{availableFrameIds.length.toLocaleString()} verified frames</span>}</>}</div>
    </div>
    {!guided&&<section className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-lg border border-border bg-card px-3 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center" aria-label="Source media mode">
      <Badge variant="outline" className="shrink-0 border-primary/25 bg-primary/5 text-primary">{sourceMedia?.media_kind==='sampled_sequence'?'1 fps sampled frames':sourceMedia?.media_kind==='annotated_stills'?'Annotated stills':sourceMedia?'Media available':sourceMediaError?'Media status unavailable':'Checking media mode'}</Badge>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-semibold">{sourceMedia?.media_kind==='sampled_sequence'?'Sampled frame inspection · continuous video not installed':sourceMedia?.media_kind==='annotated_stills'?'Continuous recording is not installed':'Surgical source availability'}</p>
        <p className="m-0 text-xs leading-5 text-muted-foreground">{sourceMedia?.limitations[0]??(sourceMediaError?'Verified frame inspection remains available; the source media registry could not be checked.':'Checking the verified media manifest. Playback and time-based tracks appear only for an installed, authorized recording.')}</p>
      </div>
      {sourceMedia&&<span className="col-start-2 min-w-0 break-words text-xs tabular-nums text-muted-foreground sm:col-start-3 sm:whitespace-nowrap">{sourceMedia.sampled_frame_count.toLocaleString()} sampled · {sourceMedia.annotated_frame_count.toLocaleString()} annotated · {sourceMedia.split} · video {sourceMedia.source_video_id}</span>}
    </section>}
    {!guided&&Boolean(sourceMedia?.sampled_frame_count&&sourceMedia.sampled_frame_count>0)&&<section className="grid min-w-0 gap-2 rounded-lg border border-border bg-card px-3 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center" aria-label="Endoscapes sampled frame sequence">
      <div className="min-w-0"><p className="m-0 text-sm font-semibold">1 fps source sequence</p><p className="m-0 text-xs text-muted-foreground">Sampled stills; the frame index is not a timestamp.</p></div>
      {sampledFrames.length>0&&<Slider aria-label="Sampled frame position" min={0} max={sampledFrames.length-1} step={1} value={[Math.max(0,sampledFrames.findIndex(item=>item.id===activeFrameId))]} onValueChange={value=>{const position=Number(Array.isArray(value)?value[0]:value);const item=sampledFrames[position];if(item)navigate(`/studio/surgivision/cases/${encodeURIComponent(item.id)}`)}}/>}
      <div className="flex items-center justify-between gap-2 sm:justify-end"><Button variant="outline" size="icon-sm" aria-label="Previous sampled frame" disabled={sampledFrames.findIndex(item=>item.id===activeFrameId)<=0} onClick={()=>{const index=sampledFrames.findIndex(item=>item.id===activeFrameId);const item=sampledFrames[index-1];if(item)navigate(`/studio/surgivision/cases/${encodeURIComponent(item.id)}`)}}><ChevronLeft/></Button><span className="min-w-24 text-center text-xs tabular-nums text-muted-foreground" role="status">{sampledFrames.length?`${Math.max(0,sampledFrames.findIndex(item=>item.id===activeFrameId))+1} / ${sampledFrames.length}`:sampledFramesError||'Loading sequence'}</span><Button variant="outline" size="icon-sm" aria-label="Next sampled frame" disabled={sampledFrames.findIndex(item=>item.id===activeFrameId)<0||sampledFrames.findIndex(item=>item.id===activeFrameId)>=sampledFrames.length-1} onClick={()=>{const index=sampledFrames.findIndex(item=>item.id===activeFrameId);const item=sampledFrames[index+1];if(item)navigate(`/studio/surgivision/cases/${encodeURIComponent(item.id)}`)}}><ChevronRight/></Button></div>
    </section>}
    <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(17rem,1fr)]">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="flex-row items-center justify-between gap-3 px-3 py-3">
          <div className="min-w-0"><CardTitle className="flex items-center gap-2"><Image aria-hidden="true"/> Frame review <Badge variant="secondary">Sampled still</Badge></CardTitle><CardDescription className="mt-1">One source image · annotation coordinates remain in original pixels</CardDescription></div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label="Zoom out" title="Zoom out" onClick={()=>setScale(zoom-.25)} disabled={zoom<=1}><ZoomOut/></Button>
            <span className="min-w-10 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom*100)}%</span>
            <Button variant="outline" size="icon-sm" aria-label="Zoom in" title="Zoom in" onClick={()=>setScale(zoom+.25)} disabled={zoom>=3}><ZoomIn/></Button>
            <Button variant="outline" size="icon-sm" aria-label="Reset view" title="Reset view" onClick={reset}><Move/></Button>
            {!guided&&<>
              <Button variant="outline" size="icon-sm" aria-label="Save source evidence to Reports" title="Save source evidence to Reports" onClick={()=>void saveFrameEvidence()} disabled={savingFrameReport||reportMatchesView}>{savingFrameReport?<LoaderCircle className="animate-spin"/>:reportMatchesView?<Check/>:<Save/>}</Button>
              <Button variant="outline" size="icon-sm" aria-label="Download source evidence JSON" title="Download source evidence JSON" onClick={()=>downloadSurgicalFrameEvidence(frame,showAnyAnnotations,selected)}><Download/></Button>
            </>}
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0">
        {!framePixelDimensionsMatch&&<Alert variant="destructive"><AlertTitle>Source image dimensions need verification</AlertTitle><AlertDescription>The JPEG is {imageSize?.width} × {imageSize?.height} pixels, while its source record says {frame.width} × {frame.height}. Source overlays and coordinate selection are paused until their pixel mapping is verified.</AlertDescription></Alert>}
        {!guided&&<div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-2.5 py-2"><span className="text-xs font-medium text-muted-foreground">Source overlays</span><ToggleGroup multiple variant="outline" size="sm" aria-label="Surgical source overlays" value={[...(showBoxes?['boxes']:[]),...(showMasks?['masks']:[])]} onValueChange={value=>{setShowBoxes(value.includes('boxes'));setShowMasks(value.includes('masks'))}}><ToggleGroupItem value="boxes" aria-label="Toggle official COCO boxes">COCO boxes</ToggleGroupItem><ToggleGroupItem value="masks" aria-label="Toggle official RLE masks">RLE masks</ToggleGroupItem></ToggleGroup></div>}
        {!guided&&saveFrameReportError&&<Alert variant="destructive"><AlertDescription>{saveFrameReportError}</AlertDescription></Alert>}
        {!guided&&reportMatchesView&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><Check className="text-primary"/>Frame evidence saved to Reports.</span><Link className="font-medium text-primary underline-offset-4 hover:underline" to="/studio/reports">View report history</Link></div>}
        <div ref={viewportRef} className={`surgi-canvas${zoom>1?' is-zoomed':''}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={()=>setDrag(null)} onPointerCancel={()=>setDrag(null)} onWheel={event=>{if(event.ctrlKey){event.preventDefault();setScale(zoom+(event.deltaY<0?.1:-.1))}}}>
          <div className="surgi-frame-transform" onClick={framePixelDimensionsMatch?selectEvidencePoint:undefined} style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,aspectRatio:imageSize?`${imageSize.width}/${imageSize.height}`:`${frame.width}/${frame.height}`,cursor:guided&&!locked&&!referenceIsReleased&&framePixelDimensionsMatch?'crosshair':undefined}}>
            {imageUrl?<img src={imageUrl} alt={`Endoscapes source image, ${frame.split} split, video ${frame.video_id}, frame ${frame.frame_number}`} onLoad={event=>setImageSize({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} draggable={false}/>:<div className="grid h-full place-items-center px-4 text-center text-sm text-muted-foreground">{imageError||'Loading assigned source image…'}</div>}
            {framePixelDimensionsMatch&&<canvas ref={maskCanvas} className="surgi-mask-layer" aria-hidden="true"/>}
            {framePixelDimensionsMatch&&(showBoxes||(guided&&evidencePoint))&&<svg className="surgi-annotation-layer" viewBox={`0 0 ${frame.width} ${frame.height}`} preserveAspectRatio="none" role="group" aria-label="Official COCO reference boxes">
              {showBoxes&&displayedAnnotations.map(annotation=><Annotation key={annotation.id} annotation={annotation} selected={selected===annotation.id} onSelect={()=>setSelected(annotation.id)}/>) }
              {guided&&evidencePoint&&<g aria-label={`Your evidence point at ${evidencePoint.x}, ${evidencePoint.y} source pixels`}><circle cx={evidencePoint.x} cy={evidencePoint.y} r={11} fill="#101624" fillOpacity=".8" stroke="#8498ff" strokeWidth={3} vectorEffect="non-scaling-stroke"/><circle cx={evidencePoint.x} cy={evidencePoint.y} r={2} fill="#ffffff"/></g>}
            </svg>}
          </div>
        </div>
        <div className="flex flex-col items-start justify-between gap-3 pt-2 text-sm text-muted-foreground sm:flex-row sm:items-center"><span className="flex items-center gap-2"><i className="inline-block size-2 rounded-full bg-primary"/>{guided&&!referenceIsReleased?evidencePoint?`Your evidence point · x ${evidencePoint.x}, y ${evidencePoint.y} source pixels`:'Click the frame or enter source pixel coordinates. Reference labels stay hidden.':'Official boxes and RLE masks use original source-pixel coordinates.'}</span>{guided&&!referenceIsReleased&&<div className="grid w-full grid-cols-[auto_minmax(4.5rem,1fr)_auto_minmax(4.5rem,1fr)] items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground sm:w-auto sm:grid-cols-[auto_5.5rem_auto_5.5rem]" role="group" aria-label="Evidence point in original image pixels"><label htmlFor="evidence-x-px">X pixel</label><Input className="h-8 text-xs" id="evidence-x-px" aria-label="Evidence X pixel coordinate" type="number" min={0} max={frame.width-1} step={1} value={coordinateDraft.x} disabled={locked} onChange={event=>updateCoordinateDraft('x',event.target.value)}/><label htmlFor="evidence-y-px">Y pixel</label><Input className="h-8 text-xs" id="evidence-y-px" aria-label="Evidence Y pixel coordinate" type="number" min={0} max={frame.height-1} step={1} value={coordinateDraft.y} disabled={locked} onChange={event=>updateCoordinateDraft('y',event.target.value)}/></div>}{guided&&referenceIsReleased&&<label className="flex items-center gap-2 text-foreground"><Checkbox checked={showBoxes} onCheckedChange={checked=>setShowBoxes(checked===true)}/>Show COCO boxes</label>}</div>
      </CardContent></Card>
      <aside className="grid min-w-0 content-start gap-3">
        <Card>
          <CardHeader className="gap-1"><CardDescription>{guided&&!referenceIsReleased?'Reference withheld':'Selected reference'}</CardDescription><CardTitle>{selectedAnnotation?pretty(selectedAnnotation.category_name):referenceIsReleased?'Source annotations':guided?'Available after review':'Choose a box'}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">{selectedAnnotation?<><CardDescription>Official COCO annotation #{selectedAnnotation.id}</CardDescription><dl className="m-0 grid">{[['Category',pretty(selectedAnnotation.category_name)],['Left · top',`${selectedAnnotation.bbox[0]} · ${selectedAnnotation.bbox[1]} px`],['Width · height',`${selectedAnnotation.bbox[2]} · ${selectedAnnotation.bbox[3]} px`]].map(([label,value])=><div className="flex items-start justify-between gap-3 border-t py-2" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="m-0 max-w-[68%] text-right text-sm font-medium">{value}</dd></div>)}</dl><span className="mt-2 flex items-center gap-1.5 text-sm text-[var(--med-success)]"><Check aria-hidden="true"/>Reference label · not model output</span></>:<CardDescription className="leading-relaxed">{guided&&!referenceIsReleased?'Submit your observations for educator review to unlock the source annotations.':referenceIsReleased?`${displayedAnnotations.length} source annotations are now available for review.`:`Select one of the ${displayedAnnotations.length} colored boxes to inspect its source class and coordinates.`}</CardDescription>}</CardContent>
        </Card>
        <Card>
          <CardHeader className="gap-1"><CardDescription>Source record</CardDescription><CardTitle>Image provenance</CardTitle></CardHeader>
          <CardContent className="grid gap-2"><dl className="m-0 grid">{[['Source split',frame.split],['Video / frame',`${frame.video_id} / ${frame.frame_number}`]].map(([label,value])=><div className="flex items-start justify-between gap-3 border-t py-2" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="m-0 max-w-[68%] text-right text-sm font-medium">{value}</dd></div>)}{[['Image SHA-256',frame.image_sha256],['COCO SHA-256',frame.annotation_sha256]].map(([label,value])=><div className="flex items-start justify-between gap-3 border-t py-2" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="m-0 max-w-[68%] break-all text-right font-mono text-[10px] leading-relaxed text-muted-foreground">{value}</dd></div>)}</dl><a className="mt-1 inline-flex text-xs text-primary hover:underline" href="https://github.com/CAMMA-public/Endoscapes" target="_blank" rel="noreferrer">Official Endoscapes source ↗</a><p className="text-xs text-muted-foreground">Murali et al. (2023), arXiv:2312.12429</p></CardContent>
        </Card>
      </aside>
      <Tabs value={frameEvidenceMode} onValueChange={value=>{if(value==='labels'||value==='model')setFrameEvidenceMode(value)}} className="col-span-full min-w-0 flex-col">
        <TabsList aria-label="Surgical frame evidence sections"><TabsTrigger value="labels">CVS source labels</TabsTrigger>{!guided&&<TabsTrigger value="model">Model evidence</TabsTrigger>}</TabsList>
        <TabsContent value="labels" className="mt-3 grid gap-4 lg:grid-cols-2">
        {!guided&&<Card><CardHeader><CardDescription>Dataset-level reference</CardDescription><CardTitle>CVS label coverage</CardTitle><CardDescription>Image-level label availability across the checksum-verified Endoscapes-BBox201 splits.</CardDescription></CardHeader><CardContent>
          {cvsCoverage?<><p className="text-sm font-medium tabular-nums">{cvsCoverage.complete_label_frames.toLocaleString()} of {cvsCoverage.verified_frames.toLocaleString()} frames include all three source labels.</p><div className="flex flex-wrap gap-1.5">{cvsCoverage.splits.map(split=><Badge variant="outline" key={split.split}>{split.split} · {split.complete_label_frames.toLocaleString()}/{split.verified_frames.toLocaleString()}</Badge>)}</div><div className="grid gap-2">{cvsCoverage.criteria.map(criterion=><div className="grid gap-1 rounded-md bg-muted/30 p-2" key={criterion.criterion_id}><b className="text-sm font-medium">{criterion.criterion_label}</b><span className="text-xs text-muted-foreground">{criterion.labelled_frames.toLocaleString()} labels · {criterion.fractional_mean_frames.toLocaleString()} fractional means</span></div>)}</div><p className="text-xs leading-relaxed text-muted-foreground">{cvsCoverage.interpretation_note}</p><a href="https://github.com/CAMMA-public/Endoscapes#file-structure" target="_blank" rel="noreferrer">How the source labels are defined ↗</a><details className="grid gap-1 text-xs"><summary className="cursor-pointer text-muted-foreground">COCO annotation hashes</summary>{cvsCoverage.splits.map(split=><code className="block break-all text-muted-foreground" key={split.split}>{split.split} · {split.annotation_sha256}</code>)}</details></>:cvsCoverageError?<Alert variant="destructive"><AlertDescription>Source label coverage is unavailable: {cvsCoverageError}</AlertDescription></Alert>:<Skeleton className="h-24"/>}
        </CardContent></Card>}
        <Card><CardHeader className="gap-1"><CardDescription>{guided&&!referenceIsReleased?'CVS values withheld':'CVS source values'}</CardDescription><CardTitle>Image-level label array</CardTitle></CardHeader><CardContent className="grid gap-3"><CardDescription>{guided&&!referenceIsReleased?'The source values are released after educator review.':<>Original COCO <code>ds</code> values are shown as stored; no per-expert attribution is inferred.</>}</CardDescription><div className="grid grid-cols-3 gap-1.5">{(displayedCvs.length?displayedCvs:[null,null,null]).map((value,index)=><div className="grid gap-1 rounded-md border p-2" key={index}><span className="text-xs text-muted-foreground">Value {index+1}</span><b className="font-mono text-xs tabular-nums">{value===null?'—':value.toFixed(3)}</b></div>)}</div><p className="text-xs leading-relaxed text-muted-foreground">Reference annotations support research review. They do not indicate surgical safety or clearance.</p></CardContent></Card>
        </TabsContent>
        {!guided&&<TabsContent value="model" className="mt-3">
        <Card><CardHeader><CardDescription>Single-frame research inference</CardDescription><CardTitle>CVS-AdaptNet</CardTitle><CardDescription>Scores compare this frame with the three pinned source prompts. They are not calibrated probabilities, surgical clearance or clinical guidance.</CardDescription></CardHeader><CardContent>
          <Badge variant={cvsValidation?.executable?'secondary':'outline'}>{cvsValidation?.executable?'Ready for local research run':cvsValidation?'Blocked':'Checking model gate'}</Badge>
          {cvsValidation&&!cvsValidation.executable&&<ul className="mt-3 grid gap-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">{cvsValidation.blockers.map(item=><li key={item}>{item}</li>)}</ul>}
          {cvsError&&<p className="mt-2.5 text-xs leading-relaxed text-destructive" role="alert">{cvsError}</p>}
          {cvsRun?.results&&<div className="mt-3 grid" aria-label="CVS-AdaptNet frame scores">{cvsCriteria.map((criterion,index)=><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b py-2.5 first:border-t" key={criterion}><span className="text-xs leading-relaxed">{criterion}</span><b className="text-sm tabular-nums">{cvsRun.results!.scores[index]?.toFixed(3)??'—'}</b><small className="col-span-full text-xs text-muted-foreground">Expert reference: {frame.cvs_criteria[index]===undefined?'no label':`${describeAnnotatorMean(frame.cvs_criteria[index])} (mean ${frame.cvs_criteria[index].toFixed(2)})`}</small></div>)}</div>}
          {cvsRun?.status==='failed'&&<p className="mt-2.5 text-xs leading-relaxed text-destructive">The saved worker run failed ({cvsRun.failure_code??'unknown error'}); no scores were produced.</p>}
        </CardContent><CardFooter className="flex flex-wrap items-start justify-between gap-3 text-xs text-muted-foreground"><span>{cvsRun?`Saved run ${cvsRun.id}`:'Results are saved with frame, annotation, prompt and model hashes.'}</span><Button variant="outline" size="sm" onClick={runCvsModel} disabled={!cvsValidation?.executable||cvsLoading}>{cvsLoading?<LoaderCircle data-icon="inline-start" className="animate-spin"/>:<FlaskConical data-icon="inline-start"/>}{cvsLoading?'Running…':'Run on this frame'}</Button></CardFooter></Card>
        </TabsContent>}
      </Tabs>
    </div>
    {!guided&&<SurgicalFrameTools currentFrameId={activeFrameId}/>}
    <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><AlertCircle className="mt-0.5 size-4 shrink-0"/><span>Local non-commercial research sample · CC BY-NC-SA 4.0 · do not redistribute this frame or annotations.</span></div>
      </TabsContent>
    </Tabs>
  </section>
}

function paintCocoMask(target:Uint8ClampedArray,width:number,height:number,encoded:string,color:string){
  const counts:number[]=[]
  for(let position=0;position<encoded.length;){
    let value=0,shift=0,more=true
    while(more){
      const chunk=encoded.charCodeAt(position++)-48
      if(chunk<0||chunk>63)throw new Error('Invalid compressed COCO RLE')
      value|=(chunk&0x1f)<<shift
      more=(chunk&0x20)!==0
      shift+=5
      if(!more&&(chunk&0x10))value|=(-1)<<shift
    }
    if(counts.length>2)value+=counts[counts.length-2]
    if(value<0||value>width*height)throw new Error('Invalid COCO RLE run')
    counts.push(value)
  }
  const colorMatch=color.match(/^#([0-9a-f]{6})$/i)
  if(!colorMatch)return
  const rgb=[parseInt(colorMatch[1].slice(0,2),16),parseInt(colorMatch[1].slice(2,4),16),parseInt(colorMatch[1].slice(4,6),16)]
  let offset=0
  for(let run=0;run<counts.length;run++){
    const end=offset+counts[run]
    if(run%2===1){
      for(let index=offset;index<end;index++){
        const x=Math.floor(index/height),y=index%height,pixel=(y*width+x)*4
        target[pixel]=rgb[0];target[pixel+1]=rgb[1];target[pixel+2]=rgb[2];target[pixel+3]=94
      }
    }
    offset=end
  }
  if(offset!==width*height)throw new Error('COCO RLE does not match mask dimensions')
}

function Annotation({annotation,selected,onSelect}:{annotation:SurgicalAnnotation;selected:boolean;onSelect:()=>void}) {
  const [x,y,w,h]=annotation.bbox,color=categoryColors[annotation.category_name]??'#fff'
  return <g onClick={onSelect} className="surgi-box" role="button" tabIndex={0} aria-label={`${pretty(annotation.category_name)} reference box`} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect()}}}>
    <rect x={x} y={y} width={w} height={h} fill={color} fillOpacity={selected ? 0.16 : 0.035} stroke={color} strokeWidth={selected?3:2} vectorEffect="non-scaling-stroke"/>
    <text x={x+4} y={Math.max(15,y-5)} fill={color}>{pretty(annotation.category_name)}</text>
  </g>
}
