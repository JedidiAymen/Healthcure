import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, CircleAlert, Database, Eye, EyeOff, Layers3, LoaderCircle } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { api, type DvhSummary, type StudentDoseViewerEvidence, type VoxelSlice, type ViewerEvidenceState } from '../lib/api'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Toggle } from '@/components/ui/toggle'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { queryKeys } from '@/lib/query-client'
import { DOSE_ROIS, parseDoseWorkspacePreferences } from '@/lib/workspace-preferences'
import { clampDoseIndex, crosshairForPlane, renderDoseSlicePixels, slicePointFromCanvasPosition, voxelFromPlaneSelection, voxelWithAxisIndex, type DoseAxis, type DoseVoxel } from '@/lib/dose-visualization'

const structures=DOSE_ROIS
const axes=[0,1,2] as const
type Axis=DoseAxis
const axisDescriptors={
  0:{title:'X-index plane',indexLabel:'X index',rowAxis:'Y',columnAxis:'Z'},
  1:{title:'Y-index plane',indexLabel:'Y index',rowAxis:'X',columnAxis:'Z'},
  2:{title:'Z-index plane',indexLabel:'Z index',rowAxis:'X',columnAxis:'Y'},
} satisfies Record<Axis,{title:string;indexLabel:string;rowAxis:string;columnAxis:string}>
type SlicePack={ct:VoxelSlice;dose:VoxelSlice;roi:VoxelSlice}
type Voxel=DoseVoxel

function readDoseWorkspaceState(caseId:string):ViewerEvidenceState|null{
 try{const raw=localStorage.getItem(`medforge:dose-viewer:${caseId}`);return raw?parseDoseWorkspacePreferences(caseId,JSON.parse(raw)):null}
 catch{/* Ignore unavailable storage and malformed saved state. */return null}
}

function SliceCanvas({pack,axis,coordinates,showDose,showRoi,opacity,onPick,locked}:{pack:SlicePack;axis:Axis;coordinates:Voxel;showDose:boolean;showRoi:boolean;opacity:number;onPick:(row:number,column:number)=>void;locked:boolean}){
 const ref=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return
  const image=ctx.createImageData(128,128)
  image.data.set(renderDoseSlicePixels(pack.ct.values,pack.dose.values,pack.roi.values,{showDose,showRoi,opacity}))
  ctx.putImageData(image,0,0)
  const {row,column}=crosshairForPlane(axis,coordinates)
  ctx.save();ctx.strokeStyle='rgba(237,255,252,.82)';ctx.lineWidth=.7;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(column+.5,0);ctx.lineTo(column+.5,128);ctx.moveTo(0,row+.5);ctx.lineTo(128,row+.5);ctx.stroke();ctx.restore()
 },[pack,axis,coordinates,showDose,showRoi,opacity])
 const pick=(event:React.MouseEvent<HTMLCanvasElement>)=>{if(locked)return;const box=event.currentTarget.getBoundingClientRect(),point=slicePointFromCanvasPosition(event.clientX,event.clientY,box);if(point)onPick(point.row,point.column)}
 const descriptor=axisDescriptors[axis]
 return <canvas ref={ref} onClick={pick} className="aspect-square h-auto max-h-full w-full max-w-[190px] cursor-crosshair border border-border/50 [image-rendering:pixelated]" width={128} height={128} role="img" aria-label={`OpenKBP processed-array ${descriptor.title.toLowerCase()} at ${descriptor.indexLabel.toLowerCase()} ${coordinates[axis]}; rows are ${descriptor.rowAxis} indices and columns are ${descriptor.columnAxis} indices. Click to move the linked voxel.`}/>
}

function DosePlane({caseId,axis,index,coordinates,roi,showDose,showRoi,opacity,onCoordinateChange,onIndexChange,onCtHash,locked}:{caseId:string;axis:Axis;index:number;coordinates:Voxel;roi:string;showDose:boolean;showRoi:boolean;opacity:number;onCoordinateChange:(axis:Axis,row:number,column:number)=>void;onIndexChange:(axis:Axis,index:number)=>void;onCtHash:(hash:string)=>void;locked:boolean}){
 const descriptor=axisDescriptors[axis]
 const sliceQuery=useQuery({
  queryKey:[...queryKeys.cases,'slice',caseId,axis,index,roi],
  queryFn:async()=>{const [ct,dose,mask]=await Promise.all([api.slice(caseId,axis,index,'ct',roi),api.slice(caseId,axis,index,'dose',roi),api.slice(caseId,axis,index,'roi',roi)]);return {ct,dose,roi:mask} satisfies SlicePack},
 })
 const pack=sliceQuery.data??null,busy=sliceQuery.isPending,error=sliceQuery.error?.message??''
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
   <div className="relative grid h-[190px] place-items-center overflow-hidden rounded-lg border border-border/70 bg-[#0b1420]">{busy?<div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/>Reading source arrays…</div>:error?<div className="flex items-center gap-2 text-sm text-amber-300"><CircleAlert className="size-4"/>{error}</div>:pack&&<SliceCanvas pack={pack} axis={axis} coordinates={coordinates} showDose={showDose} showRoi={showRoi} opacity={opacity} onPick={(row,column)=>onCoordinateChange(axis,row,column)} locked={locked}/>}</div>
   <p className="m-0 text-xs text-muted-foreground">Rows {descriptor.rowAxis} · columns {descriptor.columnAxis} · processed-grid indices</p>
  </CardContent>
 </Card>
}

