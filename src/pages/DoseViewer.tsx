import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Activity, CircleAlert, Database, Expand, Eye, EyeOff, Layers3, LoaderCircle, Move, ZoomIn, ZoomOut } from 'lucide-react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { api, type DvhSummary, type StudentDoseViewerEvidence, type VoxelSlice, type ViewerEvidenceState } from '../lib/api'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Toggle } from '@/components/ui/toggle'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { queryKeys } from '@/lib/query-client'
import { DOSE_ROIS, SYNTHETIC_DOSE_ROIS, parseDoseWorkspacePreferences } from '@/lib/workspace-preferences'
const DoseTwinSurfaceViewer=lazy(()=>import('@/features/dosetwin/DoseTwinSurfaceViewer').then(module=>({default:module.DoseTwinSurfaceViewer})))
const DoseTwinComparisonPanel=lazy(()=>import('@/features/dosetwin/DoseTwinComparisonPanel').then(module=>({default:module.DoseTwinComparisonPanel})))
import { clampDoseIndex, crosshairForPlane, renderDoseSlicePixels, slicePointFromCanvasPosition, voxelFromPlaneSelection, voxelWithAxisIndex, type DoseAxis, type DoseVoxel } from '@/lib/dose-visualization'

const axes=[0,1,2] as const
type Axis=DoseAxis
const axisDescriptors={
  0:{title:'X-index plane',indexLabel:'X index',rowAxis:'Y',columnAxis:'Z'},
  1:{title:'Y-index plane',indexLabel:'Y index',rowAxis:'X',columnAxis:'Z'},
  2:{title:'Z-index plane',indexLabel:'Z index',rowAxis:'X',columnAxis:'Y'},
} satisfies Record<Axis,{title:string;indexLabel:string;rowAxis:string;columnAxis:string}>
type RoiPlane={name:string;values:number[]}
type SlicePack={ct:VoxelSlice;dose:VoxelSlice;rois:RoiPlane[]}
type Voxel=DoseVoxel
const roiColors:Record<string,[number,number,number]>={Brainstem:[255,205,86],SpinalCord:[95,211,195],RightParotid:[248,133,123],LeftParotid:[155,140,255],Esophagus:[255,161,92],Larynx:[113,184,255],Mandible:[229,121,187],PTV56:[227,231,111],PTV63:[249,178,92],PTV70:[245,120,100],Target:[245,120,100],'OAR-Cylinder-A':[95,211,195],'OAR-Cylinder-B':[248,133,123]}

function readDoseWorkspaceState(caseId:string):ViewerEvidenceState|null{
 try{const raw=localStorage.getItem(`medforge:dose-viewer:${caseId}`);return raw?parseDoseWorkspacePreferences(caseId,JSON.parse(raw)):null}
 catch{/* Ignore unavailable storage and malformed saved state. */return null}
}

function DoseScaleLegend({doseMaxGy,synthetic,selectedRois}:{doseMaxGy:number;synthetic:boolean;selectedRois:string[]}){
 const unit=synthetic?'synthetic units':'Gy'
 return <div role="group" className="grid gap-1.5 rounded-md border border-border bg-background px-3 py-2" aria-label="Primary dose color scale">
  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{synthetic?'Synthetic illustrative dose scale · not physical Gy':'OpenKBP reference dose · fixed case scale'}</span><span className="font-mono">Maximum {doseMaxGy.toFixed(1)} {unit}</span></div>
  <div className="h-2.5 rounded-sm" aria-hidden="true" style={{background:'linear-gradient(90deg, rgb(58,77,207) 0%, rgb(32,157,190) 38%, rgb(239,139,91) 72%, rgb(255,222,134) 100%)'}}/>
  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground"><span>0 {unit}</span><span>{(doseMaxGy*.5).toFixed(1)} {unit}</span><span>{doseMaxGy.toFixed(1)} {unit}</span></div>
  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">{selectedRois.map(name=><span key={name} className="flex items-center gap-2"><i className="size-2 rounded-full" style={{backgroundColor:`rgb(${roiColors[name]?.join(',')??'130,190,220'})`}}/>{name} boundary</span>)}</div>
 </div>
}

