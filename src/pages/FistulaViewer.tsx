import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertCircle, ArrowLeftRight, AudioWaveform, Download } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import './fistulaguard.css'
import { api, type SignalFeatures, type SignalRecord, type SignalSpectrogram, type SignalSpectrum, type SignalWindow, type SignalWindowComparison, type StudentSignalViewerEvidence } from '../lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FISTULA_CHANNELS, parseSignalWorkspacePreferences, type SignalWorkspacePreferences } from '@/lib/workspace-preferences'
import { buildSignalComparisonReport } from '@/lib/signal-evidence'
import { searchSignalRecords } from '@/lib/source-picker'
import { formatSourceTime, sameSourceSampleTime } from '@/lib/fistula-time'
import { SignalTools } from '@/features/fistulaguard/SignalTools'
import { SimulatedDevicePanel } from '@/features/fistulaguard/SimulatedDevicePanel'

const channelColors:Record<string,string>={'ECG':'#80c8ec','raw PZT1':'#57d1bd','raw PZT2':'#ecbd67','raw PZT3':'#c19cf5','raw PZT4':'#ef8b7d'}
const CHANNELS=FISTULA_CHANNELS
const spectrumChartConfig={power:{label:'Power / Hz',color:'#6f55bd'}} satisfies ChartConfig

function downloadSignalComparison(item:SignalWindowComparison){
  const document=buildSignalComparisonReport(item)
  const blob=new Blob([JSON.stringify(document,null,2)],{type:'application/json'})
  const url=URL.createObjectURL(blob),anchor=window.document.createElement('a')
  anchor.href=url
  anchor.download=`medforge-${item.case_id.replaceAll(':','-')}-${item.id}.json`
  anchor.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}

function readSignalWorkspaceState(recordId:string):SignalWorkspacePreferences|null{
  const sourceId=recordId.startsWith('fisav:')?recordId.slice('fisav:'.length):recordId
  if(!/^pat\d{3}$/.test(sourceId))return null
  try{
    const raw=localStorage.getItem(`medforge:fistulaguard:${sourceId}`)
    return raw?parseSignalWorkspacePreferences(sourceId,JSON.parse(raw)):null
  }catch{/* Ignore unavailable storage and malformed saved state. */}
  return null
}

function SignalTrace({data,color,onCursorSample}:{data:SignalWindow;color:string;onCursorSample:(sample:SignalWindow['samples'][number]|null)=>void}) {
  const host=useRef<HTMLDivElement>(null)
  const chartData=useMemo<uPlot.AlignedData>(()=>[
    data.samples.map(point=>point.time_sec),
    data.samples.map(point=>point.value),
  ],[data])
  useEffect(()=>{
    const target=host.current
    if(!target)return
    let plot:uPlot|null=null
    const width=Math.max(240,target.clientWidth)
    const height=Math.max(240,target.parentElement?.clientHeight??340)
    plot=new uPlot({
      width,height,
      scales:{x:{time:false}},
      series:[{}, {stroke:color,width:1.2}],
      axes:[
        {stroke:'#859ba8',font:'10px system-ui',size:28,gap:6,
          values:(_plot,values)=>values.map(value=>`${Number(value).toFixed(1)}s`),
          grid:{stroke:'#293d4c',width:1},ticks:{stroke:'#405667',width:1,size:4},border:{stroke:'#405667',width:1}},
        {stroke:'#859ba8',font:'10px system-ui',size:52,gap:7,
          values:(_plot,values)=>values.map(value=>Number(value).toPrecision(3)),
          grid:{stroke:'#293d4c',width:1},ticks:{stroke:'#405667',width:1,size:4},border:{show:false}},
      ],
      cursor:{show:true,drag:{x:false,y:false}},
      legend:{show:false},
      hooks:{setCursor:[plot=>{
        const index=plot.cursor.idx
        onCursorSample(typeof index==='number'?data.samples[index]??null:null)
      }]},
    },chartData,target)
    const resize=new ResizeObserver(entries=>{
      const nextWidth=Math.floor(entries[0]?.contentRect.width??target.clientWidth)
      if(plot&&nextWidth>0)plot.setSize({width:nextWidth,height:Math.max(240,target.parentElement?.clientHeight??340)})
    })
    resize.observe(target)
    return ()=>{resize.disconnect();plot?.destroy();plot=null}
  },[chartData,color,data,onCursorSample])
  return <div ref={host} className="signal-trace-uplot" aria-hidden="true"/>
}

function WaveformDataTable({data}:{data:SignalWindow}) {
  return <details className="mt-3"><summary className="cursor-pointer text-sm text-muted-foreground">View plotted waveform samples · {data.samples.length.toLocaleString()} displayed of {data.original_sample_count.toLocaleString()} source samples</summary><p className="mt-2 text-xs text-muted-foreground">The chart and table use the same bounded min/max envelope. The source window and derived PSD/features use all {data.original_sample_count.toLocaleString()} measured samples. Values are uncalibrated {data.channel_unit}.</p><div className="mt-2 max-h-64 overflow-auto rounded-md border"><Table><TableCaption>{data.channel} plotted envelope for {data.start_sec.toFixed(3)}–{(data.start_sec+data.duration_sec).toFixed(3)} s. Source SHA-256 {data.source_sha256}.</TableCaption><TableHeader><TableRow><TableHead>Time (s)</TableHead><TableHead>{data.channel} source value</TableHead></TableRow></TableHeader><TableBody>{data.samples.map((sample,index)=><TableRow key={`${sample.time_sec}-${index}`}><TableCell className="font-mono tabular-nums">{sample.time_sec.toFixed(6)}</TableCell><TableCell className="font-mono tabular-nums">{sample.value.toPrecision(8)}</TableCell></TableRow>)}</TableBody></Table></div></details>
}