const dvhChartConfig={volume_percent:{label:'ROI volume',color:'#63d3c3'}} satisfies ChartConfig

function DvhPlot({data}:{data:DvhSummary}){
 return <div className="grid min-w-0 gap-3"><ChartContainer config={dvhChartConfig} className="h-[220px] min-w-0 w-full"><AreaChart accessibilityLayer title={`Cumulative dose-volume histogram for ROI ${data.roi}`} desc="Exploratory OpenKBP benchmark reference, not a delivered clinical plan. Use left and right arrow keys to inspect dose-volume points." data={data.curve} margin={{top:8,right:10,bottom:3,left:-14}}><CartesianGrid stroke="#263c4c" strokeDasharray="3 4" vertical={false}/><XAxis dataKey="dose_gy" type="number" domain={[0,'dataMax']} tick={{fill:'#8da4b2',fontSize:12}} tickFormatter={(v:number)=>Number(v).toFixed(0)} tickLine={false} axisLine={{stroke:'#42596a'}} label={{value:'Dose (Gy)',position:'insideBottom',offset:-1,fill:'#8da4b2',fontSize:12}}/><YAxis domain={[0,100]} tick={{fill:'#8da4b2',fontSize:12}} tickLine={false} axisLine={false} ticks={[0,25,50,75,100]} tickFormatter={(v:number)=>`${v}%`}/><ChartTooltip content={<ChartTooltipContent indicator="line" formatter={value=><span className="font-mono tabular-nums">{Number(value).toFixed(1)}%</span>} labelFormatter={value=>`${Number(value).toFixed(2)} Gy`}/>}/><Area type="stepAfter" dataKey="volume_percent" stroke="var(--color-volume_percent)" strokeWidth={2} fill="#1c786c" fillOpacity={0.25} isAnimationActive={false}/></AreaChart></ChartContainer><details className="group rounded-md border border-border/70 px-3"><summary className="cursor-pointer py-2 text-sm text-muted-foreground">View DVH data table · {data.curve.length} points</summary><div className="max-h-64 overflow-auto border-t"><Table><TableCaption>{data.roi} cumulative voxel DVH. Benchmark reference data; not a delivered clinical plan.</TableCaption><TableHeader><TableRow><TableHead>Dose (Gy)</TableHead><TableHead>ROI volume (%)</TableHead></TableRow></TableHeader><TableBody>{data.curve.map((point,index)=><TableRow key={`${point.dose_gy}-${index}`}><TableCell className="font-mono tabular-nums">{point.dose_gy.toFixed(4)}</TableCell><TableCell className="font-mono tabular-nums">{point.volume_percent.toFixed(4)}</TableCell></TableRow>)}</TableBody></Table></div></details></div>
}