function SliceCanvas({pack,axis,coordinates,showDose,showRoi,opacity,doseMaxGy,ctRange,spacingMm,zoom,pan,panMode,onPanChange,onPick,locked,size,synthetic}:{pack:SlicePack;axis:Axis;coordinates:Voxel;showDose:boolean;showRoi:boolean;opacity:number;doseMaxGy:number|null;ctRange:[number,number]|null;spacingMm:[number,number,number]|null;zoom:number;pan:{x:number;y:number};panMode:boolean;onPanChange:(value:{x:number;y:number})=>void;onPick:(row:number,column:number)=>void;locked:boolean;size:'primary'|'secondary';synthetic:boolean}){
 const ref=useRef<HTMLCanvasElement>(null)
 const drag=useRef<{x:number;y:number;px:number;py:number}|null>(null)
 const suppressClick=useRef(false)
 const [fitSize,setFitSize]=useState<{width:number;height:number}>({width:0,height:0})
 const rowAxis=axis===0?1:axis===1?0:0,columnAxis=axis===2?1:2
 const physicalAspect=spacingMm?spacingMm[columnAxis]/spacingMm[rowAxis]:1
 useEffect(()=>{const parent=ref.current?.parentElement;if(!parent)return
  const fit=()=>{const maxWidth=Math.max(0,parent.clientWidth-16),maxHeight=Math.max(0,parent.clientHeight-16),cap=size==='primary'?760:320
   const width=Math.min(maxWidth,cap,maxHeight*physicalAspect),height=physicalAspect>0?width/physicalAspect:0
   setFitSize(previous=>previous.width===width&&previous.height===height?previous:{width,height})
  }
  fit();const observer=new ResizeObserver(fit);observer.observe(parent);return()=>observer.disconnect()
 },[physicalAspect,size])
 useEffect(()=>{const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return
  const image=ctx.createImageData(128,128)
  image.data.set(renderDoseSlicePixels(pack.ct.values,pack.dose.values,pack.rois[0]?.values??new Float32Array(128*128),{showDose,showRoi,opacity,doseMaxGy:doseMaxGy??undefined,ctRange,roiLayers:pack.rois.map(layer=>({values:layer.values,color:roiColors[layer.name]}))}))
  ctx.putImageData(image,0,0)
  const {row,column}=crosshairForPlane(axis,coordinates)
  ctx.save();ctx.strokeStyle='rgba(237,255,252,.82)';ctx.lineWidth=.7;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(column+.5,0);ctx.lineTo(column+.5,128);ctx.moveTo(0,row+.5);ctx.lineTo(128,row+.5);ctx.stroke();ctx.restore()
 },[pack,axis,coordinates,showDose,showRoi,opacity,doseMaxGy,ctRange])
 const pick=(event:React.MouseEvent<HTMLCanvasElement>)=>{if(panMode||suppressClick.current){suppressClick.current=false;return}if(locked)return;const box=event.currentTarget.getBoundingClientRect(),point=slicePointFromCanvasPosition(event.clientX,event.clientY,box);if(point)onPick(point.row,point.column)}
 const pointerDown=(event:React.PointerEvent<HTMLCanvasElement>)=>{if(!panMode)return;event.currentTarget.setPointerCapture(event.pointerId);drag.current={x:event.clientX,y:event.clientY,px:pan.x,py:pan.y};suppressClick.current=false}
 const pointerMove=(event:React.PointerEvent<HTMLCanvasElement>)=>{if(!drag.current)return;const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>2)suppressClick.current=true;onPanChange({x:drag.current.px+dx,y:drag.current.py+dy})}
 const pointerUp=()=>{drag.current=null}
 const descriptor=axisDescriptors[axis]
 return <canvas ref={ref} onClick={pick} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} className={`max-h-full [image-rendering:pixelated] ${panMode?'cursor-grab active:cursor-grabbing':'cursor-crosshair'}`} style={{width:fitSize.width||undefined,height:fitSize.height||undefined,aspectRatio:String(physicalAspect),transform:`translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,transformOrigin:'center center'}} width={128} height={128} role="img" aria-label={`${synthetic?'Synthetic phantom':'OpenKBP processed-array'} ${descriptor.title.toLowerCase()} at ${descriptor.indexLabel.toLowerCase()} ${coordinates[axis]}; rows are ${descriptor.rowAxis} indices and columns are ${descriptor.columnAxis} indices${spacingMm?`; ${synthetic?'illustrative voxel spacing':'physical voxel spacing'} is ${spacingMm[rowAxis]} mm by ${spacingMm[columnAxis]} mm`:''}${synthetic?'; dose uses an arbitrary illustrative scale, not physical Gy; not anatomy or a treatment plan':''}. ${panMode?'Drag to pan.':'Click to move the linked voxel.'}`}/>
}

function DosePlane({caseId,axis,index,coordinates,selectedRois,showDose,showRoi,opacity,doseMaxGy,ctRange,spacingMm,zoom,pan,panMode,onPanChange,onCoordinateChange,onIndexChange,onCtHash,locked,size='primary'}:{caseId:string;axis:Axis;index:number;coordinates:Voxel;selectedRois:string[];showDose:boolean;showRoi:boolean;opacity:number;doseMaxGy:number|null;ctRange:[number,number]|null;spacingMm:[number,number,number]|null;zoom:number;pan:{x:number;y:number};panMode:boolean;onPanChange:(value:{x:number;y:number})=>void;onCoordinateChange:(axis:Axis,row:number,column:number)=>void;onIndexChange:(axis:Axis,index:number)=>void;onCtHash:(hash:string)=>void;locked:boolean;size?:'primary'|'secondary'}){
 const descriptor=axisDescriptors[axis]
 const synthetic=caseId==='synthetic-dose:phantom-v1'
 const viewportRef=useRef<HTMLDivElement>(null)
 const [isFullscreen,setIsFullscreen]=useState(false)
 useEffect(()=>{const sync=()=>setIsFullscreen(document.fullscreenElement===viewportRef.current);document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync)},[])
 const sliceQuery=useQuery({
  queryKey:[...queryKeys.cases,'slice',caseId,axis,index,selectedRois],
  queryFn:async()=>{const [ct,dose,...masks]=await Promise.all([api.slice(caseId,axis,index,'ct',selectedRois[0]),api.slice(caseId,axis,index,'dose',selectedRois[0]),...selectedRois.map(name=>api.slice(caseId,axis,index,'roi',name))]);return {ct,dose,rois:selectedRois.map((name,i)=>({name,values:masks[i].values}))} satisfies SlicePack},
 })
 const pack=sliceQuery.data??null,busy=sliceQuery.isPending,error=sliceQuery.error?.message??''
 const samplePoint=crosshairForPlane(axis,coordinates)
 const sampleOffset=samplePoint.row*128+samplePoint.column
 const selectedSample=pack?{
  ct:pack.ct.values[sampleOffset],
  dose:pack.dose.values[sampleOffset],
  structures:pack.rois.map(layer=>({name:layer.name,inside:layer.values[sampleOffset]>0})),
 }:null
 const formatSourceValue=(value:number|undefined)=>typeof value==='number'&&Number.isFinite(value)?value.toFixed(4):'Unavailable'
 useEffect(()=>{if(pack)onCtHash(pack.ct.source_sha256)},[pack,onCtHash])
 return <Card className="group overflow-hidden rounded-xl border border-border/80 bg-card/90 shadow-sm" size="sm">
  <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
   <div>
    <CardTitle className="flex items-center gap-2 text-sm font-medium"><Layers3 className="size-4 text-primary"/>{descriptor.title}</CardTitle>
    <CardDescription className="mt-1">Fixed {descriptor.indexLabel.toLowerCase()} · {index}</CardDescription>
   </div>
   <CardAction><Field orientation="horizontal" className="items-center gap-2"><FieldLabel className="text-xs text-muted-foreground" htmlFor={`dose-axis-${axis}`}>{descriptor.indexLabel}</FieldLabel><Input className="h-8 w-[4.25rem] font-mono tabular-nums" id={`dose-axis-${axis}`} type="number" min={0} max={127} step={1} value={index} disabled={locked} onChange={e=>onIndexChange(axis,clampDoseIndex(Number(e.target.value)||0))}/></Field></CardAction>
  </CardHeader>
   <CardContent className="grid gap-3 p-4 pt-3">
   <div ref={viewportRef} className={`relative grid ${size==='primary'?'aspect-square min-h-0 max-h-[min(72vh,760px)]':'h-[min(38vh,344px)] min-h-64'} place-items-center overflow-hidden rounded-lg border border-[#34415C] bg-[#101624] p-2 [&:fullscreen]:min-h-screen [&:fullscreen]:rounded-none`} tabIndex={0} role="group" aria-label={`${synthetic?'Synthetic phantom':'OpenKBP'} ${descriptor.title} imaging viewport`} onWheel={event=>{event.preventDefault();if(!locked)onIndexChange(axis,index+(event.deltaY>0?1:-1))}} onKeyDown={event=>{if(locked)return;if(event.key==='ArrowDown'||event.key==='ArrowRight'){event.preventDefault();onIndexChange(axis,index+1)}else if(event.key==='ArrowUp'||event.key==='ArrowLeft'){event.preventDefault();onIndexChange(axis,index-1)}}}>{busy?<div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/>{synthetic?'Generating phantom slice…':'Reading source arrays…'}</div>:error?<div className="flex items-center gap-2 text-sm text-amber-300"><CircleAlert className="size-4"/>{error}</div>:pack&&<SliceCanvas pack={pack} axis={axis} coordinates={coordinates} showDose={showDose} showRoi={showRoi} opacity={opacity} doseMaxGy={doseMaxGy} ctRange={ctRange} spacingMm={spacingMm} zoom={zoom} pan={pan} panMode={panMode} onPanChange={onPanChange} onPick={(row,column)=>onCoordinateChange(axis,row,column)} locked={locked} size={size} synthetic={synthetic}/>}<Button type="button" variant="outline" size="icon-sm" className="absolute right-3 top-3 z-10 border-white/20 bg-[#101624]/90 text-white hover:bg-[#202b41] hover:text-white" aria-label={isFullscreen?'Exit fullscreen':'View fullscreen'} onClick={()=>{if(isFullscreen)void document.exitFullscreen();else void viewportRef.current?.requestFullscreen()}}><Expand/></Button></div>
   {size==='primary'&&doseMaxGy!==null&&<DoseScaleLegend doseMaxGy={doseMaxGy} synthetic={synthetic} selectedRois={selectedRois}/>}
   {size==='primary'&&selectedSample&&<section aria-label="Selected voxel source sample" className="grid gap-2 rounded-md border border-border bg-background px-3 py-2.5">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h4 className="m-0 text-xs font-semibold">Selected voxel sample</h4><span className="font-mono text-[11px] tabular-nums text-muted-foreground">x {coordinates[0]} · y {coordinates[1]} · z {coordinates[2]}</span></div>
    <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-3">
     <div><dt className="text-[10px] text-muted-foreground">{synthetic?'Relative density array':'CT source value'}</dt><dd className="m-0 font-mono text-xs tabular-nums">{formatSourceValue(selectedSample.ct)} <span className="font-sans text-[10px] text-muted-foreground">{pack?.ct.unit}</span></dd></div>
     <div><dt className="text-[10px] text-muted-foreground">{synthetic?'Illustrative dose array':'Reference dose array'}</dt><dd className="m-0 font-mono text-xs tabular-nums">{formatSourceValue(selectedSample.dose)} <span className="font-sans text-[10px] text-muted-foreground">{pack?.dose.unit}</span></dd></div>
     <div className="col-span-2 sm:col-span-1"><dt className="text-[10px] text-muted-foreground">Selected structures</dt><dd className="m-0 text-xs">{selectedSample.structures.length?selectedSample.structures.map(item=><span key={item.name} className="mr-2 inline-flex items-center gap-1.5"><i className="size-1.5 rounded-full" style={{backgroundColor:`rgb(${roiColors[item.name]?.join(',')??'130,190,220'})`}}/>{item.name}: {item.inside?'inside mask':'outside mask'}</span>):'No ROI mask loaded'}</dd></div>
    </dl>
    <p className="m-0 text-[10px] leading-4 text-muted-foreground">Read directly from the active CT, dose and mask slices at the linked processed-grid index; dose source: {pack?.dose.source_file}. Source units and reference status are preserved.</p>
   </section>}
   <div role="group" aria-label={`${descriptor.indexLabel} slice control`} className="grid gap-1 px-1">
    <div className="flex items-center justify-between text-xs"><span className="font-medium">Scrub slice</span><span className="font-mono tabular-nums text-muted-foreground">{index} / 127</span></div>
    <Slider aria-label={`${descriptor.indexLabel} slice index`} min={0} max={127} step={1} value={[index]} disabled={locked} onValueChange={value=>{const next=Array.isArray(value)?value[0]:value;onIndexChange(axis,clampDoseIndex(next))}}/>
    <div className="flex justify-between font-mono text-[10px] text-muted-foreground"><span>0</span><span>127</span></div>
   </div>
   <p className="m-0 text-xs text-muted-foreground">Rows {descriptor.rowAxis} · columns {descriptor.columnAxis} · {synthetic?'synthetic phantom-grid':'processed-grid'} indices</p>
  </CardContent>
 </Card>
}

function DvhPlot({data,synthetic=false}:{data:DvhSummary[];synthetic?:boolean}){
 const palette=data.map(item=>roiColors[item.roi]??[95,211,195])
 const chartConfig=Object.fromEntries(data.map((item,index)=>[item.roi,{label:item.roi,color:`rgb(${palette[index].join(',')})`}])) as ChartConfig
 const rows=data[0]?.curve.map((point,index)=>Object.fromEntries([['dose_gy',point.dose_gy],...data.map(item=>[item.roi,item.curve[index]?.volume_percent??null])]))??[]
 const maxGy=data[0]?.dose_display_max_gy??0
 return <div className="grid min-w-0 gap-3"><ChartContainer config={chartConfig} className="h-[260px] min-w-0 w-full"><LineChart accessibilityLayer title={`Cumulative dose-volume histograms for ${data.map(item=>item.roi).join(', ')}`} desc={synthetic?'Deterministic synthetic phantom dose-volume curves. Not anatomy or a treatment plan. Use left and right arrow keys to inspect dose-volume points.':'Exploratory OpenKBP reference dose-volume curves share one case-wide Gy scale. Use left and right arrow keys to inspect dose-volume points.'} data={rows} margin={{top:8,right:10,bottom:3,left:-14}}><CartesianGrid stroke="#263c4c" strokeDasharray="3 4" vertical={false}/><XAxis dataKey="dose_gy" type="number" domain={[0,maxGy]} ticks={[0,maxGy*.25,maxGy*.5,maxGy*.75,maxGy]} tick={{fill:'#8da4b2',fontSize:12}} tickFormatter={(v:number)=>Number(v).toFixed(0)} tickLine={false} axisLine={{stroke:'#42596a'}} label={{value:synthetic?'Illustrative synthetic scale':'Dose (Gy)',position:'insideBottom',offset:-1,fill:'#8da4b2',fontSize:12}}/><YAxis domain={[0,100]} tick={{fill:'#8da4b2',fontSize:12}} tickLine={false} axisLine={false} ticks={[0,25,50,75,100]} tickFormatter={(v:number)=>`${v}%`}/><ChartTooltip content={<ChartTooltipContent indicator="line" formatter={value=><span className="font-mono tabular-nums">{Number(value).toFixed(1)}%</span>} labelFormatter={value=>synthetic?`${Number(value).toFixed(2)} synthetic scale units`:`${Number(value).toFixed(2)} Gy`}/>}/>{data.map(item=><Line key={item.roi} type="stepAfter" dataKey={item.roi} name={item.roi} stroke={chartConfig[item.roi]?.color} strokeWidth={2.2} dot={false} isAnimationActive={false}/>)}</LineChart></ChartContainer><details className="group rounded-md border border-border/70 px-3"><summary className="cursor-pointer py-2 text-sm text-muted-foreground">View shared DVH data table · {rows.length} points × {data.length} ROIs</summary><div className="max-h-64 overflow-auto border-t"><Table><TableCaption>{synthetic?'Deterministic synthetic phantom curves on an arbitrary illustrative scale; not physical Gy, anatomy, benchmark metrics, or a treatment plan.':'All curves use the same verified case-wide Gy domain. Exploratory cumulative voxel DVHs; benchmark metrics are shown separately.'}</TableCaption><TableHeader><TableRow><TableHead>{synthetic?'Illustrative synthetic scale':'Dose (Gy)'}</TableHead>{data.map(item=><TableHead key={item.roi}>{item.roi} (%)</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row,index)=><TableRow key={`${row.dose_gy}-${index}`}><TableCell className="font-mono tabular-nums">{Number(row.dose_gy).toFixed(4)}</TableCell>{data.map(item=><TableCell key={item.roi} className="font-mono tabular-nums">{typeof row[item.roi]==='number'?Number(row[item.roi]).toFixed(4):'—'}</TableCell>)}</TableRow>)}</TableBody></Table></div></details></div>
}

export function DoseViewer({caseId,onEvidenceChange,viewerEvidence,locked=false,guided=false,viewerOnly=false}:{caseId:string;onEvidenceChange?:(evidence:StudentDoseViewerEvidence)=>void;viewerEvidence?:StudentDoseViewerEvidence|null;locked?:boolean;guided?:boolean;viewerOnly?:boolean}){
 const synthetic=caseId==='synthetic-dose:phantom-v1'
 const availableStructures:readonly string[]=synthetic?SYNTHETIC_DOSE_ROIS:DOSE_ROIS
 const [searchParams]=useSearchParams(),reviewReportId=searchParams.get('report')
 const reportQuery=useQuery({queryKey:[...queryKeys.reports,'review-source',reviewReportId],queryFn:api.reports,enabled:!!reviewReportId})
 const reviewState=useMemo(()=>{
  const report=reportQuery.data?.find(item=>item.id===reviewReportId&&item.case_id===caseId)
  const saved=report?.document.viewer_state
  const parsed=saved?parseDoseWorkspacePreferences(caseId,saved):null
  return parsed?{...parsed,axis:saved?.axis===0||saved?.axis===1||saved?.axis===2?saved.axis:2}:null
 },[caseId,reportQuery.data,reviewReportId])
 const savedState=useMemo(()=>reviewReportId?null:guided?null:readDoseWorkspaceState(caseId),[caseId,guided,reviewReportId])
 const initialRoi=synthetic?'Target':'Brainstem'
 const restoredRoi=savedState?.roi&&availableStructures.includes(savedState.roi)?savedState.roi:initialRoi
 const [coordinates,setCoordinates]=useState<Voxel>(()=>savedState?.voxel??[64,64,64]),[roi,setRoi]=useState(()=>restoredRoi),[showDose,setShowDose]=useState(()=>savedState?.dose_overlay??true),[showRoi,setShowRoi]=useState(()=>savedState?.roi_overlay??true),[opacity,setOpacity]=useState(()=>savedState?.dose_opacity??.56)
 const [selectedRois,setSelectedRois]=useState<string[]>(()=>[restoredRoi])
 const [ctWindow,setCtWindow]=useState<{caseId:string;range:[number,number]}|null>(null)
 const [ctHash,setCtHash]=useState('')
 const [activeAxis,setActiveAxis]=useState<Axis>(savedState?.axis??2)
 const [is3dOpen,setIs3dOpen]=useState(false)
 const [inspectionTab,setInspectionTab]=useState('measurements')
 const [zoom,setZoom]=useState(1)
 const [pan,setPan]=useState({x:0,y:0})
 const [panMode,setPanMode]=useState(false)
 const dvhQueries=useQueries({queries:selectedRois.map(name=>({queryKey:[...queryKeys.cases,'dvh',caseId,name],queryFn:()=>api.dvh(caseId,name)}))})
 const dvhRecords=dvhQueries.flatMap(query=>query.data?[query.data]:[])
 const activeDvh=dvhRecords.find(record=>record.roi===roi)??null
 const orthogonalAxes=axes.filter(axis=>axis!==activeAxis)
 const dvhBusy=dvhQueries.some(query=>query.isPending),dvhError=dvhQueries.find(query=>query.isError)?.error?.message??''
 const ctDisplayRange=ctWindow?.caseId===caseId?ctWindow.range:activeDvh?.ct_display_range??null
 useEffect(()=>{if(activeDvh&&ctWindow?.caseId!==caseId)setCtWindow({caseId,range:activeDvh.ct_display_range})},[activeDvh,caseId,ctWindow?.caseId])
 useEffect(()=>{if(reviewReportId){if(reviewState){setCoordinates(reviewState.voxel);setRoi(reviewState.roi);setSelectedRois([reviewState.roi]);setShowDose(reviewState.dose_overlay);setShowRoi(reviewState.roi_overlay);setOpacity(reviewState.dose_opacity);setActiveAxis(reviewState.axis)}return}if(guided)return;const state:ViewerEvidenceState={case_id:caseId,voxel:coordinates,axis:activeAxis,roi,dose_overlay:showDose,roi_overlay:showRoi,dose_opacity:opacity};try{localStorage.setItem(`medforge:dose-viewer:${caseId}`,JSON.stringify(state));localStorage.removeItem('medforge-dose-viewer-state')}catch{/* Local persistence is optional when browser storage is unavailable. */}},[caseId,coordinates,activeAxis,roi,showDose,showRoi,opacity,guided,reviewReportId,reviewState])
 useEffect(()=>{if(viewerEvidence?.kind==='dosetwin'&&viewerEvidence.case_id===caseId){setCoordinates(viewerEvidence.voxel);setRoi(viewerEvidence.roi);setSelectedRois([viewerEvidence.roi]);setShowDose(viewerEvidence.dose_overlay);setShowRoi(viewerEvidence.roi_overlay);setOpacity(viewerEvidence.dose_opacity)}},[caseId,viewerEvidence])
 const emitSelection=(patch:Partial<StudentDoseViewerEvidence>={})=>onEvidenceChange?.({kind:'dosetwin',case_id:caseId,voxel:coordinates,roi,dose_overlay:showDose,roi_overlay:showRoi,dose_opacity:opacity,...patch})
 const updateFromPlane=(axis:Axis,row:number,column:number)=>{const next=voxelFromPlaneSelection(coordinates,axis,row,column);setCoordinates(next);emitSelection({voxel:next})}
 const setIndex=(axis:Axis,value:number)=>{const next=voxelWithAxisIndex(coordinates,axis,value);setCoordinates(next);emitSelection({voxel:next})}
 const choosePrimaryRoi=(name:string)=>{setRoi(name);setSelectedRois(current=>current.includes(name)?current:[name,...current].slice(0,5));emitSelection({roi:name})}
 const toggleRoi=(name:string)=>{if(selectedRois.includes(name)){if(selectedRois.length===1)return;const next=selectedRois.filter(item=>item!==name);setSelectedRois(next);if(roi===name){setRoi(next[0]);emitSelection({roi:next[0]})}return}if(selectedRois.length<5)setSelectedRois([...selectedRois,name])}
 const activeDescriptor=axisDescriptors[activeAxis]
 return <section className="grid gap-5">
  {synthetic&&<Alert className="border-amber-500/50 bg-amber-50 text-amber-950"><Database/><AlertTitle>SYNTHETIC PHANTOM · NOT ANATOMY · NOT A TREATMENT PLAN</AlertTitle><AlertDescription>This deterministic water-cylinder phantom is generated locally for software demonstration. It contains a spherical target, two axial cylindrical OAR masks, and an analytic smooth dose falloff. Its 2.5 mm scale is illustrative only. No patient data, medical image, model inference, benchmark, or treatment plan is present.</AlertDescription></Alert>}
  {viewerOnly&&!synthetic&&<Alert className="border-warning/40 bg-warning/5"><Database/><AlertTitle>Read-only source viewer</AlertTitle><AlertDescription>This installed case supports inspection of its CT, reference dose, ROI masks, and dose-volume summaries only. Analysis runs, dose imports, comparisons, and reports are disabled for this case.</AlertDescription></Alert>}
  {reviewReportId&&<div role={reportQuery.isError||(!reportQuery.isPending&&!reviewState)?'alert':'status'} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">{reportQuery.isPending?'Loading the saved DoseTwin view…':reportQuery.isError?'The saved report could not be loaded; this viewer is not showing its recorded state.':reviewState?'Reopened the voxel, plane, ROI and display settings saved with this report.':'This report has no compatible DoseTwin view for the selected case.'}</div>}
  <header className="flex min-w-0 flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
   <div className="min-w-0"><p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-primary">DoseTwin · {synthetic?'synthetic demonstration':'source case'}</p><h2 className="m-0 text-xl font-semibold tracking-tight">{synthetic?'Deterministic phantom inspection':'Linked dose review'}</h2><p className="mb-0 mt-1 max-w-2xl text-sm text-muted-foreground">{synthetic?'Inspect generated 128³ water-cylinder volumes and their analytic dose field. All displayed outputs reproduce from the bundled generator.':'Inspect the reference arrays in one large, index-faithful view. Selecting a voxel updates the linked location across all planes.'}</p></div>
   <span className="rounded-md border border-border bg-card px-3 py-2 font-mono text-xs tabular-nums text-muted-foreground">x {coordinates[0]} <span className="text-border">/</span> y {coordinates[1]} <span className="text-border">/</span> z {coordinates[2]}</span>
  </header>
  <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_304px]">
   <section aria-labelledby="dose-view-title" className="grid min-w-0 gap-3">
    <div className="flex flex-wrap items-end justify-between gap-3">
     <div><h3 id="dose-view-title" className="m-0 text-sm font-semibold">{activeDescriptor.title} · linked {synthetic?'phantom':'source'} plane</h3><p className="m-0 mt-1 text-xs text-muted-foreground">128 × 128 {synthetic?'synthetic phantom-grid':'processed-grid'} slice · rows {activeDescriptor.rowAxis} · columns {activeDescriptor.columnAxis} · {activeDvh?.spacing_mm?`${activeDvh.spacing_mm.map(value=>value.toFixed(3)).join(' × ')} mm ${synthetic?'illustrative':'voxel'} spacing`:'loading voxel spacing'}</p></div>
     <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Choose DoseTwin slice plane" className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">{axes.map(axis=><Button key={axis} type="button" aria-pressed={axis===activeAxis} onClick={()=>setActiveAxis(axis)} variant={axis===activeAxis?'default':'outline'} size="sm" className="min-h-9">{axisDescriptors[axis].indexLabel}</Button>)}</div>
      <div role="group" aria-label="Viewport controls" className="flex items-center gap-1 rounded-lg border border-border bg-card p-1"><Button type="button" variant="ghost" size="icon-sm" aria-label="Zoom out" disabled={zoom<=1} onClick={()=>setZoom(value=>Math.max(1,value-.25))}><ZoomOut/></Button><span className="min-w-11 text-center font-mono text-xs tabular-nums">{Math.round(zoom*100)}%</span><Button type="button" variant="ghost" size="icon-sm" aria-label="Fit image" onClick={()=>{setZoom(1);setPan({x:0,y:0});setPanMode(false)}}><Move/></Button><Button type="button" variant="ghost" size="icon-sm" aria-label="Zoom in" disabled={zoom>=3} onClick={()=>setZoom(value=>Math.min(3,value+.25))}><ZoomIn/></Button><Toggle variant="outline" size="sm" pressed={panMode} disabled={zoom<=1} onPressedChange={setPanMode}>Pan</Toggle></div>
     </div>
    </div>
    <DosePlane caseId={caseId} axis={activeAxis} index={coordinates[activeAxis]} coordinates={coordinates} selectedRois={selectedRois} showDose={showDose} showRoi={showRoi} opacity={opacity} doseMaxGy={activeDvh?.dose_display_max_gy??null} ctRange={ctDisplayRange} spacingMm={activeDvh?.spacing_mm??null} zoom={zoom} pan={pan} panMode={panMode} onPanChange={setPan} onCoordinateChange={updateFromPlane} onIndexChange={setIndex} onCtHash={setCtHash} locked={locked} size="primary"/>
    <section aria-label="Linked orthogonal views" className="grid min-w-0 gap-2">
     <div><h4 className="m-0 text-sm font-semibold">Two linked orthogonal planes</h4><p className="m-0 mt-1 text-xs text-muted-foreground">Click a {synthetic?'phantom':'source'} pixel or change an index; all three views stay linked to the same grid voxel.</p></div>
     <div className="grid min-w-0 gap-3 max-[520px]:grid-cols-1 sm:grid-cols-2">
      {orthogonalAxes.map(axis=><DosePlane key={axis} caseId={caseId} axis={axis} index={coordinates[axis]} coordinates={coordinates} selectedRois={selectedRois} showDose={showDose} showRoi={showRoi} opacity={opacity} doseMaxGy={activeDvh?.dose_display_max_gy??null} ctRange={ctDisplayRange} spacingMm={activeDvh?.spacing_mm??null} zoom={1} pan={{x:0,y:0}} panMode={false} onPanChange={()=>{}} onCoordinateChange={updateFromPlane} onIndexChange={setIndex} onCtHash={setCtHash} locked={locked} size="secondary"/>)}
     </div>
    </section>
    <p className="m-0 flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-primary"/>Crosshair is linked to the selected {activeDescriptor.indexLabel.toLowerCase()}; array indices remain 0–127.</p>
   </section>
   <aside aria-label="DoseTwin inspection controls" className="grid content-start gap-3">
    <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle className="text-sm">Display controls</CardTitle><CardDescription>{synthetic?'Synthetic dose field and phantom masks':'Reference dose and structure overlays'}</CardDescription></CardHeader><CardContent className="grid gap-4">
     <Field className="grid gap-2"><FieldLabel htmlFor="dose-roi">Primary structure</FieldLabel><Select items={availableStructures.map(structure=>({label:structure,value:structure}))} value={roi} disabled={locked} onValueChange={value=>{if(typeof value==='string')choosePrimaryRoi(value)}}><SelectTrigger id="dose-roi" size="sm" className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup>{availableStructures.map(structure=><SelectItem key={structure} value={structure}>{structure}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
     {!guided&&<fieldset className="grid gap-2 rounded-md border border-border p-2.5"><legend className="px-1 text-xs font-medium">{synthetic?'Phantom mask overlays':'Overlay and compare · up to 5'}</legend><div className="grid grid-cols-2 gap-x-3 gap-y-2">{availableStructures.map(name=><label key={name} className="flex min-w-0 items-center gap-2 text-xs"><Checkbox checked={selectedRois.includes(name)} disabled={locked||(!selectedRois.includes(name)&&selectedRois.length>=5)} onCheckedChange={()=>toggleRoi(name)}/><i className="size-2.5 shrink-0 rounded-full" style={{backgroundColor:`rgb(${roiColors[name]?.join(',')??'130,190,220'})`}}/><span className="truncate">{name}</span></label>)}</div><p className="m-0 text-[11px] text-muted-foreground">{selectedRois.length} selected · {synthetic?'synthetic masks only':'structure colors stay fixed across slices'}.</p></fieldset>}
     <Toggle variant="outline" size="sm" className="min-h-10 justify-start data-[state=on]:border-primary data-[state=on]:text-primary" pressed={showDose} disabled={locked} onPressedChange={value=>{setShowDose(value);emitSelection({dose_overlay:value})}} aria-label={synthetic?'Synthetic illustrative dose overlay':'Dose overlay'}>{showDose?<Eye data-icon="inline-start"/>:<EyeOff data-icon="inline-start"/>}{synthetic?'Synthetic illustrative dose overlay':'Reference dose overlay'}</Toggle>
     <Toggle variant="outline" size="sm" className="min-h-10 justify-start data-[state=on]:border-primary data-[state=on]:text-primary" pressed={showRoi} disabled={locked} onPressedChange={value=>{setShowRoi(value);emitSelection({roi_overlay:value})}} aria-label="ROI edge">{showRoi?<Eye data-icon="inline-start"/>:<EyeOff data-icon="inline-start"/>}Structure boundary</Toggle>
     <Field className="grid gap-2"><FieldLabel htmlFor="dose-opacity">Dose overlay opacity · {Math.round(opacity*100)}%</FieldLabel><Slider id="dose-opacity" aria-label="Dose opacity" min={0} max={1} step={0.05} value={[opacity]} disabled={locked} onValueChange={value=>{const next=Array.isArray(value)?value[0]:value;setOpacity(next);emitSelection({dose_opacity:next})}}/></Field>
     {activeDvh&&<fieldset className="grid grid-cols-2 gap-2 rounded-md border border-border p-2.5"><legend className="px-1 text-xs font-medium">CT display window</legend><Field className="grid gap-1"><FieldLabel htmlFor="ct-display-min" className="text-[11px]">Low · source value</FieldLabel><Input id="ct-display-min" type="number" step="0.1" value={ctDisplayRange?.[0]??activeDvh.ct_display_range?.[0]??0} disabled={locked} onChange={event=>{const value=Number(event.target.value);if(Number.isFinite(value)&&ctDisplayRange)setCtWindow({caseId,range:[value,ctDisplayRange[1]]})}}/></Field><Field className="grid gap-1"><FieldLabel htmlFor="ct-display-max" className="text-[11px]">High · source value</FieldLabel><Input id="ct-display-max" type="number" step="0.1" value={ctDisplayRange?.[1]??activeDvh.ct_display_range?.[1]??1} disabled={locked} onChange={event=>{const value=Number(event.target.value);if(Number.isFinite(value)&&ctDisplayRange)setCtWindow({caseId,range:[ctDisplayRange[0],value]})}}/></Field><p className="col-span-2 m-0 text-[10px] leading-4 text-muted-foreground">{activeDvh.ct_display_note}</p></fieldset>}
    </CardContent></Card>
    <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle className="text-sm">Linked voxel</CardTitle><CardDescription>Processed-array coordinates · no patient-space orientation implied</CardDescription></CardHeader><CardContent className="grid grid-cols-3 gap-2">
     {axes.map(axis=><Field key={axis} className="grid gap-1"><FieldLabel htmlFor={`dose-coordinate-${axis}`} className="text-xs">{axisDescriptors[axis].indexLabel}</FieldLabel><Input id={`dose-coordinate-${axis}`} className="h-9 font-mono tabular-nums" type="number" min={0} max={127} step={1} value={coordinates[axis]} disabled={locked} onChange={event=>setIndex(axis,clampDoseIndex(Number(event.target.value)||0))}/></Field>)}
    </CardContent></Card>
   </aside>
  </div>
  {!locked&&!guided&&<details onToggle={event=>setIs3dOpen(event.currentTarget.open)} className="group grid min-w-0 gap-3 rounded-xl border border-border bg-card p-3 sm:p-4"><summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden"><span className="flex min-w-0 items-center justify-between gap-3"><span className="min-w-0"><span className="block text-sm font-semibold">{synthetic?'Explore synthetic 3D geometry':'Explore a source-derived 3D structure'}</span><span className="mt-1 block text-xs text-muted-foreground">Reconstruct {roi} from its {synthetic?'deterministic phantom':'verified'} mask, linked to the active 2D structure selection.</span></span><span className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium text-primary group-open:bg-primary group-open:text-primary-foreground">Open 3D view</span></span></summary>{is3dOpen&&<Suspense fallback={<div role="status" className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/>Loading 3D surface tools…</div>}><DoseTwinSurfaceViewer caseId={caseId} selectedRoi={roi} onRoiChange={choosePrimaryRoi}/></Suspense>}</details>}
  <section aria-label="DoseTwin measurements and evidence" className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
   <Tabs value={inspectionTab} onValueChange={setInspectionTab} className="w-full min-w-0 flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
     <div><p className="m-0 text-xs font-medium uppercase tracking-[0.12em] text-primary">Inspection dock</p><h3 className="m-0 mt-1 text-sm font-semibold">{synthetic?'Synthetic measurements and provenance':'Measurements, comparison and source record'}</h3></div>
     <TabsList aria-label="DoseTwin inspection panels" className="h-10 w-full min-w-0 overflow-visible sm:w-auto">
      <TabsTrigger value="measurements" className="min-w-0 px-1 text-[11px] sm:flex-none sm:px-3 sm:text-sm">Measurements</TabsTrigger>
      {!locked&&!guided&&!viewerOnly&&<TabsTrigger value="comparison" className="min-w-0 px-1 text-[11px] sm:flex-none sm:px-3 sm:text-sm">Comparison</TabsTrigger>}
      <TabsTrigger value="source" aria-label="Source evidence" className="min-w-0 px-1 text-[11px] sm:flex-none sm:px-3 sm:text-sm"><span className="sm:hidden">Source</span><span className="hidden sm:inline">Source evidence</span></TabsTrigger>
     </TabsList>
    </div>
    <TabsContent value="measurements" className="w-full min-w-0">
     <Card className="border-0 bg-transparent shadow-none"><CardHeader className="flex-row items-start justify-between gap-3 px-0 pt-0"><div><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4 text-primary"/>Cumulative dose-volume</CardTitle><CardDescription className="mt-1">{selectedRois.join(' · ')} · {synthetic?'synthetic analytic dose field':'OpenKBP benchmark reference'}</CardDescription></div><span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{synthetic?'Illustrative synthetic scale / volume (%)':'Gy / volume (%)'}</span></CardHeader><CardContent className="grid min-w-0 gap-4 px-0 pb-0">{dvhBusy?<div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/><span>Calculating selected ROI dose-volume summaries…</span></div>:dvhError?<div className="flex items-start gap-2 py-6 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0"/><div><b>ROI dose-volume summary unavailable</b><p className="mb-0 mt-1">{dvhError}</p></div></div>:dvhRecords.length===selectedRois.length&&activeDvh&&<><DvhPlot data={dvhRecords} synthetic={synthetic}/><div className="overflow-x-auto rounded-md border border-border"><Table><TableCaption>{synthetic?'Deterministic synthetic-phantom summaries; no benchmark evaluator or clinical-plan evaluation is applied.':'Official OpenKBP evaluator metrics for this benchmark reference array; not clinical-plan evaluation.'}</TableCaption><TableHeader><TableRow><TableHead>Structure</TableHead><TableHead>{synthetic?'Mean (synthetic units)':'Dmean'}</TableHead><TableHead>{synthetic?'D95 (synthetic units)':'D95'}</TableHead><TableHead>{synthetic?'D0.1 cc (not computed)':'D0.1 cc'}</TableHead><TableHead>{synthetic?'Volume ≥20 synthetic units':'V20'}</TableHead></TableRow></TableHeader><TableBody>{dvhRecords.map(item=><TableRow key={item.roi}><TableCell className="font-medium"><span className="mr-2 inline-block size-2 rounded-full" style={{backgroundColor:`rgb(${roiColors[item.roi].join(',')})`}}/>{item.roi}</TableCell><TableCell className="font-mono tabular-nums">{item.official_metrics.dmean_gy?.toFixed(2)??'—'}{synthetic?'':' Gy'}</TableCell><TableCell className="font-mono tabular-nums">{item.official_metrics.d95_gy_interpolated?.toFixed(2)??'—'}{synthetic?'':' Gy'}</TableCell><TableCell className="font-mono tabular-nums">{item.official_metrics.d0_1cc_gy_openkbp?.toFixed(2)??'—'}{synthetic?'':' Gy'}</TableCell><TableCell className="font-mono tabular-nums">{item.official_metrics.v20gy_percent?.toFixed(1)??'—'}%</TableCell></TableRow>)}</TableBody></Table></div><p className="m-0 text-xs leading-relaxed text-muted-foreground">{activeDvh.official_metrics.note} {synthetic?'DVHs are generated deterministically and are not clinical metrics.':'Exploratory curves are calculated separately from the official metrics.'}</p></>}</CardContent></Card>
    </TabsContent>
    {!locked&&!guided&&!viewerOnly&&<TabsContent value="comparison" className="w-full min-w-0">
     <div className="mb-4"><h4 className="m-0 text-sm font-semibold">Compare a real dose prediction</h4><p className="m-0 mt-1 text-xs text-muted-foreground">Aligned same-case arrays with per-structure deltas. Predictions are shown only when an authentic compatible artifact is available.</p></div>
     {activeDvh&&<Suspense fallback={<div role="status" className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/>Loading comparison tools…</div>}><DoseTwinComparisonPanel caseId={caseId} roi={roi} axis={activeAxis} index={coordinates[activeAxis]} spacingMm={activeDvh.spacing_mm}/></Suspense>}
    </TabsContent>}
    <TabsContent value="source" className="grid w-full min-w-0 gap-3">
     {activeDvh&&<><div className="grid gap-2 rounded-lg border border-border bg-background px-4 py-3" aria-label="Dose display legend"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{synthetic?'Synthetic illustrative dose scale · not physical Gy':'OpenKBP reference dose · fixed case scale'}</span><span className="font-mono">0–{activeDvh.dose_display_max_gy.toFixed(1)} {synthetic?'synthetic scale units':'Gy'}</span></div><div className="h-3 rounded-sm" style={{background:'linear-gradient(90deg, rgb(58,77,207) 0%, rgb(32,157,190) 38%, rgb(239,139,91) 72%, rgb(255,222,134) 100%)'}}/><div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground"><span>0 {synthetic?'units':'Gy'}</span><span>{(activeDvh.dose_display_max_gy*.5).toFixed(1)} {synthetic?'units':'Gy'}</span><span>{activeDvh.dose_display_max_gy.toFixed(1)} {synthetic?'units':'Gy'}</span></div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{selectedRois.map(name=><span key={name} className="flex items-center gap-2"><i className="size-2 rounded-full" style={{backgroundColor:`rgb(${roiColors[name]?.join(',')??'130,190,220'})`}}/>{name} boundary</span>)}</div></div><div className="rounded-lg border border-border bg-background p-3 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-4"><div className="flex items-start gap-2 text-sm"><Database className="mt-0.5 size-4 shrink-0 text-primary"/><div><p className="m-0 font-medium">{synthetic?'Synthetic phantom arrays':'OpenKBP reference arrays'}</p><p className="m-0 mt-1 text-xs text-muted-foreground">{activeDvh.origin} · revision <span className="font-mono">{activeDvh.source_revision}</span></p></div></div><details className="mt-3 text-xs text-muted-foreground sm:mt-0"><summary className="cursor-pointer">View {synthetic?'deterministic':'source'} SHA-256 hashes</summary><div className="mt-2 grid gap-1 font-mono text-[10px] break-all"><code>{synthetic?'synthetic dose volume':'dose.csv'} {activeDvh.dose_sha256}</code><code>{synthetic?'synthetic CT volume':'ct.csv'} {ctHash}</code>{dvhRecords.map(item=><code key={item.roi}>{synthetic?'mask':'ROI'} {item.roi} {item.roi_sha256}</code>)}</div></details></div><>{synthetic?<p className="m-0 px-1 text-xs font-medium text-amber-900">SYNTHETIC PHANTOM · NOT ANATOMY · NOT A TREATMENT PLAN · arbitrary synthetic dose scale, not physical Gy · relative water density, not CT HU · no patient-space orientation</p>:<><p className="m-0 px-1 text-xs text-muted-foreground">Benchmark reference dose is not a delivered clinical plan · processed-grid coordinates only · axis orientation unknown</p><Alert className="border-amber-300 bg-amber-50 text-amber-950"><CircleAlert/><AlertTitle>OpenKBP dataset terms are not confirmed</AlertTitle><AlertDescription>The repository’s MIT license applies to its code; it does not establish rights for these dataset files. Keep this case in local research and education use. Do not redistribute it or show it externally until the dataset terms are reviewed. <a className="font-medium underline underline-offset-4" href="https://github.com/ababier/open-kbp/tree/ce625e62f3b04203f22bd9d1634f3e8fb0245e46" target="_blank" rel="noreferrer">View the pinned source revision</a>.</AlertDescription></Alert></>}</></>}
    </TabsContent>
   </Tabs>
  </section>
 </section>
}