function SpectrumDataTable({data}:{data:SignalSpectrum}) {
  const [open,setOpen]=useState(false)
  return <details className="mt-3" onToggle={event=>setOpen(event.currentTarget.open)}><summary className="cursor-pointer text-sm text-muted-foreground">View PSD data table · {data.frequencies_hz.length.toLocaleString()} frequency bins</summary><p className="mt-2 text-xs text-muted-foreground">Calculated from {data.window_samples.toLocaleString()}-sample Hann windows with 50% overlap. Power remains in source-value²/Hz; physical units were not specified.</p>{open&&<div className="mt-2 max-h-64 overflow-auto rounded-md border"><Table><TableCaption>{data.channel} Welch power spectral density for {data.start_sec.toFixed(3)}–{(data.start_sec+data.duration_sec).toFixed(3)} s. Source SHA-256 {data.source_sha256}.</TableCaption><TableHeader><TableRow><TableHead>Frequency (Hz)</TableHead><TableHead>Power / Hz</TableHead></TableRow></TableHeader><TableBody>{data.frequencies_hz.map((frequency,index)=><TableRow key={`${frequency}-${index}`}><TableCell className="font-mono tabular-nums">{frequency.toFixed(3)}</TableCell><TableCell className="font-mono tabular-nums">{data.power_per_hz[index].toExponential(8)}</TableCell></TableRow>)}</TableBody></Table></div>}</details>
}