export function DoseViewer({caseId,onEvidenceChange,viewerEvidence,locked=false,guided=false}:{caseId:string;onEvidenceChange?:(evidence:StudentDoseViewerEvidence)=>void;viewerEvidence?:StudentDoseViewerEvidence|null;locked?:boolean;guided?:boolean}){
 const savedState=useMemo(()=>guided?null:readDoseWorkspaceState(caseId),[caseId,guided])
 const [coordinates,setCoordinates]=useState<Voxel>(()=>savedState?.voxel??[64,64,64]),[roi,setRoi]=useState(()=>savedState?.roi??'Brainstem'),[showDose,setShowDose]=useState(()=>savedState?.dose_overlay??true),[showRoi,setShowRoi]=useState(()=>savedState?.roi_overlay??true),[opacity,setOpacity]=useState(()=>savedState?.dose_opacity??.56)
 const [ctHash,setCtHash]=useState('')
 const dvhQuery=useQuery({queryKey:[...queryKeys.cases,'dvh',caseId,roi],queryFn:()=>api.dvh(caseId,roi)})
 const dvh=dvhQuery.data??null,dvhBusy=dvhQuery.isPending,dvhError=dvhQuery.error?.message??''
 useEffect(()=>{if(guided)return;const state:ViewerEvidenceState={case_id:caseId,voxel:coordinates,roi,dose_overlay:showDose,roi_overlay:showRoi,dose_opacity:opacity};try{localStorage.setItem(`medforge:dose-viewer:${caseId}`,JSON.stringify(state));localStorage.removeItem('medforge-dose-viewer-state')}catch{/* Local persistence is optional when browser storage is unavailable. */}},[caseId,coordinates,roi,showDose,showRoi,opacity,guided])
 useEffect(()=>{if(viewerEvidence?.kind==='dosetwin'&&viewerEvidence.case_id===caseId){setCoordinates(viewerEvidence.voxel);setRoi(viewerEvidence.roi);setShowDose(viewerEvidence.dose_overlay);setShowRoi(viewerEvidence.roi_overlay);setOpacity(viewerEvidence.dose_opacity)}},[caseId,viewerEvidence])
 const emitSelection=(patch:Partial<StudentDoseViewerEvidence>={})=>onEvidenceChange?.({kind:'dosetwin',case_id:caseId,voxel:coordinates,roi,dose_overlay:showDose,roi_overlay:showRoi,dose_opacity:opacity,...patch})
 const updateFromPlane=(axis:Axis,row:number,column:number)=>{const next=voxelFromPlaneSelection(coordinates,axis,row,column);setCoordinates(next);emitSelection({voxel:next})}
 const setIndex=(axis:Axis,value:number)=>{const next=voxelWithAxisIndex(coordinates,axis,value);setCoordinates(next);emitSelection({voxel:next})}
 return <section className="grid gap-5">
  <div className="flex min-w-0 flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-4">
   <div className="min-w-0"><p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-primary">DoseTwin · source case</p><h2 className="m-0 text-xl font-semibold tracking-tight">Linked dose review</h2><p className="mb-0 mt-1 max-w-2xl text-sm text-muted-foreground">Explore the processed benchmark arrays together. Selecting any slice updates the linked voxel across all three planes.</p></div>
   <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-right"><p className="m-0 text-[11px] uppercase tracking-wide text-muted-foreground">Selected voxel</p><p className="m-0 mt-1 font-mono text-sm tabular-nums">x {coordinates[0]} <span className="text-muted-foreground">/</span> y {coordinates[1]} <span className="text-muted-foreground">/</span> z {coordinates[2]}</p></div>
  </div>
  <Card className="border-border/80 bg-card/70 shadow-sm"><CardContent className="flex flex-wrap items-center gap-3 p-3 sm:p-4" aria-label="Dose and structure display controls">
   <Field orientation="horizontal" className="items-center gap-2"><FieldLabel className="text-xs text-muted-foreground" htmlFor="dose-roi">Structure</FieldLabel><Select items={structures.map(structure=>({label:structure,value:structure}))} value={roi} disabled={locked} onValueChange={value=>{if(typeof value!=='string')return;setRoi(value);emitSelection({roi:value})}}>
    <SelectTrigger id="dose-roi" size="sm" className="w-38"><SelectValue/></SelectTrigger>
    <SelectContent><SelectGroup>{structures.map(structure=><SelectItem key={structure} value={structure}>{structure}</SelectItem>)}</SelectGroup></SelectContent>
   </Select></Field>
   <Toggle variant="outline" size="sm" className="data-[state=on]:border-primary data-[state=on]:text-primary" pressed={showDose} disabled={locked} onPressedChange={value=>{setShowDose(value);emitSelection({dose_overlay:value})}} aria-label="Dose overlay">
    {showDose?<Eye data-icon="inline-start"/>:<EyeOff data-icon="inline-start"/>}Dose overlay
   </Toggle>
   <Toggle variant="outline" size="sm" className="data-[state=on]:border-primary data-[state=on]:text-primary" pressed={showRoi} disabled={locked} onPressedChange={value=>{setShowRoi(value);emitSelection({roi_overlay:value})}} aria-label="ROI edge">
    {showRoi?<Eye data-icon="inline-start"/>:<EyeOff data-icon="inline-start"/>}ROI edge
   </Toggle>
   <span className="ml-auto flex min-w-36 items-center gap-3 text-xs text-muted-foreground">Opacity <span className="sr-only">{Math.round(opacity*100)} percent</span><Slider id="dose-opacity" aria-label="Dose opacity" min={0} max={1} step={0.05} value={[opacity]} disabled={locked} onValueChange={value=>{const next=Array.isArray(value)?value[0]:value;setOpacity(next);emitSelection({dose_opacity:next})}} className="w-28"/></span>
  </CardContent></Card>
  <div className="grid gap-5">
   <section aria-labelledby="orthogonal-title" className="min-w-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 id="orthogonal-title" className="m-0 text-sm font-semibold">Orthogonal source planes</h3><p className="m-0 mt-1 text-xs text-muted-foreground">Processed-grid slices · 128 × 128</p></div><span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-primary"/>Crosshair linked</span></div><div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">{axes.map(axis=><DosePlane key={axis} caseId={caseId} axis={axis} index={coordinates[axis]} coordinates={coordinates} roi={roi} showDose={showDose} showRoi={showRoi} opacity={opacity} onCoordinateChange={updateFromPlane} onIndexChange={setIndex} onCtHash={setCtHash} locked={locked}/>)}</div></section>
   <Card className="border-border/80 bg-card/90 shadow-sm"><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4 text-primary"/>Cumulative dose-volume</CardTitle><CardDescription className="mt-1">Structure · {roi} · benchmark reference</CardDescription></div><span className="rounded-md border border-border/70 px-2 py-1 font-mono text-xs text-muted-foreground">Gy / %</span></CardHeader><CardContent className="grid gap-4">{dvhBusy?<div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/><span>Calculating ROI dose-volume summary…</span></div>:dvhError?<div className="flex items-start gap-2 py-6 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0"/><div><b>ROI dose-volume summary unavailable</b><p className="mb-0 mt-1">{dvhError}</p></div></div>:dvh&&<><DvhPlot data={dvh}/><div className="grid grid-cols-2 divide-x divide-border rounded-md border border-border/70 bg-muted/20"><div className="grid gap-1 p-3"><span className="text-xs text-muted-foreground">Mean dose</span><b className="font-mono text-lg font-medium tabular-nums">{dvh.mean_dose_gy?.toFixed(2)??'—'} <span className="text-sm text-muted-foreground">Gy</span></b></div><div className="grid gap-1 p-3"><span className="text-xs text-muted-foreground">Structure voxels</span><b className="font-mono text-lg font-medium tabular-nums">{dvh.voxel_count.toLocaleString()}</b></div></div><p className="m-0 text-xs leading-relaxed text-muted-foreground">{dvh.method}</p></>}</CardContent></Card>
  </div>
  {dvh&&<><div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-slate-300"/>CT source value</span>{showDose&&<span className="flex items-center gap-2"><i className="size-2 rounded-full bg-rose-500"/>Benchmark reference · Gy</span>}{showRoi&&<span className="flex items-center gap-2"><i className="size-2 rounded-full bg-emerald-300"/>ROI boundary</span>}<span className="flex items-center gap-2"><i className="size-2 rounded-full bg-white"/>Linked voxel location</span></div><div className="rounded-lg border border-border/70 bg-muted/15 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-4"><div className="flex items-start gap-2 text-sm"><Database className="mt-0.5 size-4 shrink-0 text-primary"/><div><p className="m-0 font-medium">OpenKBP reference arrays</p><p className="m-0 mt-1 text-xs text-muted-foreground">{dvh.origin} · source revision <span className="font-mono">{dvh.source_revision.slice(0,12)}</span></p></div></div><details className="mt-3 text-xs text-muted-foreground sm:mt-0"><summary className="cursor-pointer">View source SHA-256 hashes</summary><div className="mt-2 grid gap-1 font-mono text-[10px] break-all"><code>dose.csv {dvh.dose_sha256}</code><code>{roi}.csv {dvh.roi_sha256}</code><code>ct.csv {ctHash}</code></div></details></div><p className="m-0 px-1 text-xs text-muted-foreground">Benchmark reference dose is not a delivered clinical plan · processed-array coordinates only</p><Alert className="border-amber-700/50 bg-amber-950/20 text-amber-50"><CircleAlert/><AlertTitle>OpenKBP dataset terms are not confirmed</AlertTitle><AlertDescription className="text-amber-100/80">The repository’s MIT license applies to its code; it does not establish rights for these dataset files. Keep this case in local research and education use. Do not redistribute it or show it externally until the dataset terms are reviewed. <a className="font-medium underline underline-offset-4" href="https://github.com/ababier/open-kbp/tree/ce625e62f3b04203f22bd9d1634f3e8fb0245e46" target="_blank" rel="noreferrer">View the pinned source revision</a>.</AlertDescription></Alert></>}
 </section>
}
