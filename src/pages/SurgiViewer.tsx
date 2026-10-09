import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Check, Download, FlaskConical, Image, LoaderCircle, Move, Save, ZoomIn, ZoomOut } from 'lucide-react'
import { api, type CvsCoverage, type CvsInferenceRunRecord, type EvidenceReport, type ModelValidation, type StudentReferenceEvidence, type StudentSurgiViewerEvidence, type StudentViewerEvidence, type SurgicalAnnotation, type SurgicalFrameRecord } from '../lib/api'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { parseSurgicalViewPreferences, type SurgicalViewPreferences } from '@/lib/workspace-preferences'
import { buildSurgicalFrameReport } from '@/lib/surgical-evidence'

type FrameOption={id:string;label:string}

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

export function SurgiViewer({frameId,availableFrameIds,guided=false,releasedReference,viewerEvidence,onEvidenceChange,locked=false}:{frameId:string;availableFrameIds:string[];guided?:boolean;releasedReference?:StudentReferenceEvidence|null;viewerEvidence?:StudentViewerEvidence|null;onEvidenceChange?:(evidence:StudentSurgiViewerEvidence)=>void;locked?:boolean}) {
  const navigate=useNavigate()
  const maskCanvas=useRef<HTMLCanvasElement>(null)
  const viewportRef=useRef<HTMLDivElement>(null)
  const savedPreferences=useMemo(()=>guided?null:readSurgicalViewPreferences(frameId),[guided,frameId])
  const [activeFrameId,setActiveFrameId]=useState(frameId)
  const [frameSearch,setFrameSearch]=useState('')
  const [frame,setFrame]=useState<SurgicalFrameRecord|null>(null)
  const [imageUrl,setImageUrl]=useState('')
  const [imageError,setImageError]=useState('')
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
  const setScale=(value:number)=>{const next=Math.max(1,Math.min(3,value));setZoom(next);if(next===1)setPan({x:0,y:0})}
  useEffect(()=>{if(guided||!frame||frame.id!==activeFrameId)return;const bounds=viewportRef.current?.getBoundingClientRect();if(!bounds||bounds.width<=0||bounds.height<=0)return;const clampRatio=(value:number,size:number)=>Math.max(-2,Math.min(2,value/size));try{localStorage.setItem(`medforge:surgivision:${activeFrameId}`,JSON.stringify({frame_id:activeFrameId,show_boxes:showBoxes,zoom,selected_annotation_id:selected,pan_ratio:{x:clampRatio(pan.x,bounds.width),y:clampRatio(pan.y,bounds.height)}} satisfies SurgicalViewPreferences & {frame_id:string}))}catch{/* Local persistence is optional when browser storage is unavailable. */}},[guided,activeFrameId,frame,showBoxes,zoom,selected,pan])
  useEffect(()=>{if(guided||!frame||frame.id!==activeFrameId)return;const bounds=viewportRef.current?.getBoundingClientRect();if(savedPreferences&&bounds&&bounds.width>0&&bounds.height>0)setPan({x:savedPreferences.pan_ratio.x*bounds.width,y:savedPreferences.pan_ratio.y*bounds.height})},[guided,frame,activeFrameId,savedPreferences])
  useEffect(()=>{if(viewerEvidence?.kind==='surgivision'){const point={x:viewerEvidence.selection_x_px,y:viewerEvidence.selection_y_px};setEvidencePoint(point);setCoordinateDraft({x:String(point.x),y:String(point.y)})}else{setEvidencePoint(null);setCoordinateDraft({x:'',y:''})}},[viewerEvidence])
  useEffect(()=>setActiveFrameId(frameId),[frameId])
  useEffect(()=>{
    if(guided)return
    let live=true
    api.surgicalCoverage().then(value=>{if(live)setCvsCoverage(value)}).catch(error=>{if(live)setCvsCoverageError(error instanceof Error?error.message:'Source label coverage could not be loaded')})
    return()=>{live=false}
  },[guided])
  useEffect(()=>{
    setCvsValidation(null);setCvsRun(null);setCvsError('')
    if(guided)return
    let live=true
    api.validateModel('cvs-adaptnet',activeFrameId,'cvs.inference')
      .then(value=>{if(live)setCvsValidation(value)})
      .catch(error=>{if(live)setCvsError(error instanceof Error?error.message:'Model readiness could not be checked')})
    api.runs().then(records=>{
      if(live)setCvsRun(records.find((item):item is CvsInferenceRunRecord=>item.operation_id==='cvs.inference'&&item.case_id===activeFrameId)??null)
    }).catch(()=>{})
    return()=>{live=false}
  },[activeFrameId,guided])
  useEffect(()=>{let live=true;const saved=guided?null:readSurgicalViewPreferences(activeFrameId);setLoading(true);setFrame(null);setSelected(saved?.selected_annotation_id??null);setShowBoxes(saved?.show_boxes??true);setScale(saved?.zoom??1);setPan({x:0,y:0});api.surgicalFrame(activeFrameId).then(value=>{if(live){setFrame(value);setError('')}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Unable to load local frame')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[activeFrameId,guided])
  useEffect(()=>{let live=true;let objectUrl='';setImageUrl('');setImageError('');api.surgicalImage(activeFrameId).then(url=>{objectUrl=url;if(live)setImageUrl(url);else URL.revokeObjectURL(url)}).catch(e=>{if(live)setImageError(e instanceof Error?e.message:'Unable to load the assigned source image')});return()=>{live=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[activeFrameId])
  const referenceIsReleased=Boolean(frame && releasedReference?.case_id===frame.id)
  const displayedAnnotations=useMemo(()=>referenceIsReleased ? releasedReference!.annotations : frame?.annotations ?? [],[referenceIsReleased,releasedReference,frame])
  const displayedCvs=useMemo(()=>referenceIsReleased ? releasedReference!.cvs_criteria : frame?.cvs_criteria ?? [],[referenceIsReleased,releasedReference,frame])
  const selectedAnnotation=useMemo(()=>displayedAnnotations.find(a=>a.id===selected)??null,[displayedAnnotations,selected])
  useEffect(()=>{if(frame&&selected!==null&&!frame.annotations.some(annotation=>annotation.id===selected))setSelected(null)},[frame,selected])
  const frameOptions=useMemo<FrameOption[]>(()=>availableFrameIds.map(id=>{
    const [,split,stem]=id.split(':')
    const [video,frameNumber]=stem?.split('_')??[]
    return {id,label:`${split} · video ${video} · frame ${frameNumber}`}
  }),[availableFrameIds])
  const visibleFrameOptions=useMemo(()=>{
    const query=frameSearch.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    const matches=query.length?frameOptions.filter(option=>{
      const searchable=`${option.label} ${option.id}`.toLocaleLowerCase().replace(/[^a-z0-9]+/g,' ')
      return query.every(term=>searchable.includes(term.replace(/[^a-z0-9]+/g,' ')))
    }):[]
    const visible=matches.slice(0,50)
    const selected=frameOptions.find(option=>option.id===activeFrameId)
    if(!query.length&&selected)visible.push(selected)
    return visible
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
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        {guided ? (
          <>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Assigned source frame</p>
            <p className="m-0 truncate text-sm font-semibold">{referenceIsReleased ? 'Reference annotations released after educator review' : 'One checksum-verified frame · reference labels withheld'}</p>
          </>
        ) : (
          <>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" id="endoscapes-frame-label">Endoscapes sampled frame</label>
            <Combobox
              items={visibleFrameOptions}
              filter={null}
              value={selectedFrameOption}
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
              <ComboboxInput className="w-full md:max-w-xl" id="endoscapes-frame" aria-labelledby="endoscapes-frame-label" aria-label="Search installed source frames" placeholder="Search split, video, or frame" showClear />
              <ComboboxContent>
                <ComboboxEmpty>No matching Endoscapes frames.</ComboboxEmpty>
                <ComboboxList>{option => <ComboboxItem key={option.id} value={option}>{option.label}</ComboboxItem>}</ComboboxList>
              </ComboboxContent>
            </Combobox>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">{frame.split}</Badge><Badge variant="outline">Video {frame.video_id} · frame {frame.frame_number}</Badge><Badge variant="outline">{frame.width} × {frame.height} px</Badge>{guided&&!referenceIsReleased?<Badge variant="outline">Reference labels withheld</Badge>:<><Badge variant="outline">{displayedAnnotations.length} annotations</Badge><Badge variant="outline">{displayedAnnotations.filter(annotation=>annotation.segmentation&&!Array.isArray(annotation.segmentation)).length} RLE masks</Badge>{!guided&&<span className="text-[11px]">{availableFrameIds.length.toLocaleString()} verified frames</span>}</>}</div>
    </div>
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
        {!guided&&<div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-2.5 py-2"><span className="text-xs font-medium text-muted-foreground">Source overlays</span><ToggleGroup multiple variant="outline" size="sm" aria-label="Surgical source overlays" value={[...(showBoxes?['boxes']:[]),...(showMasks?['masks']:[])]} onValueChange={value=>{setShowBoxes(value.includes('boxes'));setShowMasks(value.includes('masks'))}}><ToggleGroupItem value="boxes" aria-label="Toggle official COCO boxes">COCO boxes</ToggleGroupItem><ToggleGroupItem value="masks" aria-label="Toggle official RLE masks">RLE masks</ToggleGroupItem></ToggleGroup></div>}
        {!guided&&saveFrameReportError&&<Alert variant="destructive"><AlertDescription>{saveFrameReportError}</AlertDescription></Alert>}
        {!guided&&reportMatchesView&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><Check className="text-primary"/>Frame evidence saved to Reports.</span><Link className="font-medium text-primary underline-offset-4 hover:underline" to="/studio/reports">View report history</Link></div>}
        <div ref={viewportRef} className={`surgi-canvas${zoom>1?' is-zoomed':''}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={()=>setDrag(null)} onPointerCancel={()=>setDrag(null)} onWheel={event=>{if(event.ctrlKey){event.preventDefault();setScale(zoom+(event.deltaY<0?.1:-.1))}}}>
          <div className="surgi-frame-transform" onClick={selectEvidencePoint} style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,aspectRatio:`${frame.width}/${frame.height}`,cursor:guided&&!locked&&!referenceIsReleased?'crosshair':undefined}}>
            {imageUrl?<img src={imageUrl} alt={`Endoscapes source image, ${frame.split} split, video ${frame.video_id}, frame ${frame.frame_number}`} draggable={false}/>:<div className="grid h-full place-items-center px-4 text-center text-sm text-muted-foreground">{imageError||'Loading assigned source image…'}</div>}
            <canvas ref={maskCanvas} className="surgi-mask-layer" aria-hidden="true"/>
            {(showBoxes||(guided&&evidencePoint))&&<svg className="surgi-annotation-layer" viewBox={`0 0 ${frame.width} ${frame.height}`} preserveAspectRatio="none" role="group" aria-label="Official COCO reference boxes">
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
      <Tabs defaultValue="labels" className="col-span-full min-w-0 flex-col">
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
          {cvsRun?.results&&<div className="mt-3 grid" aria-label="CVS-AdaptNet frame scores">{cvsCriteria.map((criterion,index)=><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b py-2.5 first:border-t" key={criterion}><span className="text-xs leading-relaxed">{criterion}</span><b className="text-sm tabular-nums">{cvsRun.results!.scores[index]?.toFixed(3)??'—'}</b><small className="col-span-full text-xs text-muted-foreground">Source label: {frame.cvs_criteria[index]?.toFixed(0)??'—'}</small></div>)}</div>}
          {cvsRun?.status==='failed'&&<p className="mt-2.5 text-xs leading-relaxed text-destructive">The saved worker run failed ({cvsRun.failure_code??'unknown error'}); no scores were produced.</p>}
        </CardContent><CardFooter className="flex flex-wrap items-start justify-between gap-3 text-xs text-muted-foreground"><span>{cvsRun?`Saved run ${cvsRun.id}`:'Results are saved with frame, annotation, prompt and model hashes.'}</span><Button variant="outline" size="sm" onClick={runCvsModel} disabled={!cvsValidation?.executable||cvsLoading}>{cvsLoading?<LoaderCircle data-icon="inline-start" className="animate-spin"/>:<FlaskConical data-icon="inline-start"/>}{cvsLoading?'Running…':'Run on this frame'}</Button></CardFooter></Card>
        </TabsContent>}
      </Tabs>
    </div>
    <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><AlertCircle className="mt-0.5 size-4 shrink-0"/><span>Local non-commercial research sample · CC BY-NC-SA 4.0 · do not redistribute this frame or annotations.</span></div>
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