function SourceWindowLocator({start,duration,totalDuration,sampleRateHz}:{start:number;duration:number;totalDuration:number;sampleRateHz:number}) {
  const safeDuration=Math.max(totalDuration,Number.EPSILON)
  const left=Math.max(0,Math.min(100,(start/safeDuration)*100))
  const width=Math.max(0,Math.min(100-left,(duration/safeDuration)*100))
  const end=Math.min(totalDuration,start+duration)
  return <div className="mb-3 grid gap-1.5 px-0.5 pt-1 font-mono text-[11px] tabular-nums text-[var(--signal-muted)] lg:mb-4" aria-label={`Selected source interval ${formatSourceTime(start,sampleRateHz)} to ${formatSourceTime(end,sampleRateHz)} seconds of ${formatSourceTime(totalDuration,sampleRateHz)} seconds`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-sans text-[10px] font-semibold tracking-[0.09em] text-[var(--signal-text)]">RECORDING TIMEBASE</span><span>{(sampleRateHz/1000).toLocaleString(undefined,{maximumFractionDigits:3})} kHz · {totalDuration.toFixed(2)} s</span></div>
    <div className="relative h-1.5 overflow-hidden rounded-full border border-[var(--signal-line)] bg-[#0d1421]" aria-hidden="true"><span className="absolute inset-y-0 min-w-[3px] rounded-full bg-[#57d1bd] shadow-[0_0_0_1px_#101624]" style={{left:`${left}%`,width:`${width}%`}}/></div>
    <div className="flex flex-wrap items-center justify-between gap-2"><span>0 s</span><span className="order-last basis-full text-left text-[var(--signal-text)] sm:order-none sm:basis-auto sm:text-center">Selected {formatSourceTime(start,sampleRateHz)}–{formatSourceTime(end,sampleRateHz)} s</span><span>{totalDuration.toFixed(2)} s</span></div>
  </div>
}

function SignalSpectrogram({data}:{data:SignalSpectrogram}) {
  const width=data.times_sec.length,height=data.frequencies_hz.length
  const cellPaths=useMemo(()=>{
    const maximum=Math.max(...data.power_per_hz.flat(),Number.MIN_VALUE)
    const stops=[[9,20,34],[21,96,104],[75,190,164],[224,215,126],[245,187,96]] as const
    const groups=new Map<number,string[]>()
    for(let sourceRow=0;sourceRow<height;sourceRow++)for(let x=0;x<width;x++){
      const power=data.power_per_hz[sourceRow]?.[x]??0
      const relativeDb=power>0?10*Math.log10(power/maximum):-60
      const level=Math.round(Math.max(0,Math.min(1,(relativeDb+60)/60))*255)
      const row=height-1-sourceRow
      const path=groups.get(level)??[]
      path.push(`M${x} ${row}h1v1h-1z`)
      groups.set(level,path)
    }
    return [...groups].map(([level,segments])=>{
      const position=(level/255)*(stops.length-1),lower=Math.floor(position),upper=Math.min(stops.length-1,lower+1),mix=position-lower
      const color=stops[lower].map((value,index)=>Math.round(value*(1-mix)+stops[upper][index]*mix))
      const fill=`#${color.map(value=>value.toString(16).padStart(2,'0')).join('')}`
      return {fill,path:segments.join('')}
    })
  },[data,height,width])
  const firstTime=data.times_sec[0]??data.start_sec,lastTime=data.times_sec.at(-1)??data.start_sec
  const maximumFrequency=data.frequencies_hz.at(-1)??0
  return <div className="grid gap-2">
    <div className="grid h-60 min-w-0 grid-cols-[2.7rem_minmax(0,1fr)] items-stretch gap-2" role="img" aria-label={`${data.channel} time-frequency power view, ${firstTime.toFixed(3)} to ${lastTime.toFixed(3)} seconds and zero to ${maximumFrequency.toFixed(0)} hertz. Color shows relative power against the strongest displayed bin, not calibrated sound level.`}>
      <div className="flex flex-col justify-between py-1 text-right text-[10px] tabular-nums text-muted-foreground" aria-hidden="true"><span>{maximumFrequency.toFixed(0)} Hz</span><span>0 Hz</span></div>
      <svg className="h-full w-full min-w-0 rounded-sm border bg-background" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">{cellPaths.map(({fill,path})=><path key={fill} fill={fill} d={path}/>)}</svg>
    </div>
    <div className="ml-12 flex justify-between gap-2 text-[10px] tabular-nums text-muted-foreground" aria-hidden="true"><span>{firstTime.toFixed(2)} s</span><span className="text-[11px]">Source time</span><span>{lastTime.toFixed(2)} s</span></div>
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground"><span>Relative power · dB re strongest bin</span><i/><span>−60</span><span>−30</span><span>0</span></div>
    <p className="m-0 text-xs leading-relaxed text-muted-foreground">{data.method} Color is relative to the strongest displayed power bin; it is not calibrated sound pressure or a clinical threshold. {data.unit}.</p>
    <details className="mt-3"><summary className="cursor-pointer text-sm text-muted-foreground">View time-frequency values · {data.frequencies_hz.length} bands × {data.times_sec.length} frames</summary><p className="mt-2 text-xs text-muted-foreground">The table contains the same bounded matrix displayed above. Raw source values are uncalibrated.</p><div className="mt-2 max-h-64 overflow-auto rounded-md border"><Table><TableCaption>{data.channel} selected-window spectrogram. Source SHA-256 {data.source_sha256}.</TableCaption><TableHeader><TableRow><TableHead>Frequency (Hz)</TableHead>{data.times_sec.map((time,index)=><TableHead key={`${time}-${index}`} className="font-mono tabular-nums">{time.toFixed(3)} s</TableHead>)}</TableRow></TableHeader><TableBody>{data.frequencies_hz.map((frequency,row)=><TableRow key={`${frequency}-${row}`}><TableHead className="font-mono tabular-nums">{frequency.toFixed(2)} Hz</TableHead>{data.power_per_hz[row].map((power,column)=><TableCell key={`${row}-${column}`} className="font-mono tabular-nums">{power.toExponential(5)}</TableCell>)}</TableRow>)}</TableBody></Table></div></details>
  </div>
}

export function FistulaViewer({recordId,availableRecordIds,guided=false,onEvidenceChange,viewerEvidence,locked=false}:{recordId:string;availableRecordIds:string[];guided?:boolean;onEvidenceChange?:(evidence:StudentSignalViewerEvidence)=>void;viewerEvidence?:StudentSignalViewerEvidence|null;locked?:boolean}) {
  const navigate=useNavigate()
  const [searchParams]=useSearchParams()
  const comparisonId=searchParams.get('comparison')
  const savedState=useMemo(()=>guided||comparisonId?null:readSignalWorkspaceState(recordId),[recordId,guided,comparisonId])
  const [record,setRecord]=useState<SignalRecord|null>(null)
  const [recordSearch,setRecordSearch]=useState('')
  const [windowData,setWindowData]=useState<SignalWindow|null>(null)
  const [inspectedSample,setInspectedSample]=useState<SignalWindow['samples'][number]|null>(null)
  const [spectrum,setSpectrum]=useState<SignalSpectrum|null>(null)
  const [spectrogram,setSpectrogram]=useState<SignalSpectrogram|null>(null)
  const [spectrogramLoading,setSpectrogramLoading]=useState(false)
  const [spectrogramError,setSpectrogramError]=useState('')
  const [spectralView,setSpectralView]=useState<'psd'|'spectrogram'>('psd')
  const [features,setFeatures]=useState<SignalFeatures|null>(null)
  const [inspectorTab,setInspectorTab]=useState<'analysis'|'source'>('analysis')
  const [comparisonEnabled,setComparisonEnabled]=useState(false)
  const [comparisonStart,setComparisonStart]=useState(5)
  const [comparisonFeatures,setComparisonFeatures]=useState<SignalFeatures|null>(null)
  const [comparisonLoading,setComparisonLoading]=useState(false)
  const [comparisonError,setComparisonError]=useState('')
  const [savedComparisons,setSavedComparisons]=useState<SignalWindowComparison[]>([])
  const [savingComparison,setSavingComparison]=useState(false)
  const [saveComparisonError,setSaveComparisonError]=useState('')
  const [openedComparisonError,setOpenedComparisonError]=useState('')
  const [channel,setChannel]=useState<StudentSignalViewerEvidence['channel']>(()=>savedState?.channel??'raw PZT1')
  const [start,setStart]=useState(()=>savedState?.start_sec??0)
  const [duration,setDuration]=useState<number>(()=>savedState?.duration_sec??5)
  const [loading,setLoading]=useState(true)
  const [analysisLoading,setAnalysisLoading]=useState(false)
  const [error,setError]=useState('')
  const recordOptions=useMemo(()=>availableRecordIds.map(id=>({id,label:id})),[availableRecordIds])
  const visibleRecordMatches=useMemo(()=>searchSignalRecords(recordOptions,recordSearch,record?.source_case_id??'',option=>option.label,12),[recordOptions,recordSearch,record?.source_case_id])
  const selectedRecordOption=recordOptions.find(option=>option.id===record?.source_case_id)??null
  const maxStart=Math.max(0,(record?.duration_sec??0)-duration)
  const maxComparisonStart=Math.max(0,(record?.duration_sec??0)-duration)
  const timeStep=record?1/record.sample_rate_hz:0.0001
  const effectiveComparisonStart=Math.min(comparisonStart,maxComparisonStart)
  const sameComparisonWindow=sameSourceSampleTime(effectiveComparisonStart,start,record?.sample_rate_hz??0)
  const emitEvidence=(patch:Partial<StudentSignalViewerEvidence>={})=>{if(record&&onEvidenceChange&&!locked)onEvidenceChange({kind:'fistulaguard',case_id:record.case_id,record_id:record.id,channel,start_sec:start,duration_sec:duration,...patch})}
  useEffect(()=>{let live=true;setLoading(true);setRecord(null);setWindowData(null);setSpectrum(null);setSpectrogram(null);setSpectralView('psd');setFeatures(null);setError('');api.signalRecord(recordId).then(value=>{if(live){setRecord(value);setError('')}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Unable to load local FiSaV source')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[recordId])
  useEffect(()=>{if(record&&viewerEvidence?.kind==='fistulaguard'&&viewerEvidence.case_id===record.case_id){setChannel(viewerEvidence.channel);setStart(viewerEvidence.start_sec);setDuration(viewerEvidence.duration_sec)}},[record,viewerEvidence])
  const recordCaseId=record?.case_id
  const recordDuration=record?.duration_sec
  const recordSourceId=record?.source_case_id
  useEffect(()=>{if(recordDuration===undefined)return;const maximum=Math.max(0,recordDuration-duration);if(start>maximum)setStart(maximum)},[recordCaseId,recordDuration,duration,start])
  useEffect(()=>{if(guided||comparisonId||!recordSourceId)return;try{localStorage.setItem(`medforge:fistulaguard:${recordSourceId}`,JSON.stringify({record_id:recordSourceId,channel,start_sec:start,duration_sec:duration} satisfies SignalWorkspacePreferences))}catch{/* Local persistence is optional when browser storage is unavailable. */}},[guided,comparisonId,recordSourceId,channel,start,duration])
  useEffect(()=>{if(recordDuration!==undefined)setComparisonStart(Math.min(5,Math.max(0,recordDuration-5)))},[recordCaseId,recordDuration])
  useEffect(()=>{if(!record)return;const maximum=Math.max(0,record.duration_sec-duration);if(start>maximum)return;let live=true;const timer=window.setTimeout(()=>{setAnalysisLoading(true);setWindowData(null);setInspectedSample(null);setSpectrum(null);setFeatures(null);setError('');Promise.all([api.signalWindow(record.id,channel,start,duration),api.signalSpectrum(record.id,channel,start,duration),api.signalFeatures(record.id,channel,start,duration)]).then(([trace,psd,summary])=>{if(live){setWindowData(trace);setSpectrum(psd);setFeatures(summary)}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Unable to calculate this source window')}).finally(()=>{if(live)setAnalysisLoading(false)})},120);return()=>{live=false;window.clearTimeout(timer)}},[record,channel,start,duration])
  useEffect(()=>{if(!record||spectralView!=='spectrogram')return;let live=true;setSpectrogramLoading(true);setSpectrogramError('');setSpectrogram(null);const timer=window.setTimeout(()=>{api.signalSpectrogram(record.id,channel,start,duration).then(value=>{if(live)setSpectrogram(value)}).catch(e=>{if(live)setSpectrogramError(e instanceof Error?e.message:'Unable to calculate the selected-window spectrogram')}).finally(()=>{if(live)setSpectrogramLoading(false)})},120);return()=>{live=false;window.clearTimeout(timer)}},[record,channel,start,duration,spectralView])
  useEffect(()=>{if(!record||!comparisonEnabled)return;let live=true;setComparisonLoading(true);setComparisonError('');setComparisonFeatures(null);const timer=window.setTimeout(()=>{api.signalFeatures(record.id,channel,Math.min(comparisonStart,maxComparisonStart),duration).then(value=>{if(live)setComparisonFeatures(value)}).catch(e=>{if(live)setComparisonError(e instanceof Error?e.message:'Unable to calculate the comparison window')}).finally(()=>{if(live)setComparisonLoading(false)})},120);return()=>{live=false;window.clearTimeout(timer)}},[record,channel,comparisonEnabled,comparisonStart,maxComparisonStart,duration])
  useEffect(()=>{if(!record||guided){setSavedComparisons([]);return}let live=true;api.signalComparisons(record.case_id).then(value=>{if(live)setSavedComparisons(value)}).catch(()=>{if(live)setSavedComparisons([])});return()=>{live=false}},[record,guided])
  useEffect(()=>{
    if(!record||!comparisonId||guided)return
    let live=true
    setOpenedComparisonError('')
    api.signalComparison(comparisonId).then(item=>{
      if(!live)return
      if(item.case_id!==record.case_id||item.source_sha256!==record.source_sha256){setOpenedComparisonError('This saved comparison belongs to a different source recording or source revision.');return}
      setChannel(item.channel);setStart(item.selected_window.start_sec);setDuration(item.duration_sec);setComparisonStart(item.reference_window.start_sec);setComparisonEnabled(true)
    }).catch(error=>{if(live)setOpenedComparisonError(error instanceof Error?error.message:'Saved comparison could not be reopened')})
    return()=>{live=false}
  },[record,comparisonId,guided])
  const saveSignalComparison=async()=>{if(!record||!features||!comparisonFeatures)return;setSavingComparison(true);setSaveComparisonError('');try{const saved=await api.createSignalComparison({case_id:record.case_id,channel,selected_start_sec:start,reference_start_sec:Math.min(comparisonStart,maxComparisonStart),duration_sec:duration});setSavedComparisons(current=>[saved,...current.filter(item=>item.id!==saved.id)])}catch(e){setSaveComparisonError(e instanceof Error?e.message:'Unable to save this source comparison')}finally{setSavingComparison(false)}}
  if(loading)return <div className="my-4 flex min-h-32 items-center gap-3 rounded-lg border bg-card p-5 text-sm text-muted-foreground"><Activity size={17}/>Validating the local FiSaV recording and source checksum…</div>
  if(error&&!record)return <div className="my-4 flex min-h-32 items-center gap-3 rounded-lg border border-destructive/40 bg-card p-5 text-destructive"><AlertCircle size={18}/><div><b>FiSaV source is unavailable</b><p>{error}</p></div></div>
  if(!record)return <div className="my-4 flex min-h-32 items-center gap-3 rounded-lg border border-destructive/40 bg-card p-5 text-destructive"><AlertCircle size={18}/><b>No checksum-verified FiSaV recording is installed.</b></div>
  return <section className="mt-4 grid gap-4 pb-2 [--signal-viewport:#101624] [--signal-panel:#171f30] [--signal-line:#34415c] [--signal-text:#e9eef7] [--signal-muted:#a6b1c4] [--signal-grid:#29354a] [--signal-axis:#93a2bb]" aria-label="FistulaGuard source signal review">
    {openedComparisonError&&<div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{openedComparisonError}</div>}
    {comparisonId&&!openedComparisonError&&<div role="status" className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">Reopened saved FiSaV windows from their checksum-verified source recording.</div>}
    <header className="grid gap-2 border-b border-border pb-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div><span className="text-xs font-semibold text-muted-foreground">FISTULAGUARD / FiSaV SOURCE LAB</span><h2 className="mt-1 mb-0 text-2xl font-semibold tracking-tight">AVF multichannel signal review</h2><p className="mt-1 mb-0 text-sm text-muted-foreground">Measured CSV recording · {record.source_case_id} · {record.sample_count.toLocaleString()} time samples</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span><b className="font-medium text-foreground">{record.dataset_id}</b> source</span><span>{record.channels.length} recorded channels</span><span>{record.sample_rate_hz.toLocaleString()} samples/s</span><span>{record.duration_sec.toFixed(2)} s total</span></div></div>
      <div className="grid justify-items-start gap-1 sm:justify-items-end"><Badge variant="outline" className="w-fit gap-2 text-primary"><span className="size-2 rounded-full bg-primary"/>Checksum verified</Badge><code className="block max-w-[min(20rem,100%)] truncate font-mono text-[10px] text-muted-foreground" title={`Full SHA-256: ${record.source_sha256}`} aria-label={`Full FiSaV source SHA-256 ${record.source_sha256}`}>{record.source_sha256}</code></div>
    </header>

    <Card className="fistula-control-strip min-w-0 bg-background @container/fistula-controls">
      <CardContent className="grid min-w-0 gap-3 p-3 @md/fistula-controls:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @lg/fistula-controls:grid-cols-[minmax(180px,.8fr)_minmax(210px,1fr)_minmax(0,1.2fr)_auto] @lg/fistula-controls:items-end">
        <div className="grid min-w-0 gap-1">{guided?<span className="text-xs font-medium text-muted-foreground">ASSIGNED SOURCE RECORDING</span>:<label htmlFor="fisav-record" className="text-xs font-medium text-muted-foreground">SEARCH SOURCE RECORDING</label>}{guided?<strong className="truncate text-sm">Assigned · {record.source_case_id}</strong>:<><Combobox items={visibleRecordMatches.items} filter={null} value={selectedRecordOption} inputValue={recordSearch} onInputValueChange={setRecordSearch} onValueChange={option=>{if(option&&option.id!==record.source_case_id){setRecordSearch('');navigate(`/studio/fistulaguard/cases/${encodeURIComponent(`fisav:${option.id}`)}`)}}} itemToStringLabel={option=>option.label} itemToStringValue={option=>option.id} isItemEqualToValue={(option,value)=>option.id===value.id} autoHighlight><ComboboxInput className="w-full" id="fisav-record" aria-label="Search installed FiSaV recordings" placeholder="Search recording ID" showClear/><ComboboxContent>{recordSearch.trim()&&<ComboboxEmpty>No matching FiSaV recordings.</ComboboxEmpty>}<ComboboxList>{option=><ComboboxItem key={option.id} value={option}>{option.label}</ComboboxItem>}</ComboboxList><div className="border-t border-border px-3 py-2 text-[11px] leading-4 text-muted-foreground" role="status" aria-live="polite">{recordSearch.trim()?`Showing ${visibleRecordMatches.items.length} of ${visibleRecordMatches.total} matching recordings`:`Showing ${visibleRecordMatches.items.length} of ${visibleRecordMatches.total} recordings · type to search`}</div></ComboboxContent></Combobox><small className="text-xs text-muted-foreground">{availableRecordIds.length} locally installed · checksum checked on open</small></>}</div>
        <div className="grid min-w-0 gap-1"><span className="text-xs font-medium text-muted-foreground">SOURCE CHANNEL</span><ToggleGroup value={[channel]} multiple={false} disabled={locked} aria-label="Signal channel" className="flex flex-wrap justify-start gap-1" onValueChange={values=>{const next=CHANNELS.find(name=>name===values[0]);if(!next)return;setChannel(next);emitEvidence({channel:next})}}>{CHANNELS.map(name=><ToggleGroupItem variant="outline" size="sm" value={name} key={name} className="data-[state=on]:border-primary data-[state=on]:text-primary">{name==='raw PZT1'?'PZT1':name==='raw PZT2'?'PZT2':name==='raw PZT3'?'PZT3':name==='raw PZT4'?'PZT4':'ECG'}</ToggleGroupItem>)}</ToggleGroup></div>
        <Field className="grid min-w-0 gap-1 @md/fistula-controls:col-span-2 @lg/fistula-controls:col-span-1"><FieldLabel htmlFor="signal-start">Window start · source seconds</FieldLabel><div className="flex min-w-0 items-center gap-2"><Input id="signal-start" aria-label="Window start in seconds" type="number" inputMode="decimal" min={0} max={maxStart} step={timeStep} value={formatSourceTime(Math.min(start,maxStart),record.sample_rate_hz)} disabled={locked} onChange={event=>{const parsed=Number(event.target.value);if(!Number.isFinite(parsed))return;const next=Math.min(maxStart,Math.max(0,parsed));setStart(next);emitEvidence({start_sec:next})}} className="w-32 font-mono tabular-nums"/><span className="text-sm tabular-nums text-muted-foreground">s</span><ToggleGroup value={[String(duration)]} multiple={false} disabled={locked} aria-label="Window duration" className="ml-auto flex gap-1" onValueChange={values=>{const next=[5,10,20].find(seconds=>String(seconds)===values[0]);if(!next)return;const nextStart=Math.min(start,Math.max(0,record.duration_sec-next));setDuration(next);setStart(nextStart);emitEvidence({duration_sec:next,start_sec:nextStart})}}>{[5,10,20].map(seconds=><ToggleGroupItem variant="outline" size="sm" key={seconds} value={String(seconds)}>{seconds}s</ToggleGroupItem>)}</ToggleGroup></div><Slider aria-label="Window start in seconds" min={0} max={maxStart} step={timeStep} value={[Math.min(start,maxStart)]} disabled={locked} onValueChange={value=>{const next=Number(Array.isArray(value)?value[0]:value);setStart(next);emitEvidence({start_sec:next})}} className="w-full"/><small className="text-xs text-muted-foreground">Source timebase · {((timeStep)*1000).toFixed(3)} ms step</small></Field>
        <Badge variant="outline" className={analysisLoading?'w-fit text-muted-foreground':'w-fit text-primary'}>{analysisLoading?'Updating window':'Source aligned'}</Badge>
      </CardContent>
    </Card>

    <div className="grid min-w-0 items-start gap-4">
      <Card className="min-w-0 overflow-hidden border-[var(--signal-line)] bg-[var(--signal-viewport)] text-[var(--signal-text)]">
        <CardHeader className="flex flex-col gap-2 pb-1 sm:flex-row sm:items-center sm:justify-between"><div><span className="text-xs font-semibold tracking-[0.09em] text-[var(--signal-muted)]">MEASURED WAVEFORM</span><CardTitle className="flex items-center gap-2 text-[var(--signal-text)]"><AudioWaveform data-icon="inline-start"/>{channel}</CardTitle><CardDescription className="text-[var(--signal-muted)]">{formatSourceTime(start,record.sample_rate_hz)}–{formatSourceTime(start+duration,record.sample_rate_hz)} s · {windowData?.original_sample_count.toLocaleString()??'—'} source samples</CardDescription></div><div className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-[11px] text-[var(--signal-muted)]"><span>Y · source value</span><span>X · captured time (s)</span></div></CardHeader>
        <CardContent className="min-w-0 pt-2"><SourceWindowLocator start={start} duration={duration} totalDuration={record.duration_sec} sampleRateHz={record.sample_rate_hz}/><div className="h-[420px] min-w-0 overflow-hidden rounded-lg border border-[var(--signal-line)] bg-[var(--signal-panel)] max-[640px]:h-[300px] min-[641px]:max-[1023px]:h-[360px]" role="img" aria-label={`${channel} source waveform from ${formatSourceTime(start,record.sample_rate_hz)} to ${formatSourceTime(start+duration,record.sample_rate_hz)} seconds`}>{windowData?<SignalTrace data={windowData} color={channelColors[channel]??'#57d1bd'} onCursorSample={setInspectedSample}/>:<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading measured source samples…</div>}</div>
          <div className="flex min-h-9 items-center justify-between gap-3 pt-1.5 text-xs tabular-nums text-muted-foreground max-[640px]:items-start max-[640px]:flex-col" aria-label="Waveform cursor sample">
            <span>{inspectedSample?'Inspected plotted source point':'Trace inspection'}</span>
            {inspectedSample?<output className="text-right font-mono tabular-nums text-foreground max-[640px]:text-left">{inspectedSample.time_sec.toFixed(6)} s <b className="font-normal text-muted-foreground">·</b> {inspectedSample.value.toPrecision(8)} <small className="font-sans text-[11px] text-muted-foreground">{windowData?.channel_unit??'source-value (physical unit unspecified)'}</small></output>:<span className="text-right max-[640px]:text-left">Move across the trace to inspect a displayed sample.</span>}
          </div>
          <div className="flex justify-between gap-x-4 gap-y-2 pt-2.5 text-xs leading-relaxed text-[var(--signal-muted)] max-[640px]:flex-col"><span className="inline-flex items-center gap-2"><i className="size-2 shrink-0 rounded-full" style={{background:channelColors[channel]}}/>Original source values · physical unit unspecified</span><span>Plotted trace uses a bounded min/max envelope; analysis uses all source samples.</span></div>
          {windowData&&<WaveformDataTable data={windowData}/>}
        </CardContent>
      </Card>

      <Card className="min-w-0 border-border bg-card">
        <CardHeader className="pb-3"><div className="text-xs font-semibold text-muted-foreground">Same selected source window</div><CardTitle>Analysis &amp; provenance</CardTitle><CardDescription>{channel} · {formatSourceTime(start,record.sample_rate_hz)}–{formatSourceTime(start+duration,record.sample_rate_hz)} s · {features?.sample_count.toLocaleString()??'—'} samples</CardDescription></CardHeader>
        <CardContent className="min-w-0 pt-0">
          <Tabs value={inspectorTab} onValueChange={value=>{if(value==='analysis'||value==='source')setInspectorTab(value)}} className="grid min-w-0 gap-3">
            <TabsList className="grid w-full grid-cols-2" aria-label="Selected signal inspection sections"><TabsTrigger value="analysis">Measured analysis</TabsTrigger><TabsTrigger value="source">Integrity &amp; source</TabsTrigger></TabsList>
            <TabsContent value="analysis" className="grid min-w-0 gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="m-0 text-sm font-semibold">Spectral analysis</h3><Badge variant="outline">Physical unit unspecified</Badge></div>
              <Tabs value={spectralView} onValueChange={value=>{if(value==='psd'||value==='spectrogram')setSpectralView(value)}} className="grid min-w-0 gap-2">
                <TabsList className="grid w-full grid-cols-2" aria-label="Signal spectral views"><TabsTrigger value="psd">Welch PSD</TabsTrigger><TabsTrigger value="spectrogram">Time-frequency</TabsTrigger></TabsList>
                <TabsContent value="psd" className="min-w-0"><div className="h-[340px] min-w-0">{spectrum?<ChartContainer config={spectrumChartConfig} className="h-full min-w-0 w-full"><LineChart accessibilityLayer title={`Power spectral density for ${channel}, ${formatSourceTime(start,record.sample_rate_hz)} to ${formatSourceTime(start+duration,record.sample_rate_hz)} seconds`} desc="Welch power spectral density calculated from the selected measured source window in raw source-value units; physical units are unspecified. Use arrow keys to inspect frequency bins." data={spectrum.frequencies_hz.map((frequency,index)=>({frequency,power:spectrum.power_per_hz[index]}))} margin={{top:8,right:12,left:3,bottom:5}}><CartesianGrid stroke="#dfe5ef" strokeDasharray="3 4"/><XAxis dataKey="frequency" type="number" domain={[0,5000]} tickFormatter={value=>`${Number(value)/1000}k`} tick={{fill:'#667085',fontSize:12}} axisLine={{stroke:'#d5dcea'}} tickLine={false}/><YAxis tickFormatter={value=>Number(value).toExponential(0)} tick={{fill:'#667085',fontSize:11}} axisLine={false} tickLine={false} width={49}/><ChartTooltip content={<ChartTooltipContent indicator="line" labelFormatter={value=>`${Number(value).toFixed(0)} Hz`} formatter={value=><span className="font-mono tabular-nums">{Number(value).toExponential(3)}</span>}/>}/><Line type="monotone" dataKey="power" stroke="var(--color-power)" strokeWidth={1.6} dot={false} isAnimationActive={false}/></LineChart></ChartContainer>:<div className="grid h-full place-items-center text-sm text-muted-foreground">Calculating PSD from the same source window…</div>}</div>
                  {spectrum&&<SpectrumDataTable data={spectrum}/>}<div className="mt-2 text-xs leading-relaxed text-muted-foreground">{spectrum?.method??'Calculated from raw sampled values; units are not calibrated.'}</div><small className="mt-1 block text-xs leading-relaxed text-muted-foreground">{spectrum?.unit??'Power is reported in source-value²/Hz; physical units were not stated.'}</small>
                </TabsContent>
                <TabsContent value="spectrogram" className="min-w-0">{spectrogramLoading?<div className="grid h-60 place-items-center text-sm text-muted-foreground">Calculating a bounded spectrogram from this source window…</div>:spectrogramError?<p className="m-0 grid min-h-56 content-center text-sm text-destructive" role="alert">{spectrogramError}</p>:spectrogram?<SignalSpectrogram data={spectrogram}/>:<div className="grid h-60 place-items-center text-sm text-muted-foreground">Choose this view to calculate its time-frequency map.</div>}</TabsContent>
              </Tabs>
              <Separator/>
              <section aria-labelledby="fistula-descriptive-features" className="grid gap-2"><div><h3 id="fistula-descriptive-features" className="m-0 text-sm font-semibold">Descriptive signal features</h3><p className="m-0 mt-1 text-xs text-muted-foreground">Measured window · source-value units</p></div><div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">{[
                ['Mean',features?.mean],['Median',features?.median],['Standard deviation',features?.standard_deviation],['RMS',features?.rms],['Peak-to-peak',features?.peak_to_peak],['Exact zero fraction',features?.zero_fraction],['Adjacent repeats',features?.adjacent_repeat_fraction],
              ].map(([label,value])=><div key={String(label)} className="grid min-w-0 content-start gap-0.5 border-t border-border pt-1.5"><span className="text-xs leading-snug text-muted-foreground">{label}</span><b className="break-words font-mono text-xs font-medium tabular-nums">{typeof value==='number'?(String(label).includes('fraction')||String(label)==='Adjacent repeats'?`${(value*100).toFixed(2)}%`:value.toFixed(6)):'—'}</b></div>)}</div><p className="m-0 text-xs leading-relaxed text-muted-foreground">{features?.method??'Features are computed from the selected measured sample window.'} Units: {features?.unit??'source-value (physical unit unspecified)'}</p></section>
            </TabsContent>
            <TabsContent value="source" className="grid min-w-0 gap-4">
              <section aria-labelledby="fistula-signal-integrity" className="grid gap-2"><div><h3 id="fistula-signal-integrity" className="m-0 text-sm font-semibold">Selected-window data checks</h3><p className="m-0 mt-1 text-xs leading-relaxed text-muted-foreground">Descriptive checks only; they do not grade clinical signal adequacy.</p></div><dl className="m-0 grid gap-1.5"><div className="flex min-h-7 items-center justify-between gap-3"><dt className="text-xs text-muted-foreground">Finite source values</dt><dd><Badge variant="outline">{features?`${features.finite_sample_count.toLocaleString()} / ${features.sample_count.toLocaleString()}`:'—'}</Badge></dd></div><Separator/><div className="flex min-h-7 items-center justify-between gap-3"><dt className="text-xs text-muted-foreground">Non-finite values</dt><dd><Badge variant="outline">{features?.nonfinite_sample_count.toLocaleString()??'—'}</Badge></dd></div><Separator/><div className="flex min-h-7 items-center justify-between gap-3"><dt className="text-xs text-muted-foreground">Timestamp interval deviations</dt><dd><Badge variant="outline">{features?`${features.timestamp_interval_deviation_count} / ${features.timestamp_interval_count}`:'—'}</Badge></dd></div><Separator/><div className="flex min-h-7 items-center justify-between gap-3"><dt className="text-xs text-muted-foreground">Constant-value window</dt><dd><Badge variant="outline">{features?features.constant_signal?'Yes':'No':'—'}</Badge></dd></div></dl><p className="m-0 text-xs leading-relaxed text-muted-foreground">Intervals are compared with the timebase median using a {((features?.timestamp_interval_tolerance_fraction??0.001)*100).toFixed(2)}% deviation threshold. This transparent count is not a pass/fail quality limit. The loader rejects non-finite source rows.</p></section>
              <Separator/>
              <section aria-labelledby="fistula-source-provenance" className="grid gap-2"><div><h3 id="fistula-source-provenance" className="m-0 text-sm font-semibold">FiSaV source provenance</h3><p className="m-0 text-xs text-muted-foreground">Checksum verified · source: {record.source_case_id}</p></div><dl className="m-0 grid gap-2 text-xs"><div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 border-t pt-2"><dt className="text-muted-foreground">Dataset DOI</dt><dd className="m-0 break-words">10.17605/OSF.IO/HYPFR</dd></div><div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 border-t pt-2"><dt className="text-muted-foreground">Data license</dt><dd className="m-0 break-words">CC BY 4.0</dd></div><div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 border-t pt-2"><dt className="text-muted-foreground">Raw CSV SHA-256</dt><dd className="m-0 break-all font-mono">{record.source_sha256}</dd></div><div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 border-t pt-2"><dt className="text-muted-foreground">Channel map</dt><dd className="m-0 break-words">ECG · raw PZT1–PZT4 · occlusion indicator</dd></div></dl><div className="flex flex-wrap gap-x-4 gap-y-1"><a className="inline-flex text-sm text-primary underline-offset-4 hover:underline" href="https://osf.io/hypfr/" target="_blank" rel="noreferrer">Official data repository ↗</a><a className="inline-flex text-sm text-primary underline-offset-4 hover:underline" href="https://www.nature.com/articles/s41597-026-08242-8" target="_blank" rel="noreferrer">Data descriptor ↗</a></div></section>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>

    <Card className="min-w-0"><CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between"><div><span className="text-xs font-semibold text-muted-foreground">Same-record feature comparison</span><CardTitle className="flex items-center gap-2"><ArrowLeftRight data-icon="inline-start"/>Compare source windows</CardTitle><CardDescription>Compare the selected interval with another interval from this recording, using the same channel and length.</CardDescription></div><Button variant={comparisonEnabled?'secondary':'outline'} aria-pressed={comparisonEnabled} disabled={locked} onClick={()=>setComparisonEnabled(value=>!value)}>{comparisonEnabled?'Hide comparison':'Compare another window'}</Button></CardHeader>{comparisonEnabled&&<CardContent className="grid gap-4"><Field className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><FieldLabel htmlFor="signal-comparison-start">Reference window start · seconds</FieldLabel><div className="flex min-w-0 items-center gap-2"><Input id="signal-comparison-start" aria-label="Reference window start in seconds" type="number" inputMode="decimal" min={0} max={maxComparisonStart} step={timeStep} value={formatSourceTime(effectiveComparisonStart,record.sample_rate_hz)} disabled={locked} onChange={event=>{const parsed=Number(event.target.value);if(Number.isFinite(parsed))setComparisonStart(Math.min(maxComparisonStart,Math.max(0,parsed)))}} className="w-36 tabular-nums"/><span className="text-sm tabular-nums text-muted-foreground">s</span></div><output htmlFor="signal-comparison-start" className="text-sm tabular-nums text-muted-foreground">{formatSourceTime(effectiveComparisonStart,record.sample_rate_hz)}–{formatSourceTime(effectiveComparisonStart+duration,record.sample_rate_hz)} s</output><Slider aria-label="Reference window start in seconds" min={0} max={maxComparisonStart} step={timeStep} value={[effectiveComparisonStart]} disabled={locked} onValueChange={value=>setComparisonStart(Number(Array.isArray(value)?value[0]:value))} className="w-full sm:col-span-2"/><small className="text-xs leading-relaxed text-muted-foreground">Fine adjustment step: {(timeStep*1000).toFixed(3)} ms.</small></Field>{sameComparisonWindow&&<p className="m-0 text-sm text-muted-foreground">Choose a different reference start time to compare distinct windows.</p>}{comparisonError?<p className="m-0 text-sm text-muted-foreground" role="alert">{comparisonError}</p>:comparisonLoading||!comparisonFeatures||!features?<p className="m-0 text-sm text-muted-foreground" aria-live="polite">{comparisonLoading?'Calculating descriptive features for both source windows…':'Waiting for the selected source window…'}</p>:<div className="w-full overflow-x-auto"><Table className="min-w-[640px]"><TableHeader><TableRow><TableHead scope="col" className="text-left">Measured feature</TableHead><TableHead scope="col" className="text-right">Selected · {formatSourceTime(start,record.sample_rate_hz)} s</TableHead><TableHead scope="col" className="text-right">Reference · {formatSourceTime(effectiveComparisonStart,record.sample_rate_hz)} s</TableHead><TableHead scope="col" className="text-right">Selected − reference</TableHead></TableRow></TableHeader><TableBody>{([
      ['Mean','mean'],['Median','median'],['Standard deviation','standard_deviation'],['RMS','rms'],['Peak-to-peak','peak_to_peak'],['Exact zero fraction','zero_fraction'],['Adjacent repeats','adjacent_repeat_fraction'],
    ] as const).map(([label,key])=>{const current=features[key],reference=comparisonFeatures[key],fraction=key.endsWith('_fraction'),delta=current-reference;return <TableRow key={key}><TableHead scope="row" className="text-left">{label}</TableHead><TableCell className="text-right tabular-nums">{fraction?`${(current*100).toFixed(2)}%`:current.toFixed(6)}</TableCell><TableCell className="text-right tabular-nums">{fraction?`${(reference*100).toFixed(2)}%`:reference.toFixed(6)}</TableCell><TableCell className="text-right tabular-nums">{fraction?`${delta>=0?'+':''}${(delta*100).toFixed(2)} percentage points`:`${delta>=0?'+':''}${delta.toFixed(6)}`}</TableCell></TableRow>})}</TableBody></Table></div>}<CardDescription className="text-xs leading-relaxed">Both windows come from {record.source_case_id}, channel {channel}, with {duration} seconds per window. Differences are descriptive, use uncalibrated source values, and do not indicate improvement, disease severity, or clinical significance.</CardDescription>{!guided&&<><div className="flex flex-wrap items-center gap-3"><Button onClick={()=>void saveSignalComparison()} disabled={savingComparison||comparisonLoading||!comparisonFeatures||!features||sameComparisonWindow}>{savingComparison?'Saving comparison…':'Save comparison'}</Button>{saveComparisonError&&<span role="alert">{saveComparisonError}</span>}</div>{savedComparisons.length>0&&<div className="grid gap-2 border-t pt-3"><div className="text-xs font-semibold text-muted-foreground">Saved comparisons · {savedComparisons.length}</div>{savedComparisons.map(item=><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2" key={item.id}><Button type="button" variant="outline" className="h-auto min-h-13 w-full justify-between gap-3 whitespace-normal text-left" onClick={()=>{setChannel(item.channel);setStart(item.selected_window.start_sec);setDuration(item.duration_sec);setComparisonStart(item.reference_window.start_sec);setComparisonEnabled(true)}}><span className="grid min-w-0 gap-1"><b className="text-xs font-medium">{item.channel}</b><span className="text-xs leading-relaxed text-muted-foreground">{formatSourceTime(item.selected_window.start_sec,record.sample_rate_hz)}–{formatSourceTime(item.selected_window.start_sec+item.duration_sec,record.sample_rate_hz)} s vs {formatSourceTime(item.reference_window.start_sec,record.sample_rate_hz)}–{formatSourceTime(item.reference_window.start_sec+item.duration_sec,record.sample_rate_hz)} s</span></span><span className="text-xs leading-relaxed text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span></Button><Button type="button" size="icon" variant="ghost" aria-label={`Download JSON evidence for ${item.channel} comparison`} onClick={()=>downloadSignalComparison(item)}><Download aria-hidden="true"/></Button></div>)}</div>}</>}</CardContent>}</Card>
    <Card className="min-w-0"><CardHeader><div className="text-xs font-semibold text-muted-foreground">Analysis boundary</div><CardTitle>What this view represents</CardTitle></CardHeader><CardContent><ul className="m-0 grid list-disc gap-2 pl-5 text-sm leading-relaxed text-muted-foreground">{record.limitations.map(item=><li key={item}>{item}</li>)}</ul><div className="mt-3 flex items-start gap-2 border-t pt-3 text-sm leading-relaxed text-muted-foreground"><AlertCircle size={14}/>No stenosis label, score, or diagnostic interpretation is shown.</div></CardContent></Card>
    {!guided&&<SimulatedDevicePanel/>}
    {!guided&&<SignalTools key={record.id} recordId={record.id} channel={channel} start={start} duration={duration} recordDuration={record.duration_sec} sampleRateHz={record.sample_rate_hz}/>}
    <div className="text-right text-xs text-muted-foreground">Centracchio, Cinotti, Parlato et al. · FiSaV Dataset · Scientific Data (2026) · CC BY 4.0</div>
  </section>
}
