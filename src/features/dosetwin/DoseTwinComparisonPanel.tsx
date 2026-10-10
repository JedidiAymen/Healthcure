import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, FileUp, LoaderCircle, Save, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { api, type DoseArtifactSlice } from '@/lib/api'
import { queryClient } from '@/lib/query-client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const formatGy=(value:number|undefined)=>typeof value==='number'&&Number.isFinite(value)?`${value.toFixed(2)} Gy`:'—'
const dvhChartConfig={reference:{label:'Reference',color:'var(--chart-1)'},prediction:{label:'Prediction',color:'var(--chart-2)'}} satisfies ChartConfig

function DosePlane({title,values,maximum,delta=false}:{title:string;values:number[]|undefined;maximum:number;delta?:boolean}){
 const canvasRef=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{
  const canvas=canvasRef.current
  if(!canvas||!values||values.length!==128*128)return
  const context=canvas.getContext('2d');if(!context)return
  const image=context.createImageData(128,128)
  for(let index=0;index<values.length;index++){
   const normalized=Math.min(1,Math.abs(values[index])/Math.max(maximum,1e-8))
   const offset=index*4
   if(delta){
    if(values[index]>=0){image.data[offset]=Math.round(45+210*normalized);image.data[offset+1]=Math.round(73*(1-normalized));image.data[offset+2]=Math.round(210*(1-normalized))}
    else{image.data[offset]=Math.round(210*(1-normalized));image.data[offset+1]=Math.round(76*(1-normalized));image.data[offset+2]=Math.round(52+205*normalized)}
   }else{
    image.data[offset]=Math.round(58+(197*normalized));image.data[offset+1]=Math.round(77+(145*normalized));image.data[offset+2]=Math.round(207-(73*normalized))
   }
   image.data[offset+3]=255
  }
  context.putImageData(image,0,0)
 },[title,values,maximum,delta])
 return <figure className="m-0 grid min-w-0 gap-2"><figcaption className="text-xs font-medium">{title}</figcaption><canvas ref={canvasRef} width={128} height={128} aria-label={`${title} processed-grid dose plane`} className="aspect-square w-full max-w-[360px] rounded-sm border border-border bg-[#101624] [image-rendering:pixelated]"/><span className="text-[10px] text-muted-foreground">{delta?`−${maximum.toFixed(2)} to +${maximum.toFixed(2)} Gy`:`0 to ${maximum.toFixed(2)} Gy`}</span></figure>
}

export function DoseTwinComparisonPanel({caseId,roi,axis,index,spacingMm}:{caseId:string;roi:string;axis:number;index:number;spacingMm:[number,number,number]}){
 const [artifactId,setArtifactId]=useState('')
 const [file,setFile]=useState<File|null>(null)
 const [modelRevision,setModelRevision]=useState('')
 const [checkpointSha,setCheckpointSha]=useState('')
 const [sourceRevision,setSourceRevision]=useState('')
 const [rightsBasis,setRightsBasis]=useState('')
 const [rightsConfirmed,setRightsConfirmed]=useState(false)
 const [error,setError]=useState('')
 const [saving,setSaving]=useState(false)
 const [savedReport,setSavedReport]=useState<string|null>(null)
 const artifacts=useQuery({queryKey:['doseArtifacts',caseId],queryFn:()=>api.doseArtifacts(caseId),staleTime:15_000})
 const chosenId=artifactId||artifacts.data?.[0]?.id||''
 const comparison=useQuery({queryKey:['doseArtifactComparison',caseId,chosenId],queryFn:()=>api.doseArtifactComparison(caseId,chosenId),enabled:Boolean(chosenId),staleTime:30_000})
 const slice=useQuery({queryKey:['doseArtifactSlice',caseId,chosenId,axis,index],queryFn:()=>api.doseArtifactSlice(caseId,chosenId,axis,index),enabled:Boolean(chosenId),staleTime:10_000})
 const selectedRoi=useMemo(()=>comparison.data?.roi_comparisons.find(value=>value.roi===roi),[comparison.data,roi])
 const sliceData=slice.data as DoseArtifactSlice|undefined
 const sharedMaximum=sliceData?.shared_display_max_gy??1
 const deltaMaximum=sliceData?.delta_display_max_gy??0
 useEffect(()=>{setSavedReport(null)},[chosenId,axis,index,roi])

 async function importPrediction(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setError('')
  if(!file){setError('Choose a real sparse dose CSV first.');return}
  if(!rightsConfirmed){setError('Confirm the local research-use rights basis for this file.');return}
  setSaving(true)
  try{
   const artifact=await api.importDoseArtifact(caseId,file,{sourceRevision,modelRevision,checkpointSha256:checkpointSha,rightsBasis,spacingMm})
   await queryClient.invalidateQueries({queryKey:['doseArtifacts',caseId]})
   setArtifactId(artifact.id);setFile(null)
  }catch(reason){setError(reason instanceof Error?reason.message:'The prediction could not be validated.')}
  finally{setSaving(false)}
 }
 async function saveComparisonReport(){
  if(!chosenId)return
  setError('')
  try{
   const report=await api.createDoseComparisonReport(caseId,chosenId,roi,axis,index)
   setSavedReport(report.id)
   await queryClient.invalidateQueries({queryKey:['reports']})
  }catch(reason){setError(reason instanceof Error?reason.message:'The comparison report could not be saved.')}
 }

 return <Card className="border-border bg-card shadow-none" aria-label="DoseTwin prediction comparison">
  <CardHeader>
   <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Compare a real prediction</CardTitle><CardDescription className="mt-1 max-w-3xl">Compare a compatible same-case Gy array against the OpenKBP reference on one processed grid. No prediction is supplied by MEDFORGE.</CardDescription></div><Badge variant="outline">Local research only</Badge></div>
  </CardHeader>
  <CardContent className="grid gap-4">
   <Alert><ShieldCheck/><AlertTitle>Source and rights stay visible</AlertTitle><AlertDescription>The uploaded file is stored in the local MEDFORGE data folder. Its model revision, checkpoint hash, source revision and rights basis are recorded; the app checks the file hash and grid but does not independently verify model identity or usage rights.</AlertDescription></Alert>
   {error&&<Alert variant="destructive"><AlertCircle/><AlertTitle>Prediction not imported</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
   <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
    <form onSubmit={event=>void importPrediction(event)} className="grid content-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
     <div><h3 className="m-0 text-sm font-semibold">Add compatible artifact</h3><p className="mb-0 mt-1 text-xs leading-5 text-muted-foreground">Accepted format: OpenKBP sparse CSV with a `,data` header and C-order voxel indices. Maximum 64 MiB.</p></div>
     <FieldGroup>
      <Field><FieldLabel htmlFor="dose-model-csv">Prediction CSV</FieldLabel><Input id="dose-model-csv" type="file" accept=".csv,text/csv" onChange={event=>setFile(event.target.files?.[0]??null)} aria-label="Choose an authentic dose prediction CSV"/></Field>
      <Field><FieldLabel htmlFor="dose-model-revision">Model revision</FieldLabel><Input id="dose-model-revision" required maxLength={200} value={modelRevision} onChange={event=>setModelRevision(event.target.value)} placeholder="model commit or release"/></Field>
      <Field><FieldLabel htmlFor="dose-checkpoint-sha">Checkpoint SHA-256</FieldLabel><Input id="dose-checkpoint-sha" required pattern="[A-Fa-f0-9]{64}" maxLength={64} value={checkpointSha} onChange={event=>setCheckpointSha(event.target.value)} placeholder="64 hexadecimal characters" className="font-mono text-xs"/></Field>
      <Field><FieldLabel htmlFor="dose-pred-source-revision">Prediction source revision</FieldLabel><Input id="dose-pred-source-revision" required maxLength={200} value={sourceRevision} onChange={event=>setSourceRevision(event.target.value)} placeholder="archive revision or dataset release"/></Field>
      <Field><FieldLabel htmlFor="dose-rights-basis">Local research rights basis</FieldLabel><Input id="dose-rights-basis" required minLength={10} maxLength={1000} value={rightsBasis} onChange={event=>setRightsBasis(event.target.value)} placeholder="Describe the permission or terms that allow this use"/></Field>
      <Field orientation="horizontal" className="items-start"><Checkbox id="dose-rights-confirmed" checked={rightsConfirmed} onCheckedChange={value=>setRightsConfirmed(value===true)}/><FieldLabel htmlFor="dose-rights-confirmed" className="text-xs leading-5">I have a rights basis for this local research comparison.</FieldLabel></Field>
     </FieldGroup>
     <Button type="submit" disabled={saving||!file||!rightsConfirmed} className="w-full">{saving?<LoaderCircle className="animate-spin" data-icon="inline-start"/>:<FileUp data-icon="inline-start"/>}{saving?'Validating source grid…':'Validate and add prediction'}</Button>
    </form>
    <div className="grid content-start gap-3">
     <Field><FieldLabel htmlFor="dose-artifact-choice">Installed predictions for this case</FieldLabel><Select value={chosenId} onValueChange={value=>setArtifactId(value??'')}><SelectTrigger id="dose-artifact-choice" aria-label="Select imported dose prediction"><SelectValue placeholder="No prediction imported"/></SelectTrigger><SelectContent><SelectGroup>{artifacts.data?.map(item=><SelectItem key={item.id} value={item.id}>{item.source_file_name} · {item.model_revision}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
     {artifacts.isLoading&&<p role="status" className="text-sm text-muted-foreground">Loading local prediction records…</p>}
     {artifacts.error&&<Alert variant="destructive"><AlertCircle/><AlertTitle>Local prediction records could not be loaded</AlertTitle><AlertDescription>{artifacts.error.message}</AlertDescription></Alert>}
     {!artifacts.isLoading&&!artifacts.error&&!artifacts.data?.length&&<div className="grid min-h-36 content-center rounded-lg border border-dashed border-border px-4 py-5 text-center"><p className="m-0 text-sm font-medium">No compatible second array is installed.</p><p className="mb-0 mt-1 text-xs leading-5 text-muted-foreground">Add a permitted prediction file with matching case identity, shape, spacing, index convention and Gy units. The feature never creates a placeholder result.</p></div>}
     {comparison.isLoading&&chosenId&&<p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="animate-spin"/>Calculating matching-grid comparisons…</p>}
     {comparison.error&&<Alert variant="destructive"><AlertCircle/><AlertTitle>Comparison unavailable</AlertTitle><AlertDescription>{comparison.error.message}</AlertDescription></Alert>}
     {comparison.data&&sliceData&&<>
      <div className="grid gap-3 rounded-lg border border-border p-3">
       <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="m-0 text-sm font-semibold">Same-slice dose and Δ-dose</h3><p className="mb-0 mt-1 text-xs text-muted-foreground">{['X','Y','Z'][axis]} index {index} · {roi} · processed grid · Gy</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">shared reference / prediction scale</Badge><Button type="button" variant="outline" size="sm" onClick={()=>void saveComparisonReport()}><Save data-icon="inline-start"/>Save comparison report</Button></div></div>
       <div className="grid grid-cols-2 gap-3 xl:grid-cols-3"><DosePlane title="Reference" values={sliceData.reference_gy} maximum={sharedMaximum}/><DosePlane title="Prediction" values={sliceData.prediction_gy} maximum={sharedMaximum}/><div className="col-span-2 xl:col-span-1"><DosePlane title="Signed Δ · prediction − reference" values={sliceData.delta_gy} maximum={deltaMaximum||1} delta/></div></div>
       <p className="m-0 text-[11px] leading-5 text-muted-foreground">Δ legend is symmetric around 0 Gy; positive differences are coral and negative differences are blue. Plane labels identify processed-array indices only; patient orientation is unknown.</p>
      </div>
      {selectedRoi&&<><Card className="border-border bg-card shadow-none"><CardHeader className="pb-2"><CardTitle className="text-sm">{roi} cumulative DVH comparison</CardTitle><CardDescription>Shared Gy thresholds and structure volume axis</CardDescription></CardHeader><CardContent><ChartContainer config={dvhChartConfig} className="h-56 w-full"><LineChart data={selectedRoi.reference_dvh.map((point,pointIndex)=>({dose_gy:point.dose_gy,reference:point.volume_percent,prediction:selectedRoi.prediction_dvh[pointIndex]?.volume_percent??0}))} margin={{left:8,right:12,top:8,bottom:8}}><CartesianGrid vertical={false}/><XAxis dataKey="dose_gy" tickLine={false} axisLine={false} tickFormatter={value=>`${Number(value).toFixed(0)} Gy`}/><YAxis domain={[0,100]} tickLine={false} axisLine={false} tickFormatter={value=>`${value}%`}/><ChartTooltip content={<ChartTooltipContent labelFormatter={value=>`${Number(value).toFixed(2)} Gy`}/>} /><Line type="monotone" dataKey="reference" name="Reference" stroke="var(--color-reference)" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="prediction" name="Prediction" stroke="var(--color-prediction)" strokeWidth={2} dot={false}/></LineChart></ChartContainer></CardContent></Card><div className="overflow-x-auto rounded-md border border-border"><Table><caption className="p-2 text-left text-xs text-muted-foreground">Imported prediction versus benchmark reference · evaluator-style metrics remain research summaries.</caption><TableHeader><TableRow><TableHead>Structure</TableHead><TableHead>Reference mean</TableHead><TableHead>Prediction mean</TableHead><TableHead>Mean Δ</TableHead><TableHead>Mean |Δ|</TableHead><TableHead>Max |Δ|</TableHead></TableRow></TableHeader><TableBody>{comparison.data.roi_comparisons.map(item=><TableRow key={item.roi} data-state={item.roi===roi?'selected':undefined}><TableCell className="font-medium">{item.roi}</TableCell><TableCell className="font-mono tabular-nums">{formatGy(item.reference_mean_gy)}</TableCell><TableCell className="font-mono tabular-nums">{formatGy(item.prediction_mean_gy)}</TableCell><TableCell className="font-mono tabular-nums">{formatGy(item.mean_delta_gy)}</TableCell><TableCell className="font-mono tabular-nums">{formatGy(item.mean_absolute_delta_gy)}</TableCell><TableCell className="font-mono tabular-nums">{formatGy(item.maximum_absolute_delta_gy)}</TableCell></TableRow>)}</TableBody></Table></div></>}
      {savedReport&&<p role="status" className="m-0 text-sm text-primary">Comparison report saved. <Link className="font-medium underline underline-offset-4" to="/studio/reports">Open evidence reports</Link></p>}
      <details className="rounded-md border border-border px-3 py-2 text-xs"><summary className="cursor-pointer font-medium">Prediction provenance and comparison limits</summary><div className="mt-2 grid gap-1.5 break-all text-muted-foreground"><span>File SHA-256 · <code className="font-mono">{comparison.data.artifact.source_file_sha256}</code></span><span>Checkpoint SHA-256 · <code className="font-mono">{comparison.data.artifact.checkpoint_sha256}</code></span><span>Model · {comparison.data.artifact.model_revision}</span><span>Reference SHA-256 · <code className="font-mono">{comparison.data.reference_dose_sha256}</code></span><span>Rights basis · {comparison.data.artifact.rights_basis}</span>{comparison.data.limitations.map(value=><span key={value}>• {value}</span>)}</div></details>
     </>}
    </div>
   </div>
  </CardContent>
 </Card>
}
