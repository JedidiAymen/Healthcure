import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { api, type CholecT50FrameRecord, type CholecT50VideoRecord } from '@/lib/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'

const labelCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

export function CholecT50Review() {
  const [videos, setVideos] = useState<CholecT50VideoRecord[]>([])
  const [videoId, setVideoId] = useState('')
  const [frames, setFrames] = useState<CholecT50FrameRecord[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const activeIndexRef = useRef(0)
  const [selectedAnnotation, setSelectedAnnotation] = useState<number | null>(null)
  const [showBoxes, setShowBoxes] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    api.cholecT50Videos().then((records) => {
      if (!live) return
      setVideos(records)
      setVideoId(records[0]?.video_id ?? '')
      setError('')
    }).catch((reason: unknown) => {
      if (live) setError(reason instanceof Error ? reason.message : 'The verified CholecT50 source is unavailable.')
    }).finally(() => {
      if (live) setLoading(false)
    })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!videoId) return
    let live = true
    setPlaying(false)
    setLoading(true)
    setFrames([])
    setActiveIndex(0)
    setSelectedAnnotation(null)
    api.cholecT50Frames(videoId).then((records) => {
      if (!live) return
      setFrames(records)
      const firstAnnotated = records.findIndex((record) => record.annotations.some((annotation) => annotation.bbox_xywh_px))
      const firstAvailable = firstAnnotated < 0 ? 0 : firstAnnotated
      activeIndexRef.current = firstAvailable
      setActiveIndex(firstAvailable)
      setError('')
    }).catch((reason: unknown) => {
      if (live) setError(reason instanceof Error ? reason.message : 'The verified frame sequence is unavailable.')
    }).finally(() => {
      if (live) setLoading(false)
    })
    return () => { live = false }
  }, [videoId])

  useEffect(() => {
    if (!playing || frames.length < 2) return
    const timer = window.setInterval(() => {
      const nextIndex = Math.min(activeIndexRef.current + 1, frames.length - 1)
      activeIndexRef.current = nextIndex
      setActiveIndex(nextIndex)
      setSelectedAnnotation(null)
      if (nextIndex === frames.length - 1) setPlaying(false)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [playing, frames.length])

  const goToSample = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, frames.length - 1))
    activeIndexRef.current = nextIndex
    setActiveIndex(nextIndex)
    setSelectedAnnotation(null)
  }

  const currentVideo = videos.find((video) => video.video_id === videoId)
  const frame = frames[activeIndex]
  const annotations = useMemo(() => frame?.annotations ?? [], [frame])
  const selected = selectedAnnotation === null ? null : annotations[selectedAnnotation] ?? null
  const frameSummary = useMemo(() => ({
    boxes: annotations.filter((annotation) => annotation.bbox_xywh_px).length,
    labels: annotations.length,
  }), [annotations])

  if (loading && videos.length === 0) {
    return <Card aria-label="CholecT50 annotated frame review"><CardContent className="py-8 text-sm text-muted-foreground">Loading verified cholecystectomy frame and annotation sources…</CardContent></Card>
  }
  if (error && videos.length === 0) return null
  if (!videos.length) return null

  return (
    <Card className="min-w-0 overflow-hidden" aria-label="CholecT50 annotated cholecystectomy source review">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">Matched source labels · CC BY-NC-SA 4.0</Badge>
          <Badge variant="secondary">1 fps source samples</Badge>
        </div>
        <CardTitle>Cholecystectomy evidence review</CardTitle>
        <CardDescription>
          Real CholecT50 challenge-validation frames with their own published action labels and tool-tip boxes. This release contains selected still samples rather than the continuous source movie; only original sampled frames are shown.
        </CardDescription>
        {error && <Alert variant="destructive"><AlertTitle>Frame source unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(12rem,20rem)_1fr] sm:items-end">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="cholect50-video">Source clip</label>
            <Select value={videoId} onValueChange={(value) => { if (value) { setPlaying(false); setVideoId(value) } }}>
              <SelectTrigger id="cholect50-video" className="w-full"><SelectValue placeholder="Choose a source clip" /></SelectTrigger>
              <SelectContent><SelectGroup>{videos.map((video) => <SelectItem key={video.video_id} value={video.video_id}>{video.video_id} · {video.sampled_frame_count} source frames</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span>{currentVideo?.annotated_frame_count.toLocaleString()} labeled samples</span>
            <span>{currentVideo?.sampled_frame_count.toLocaleString()} installed frames</span>
            <span>Archive {currentVideo?.sha256.slice(0, 12)}…</span>
            <a className="text-primary hover:underline" href={currentVideo?.source_url} target="_blank" rel="noreferrer">Dataset source ↗</a>
          </div>
        </div>

        {frame ? (
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(18rem,1fr)]">
            <div className="grid min-w-0 gap-3">
              <div className="relative min-w-0 overflow-hidden rounded-lg bg-neutral-950" style={{ aspectRatio: `${frame.width} / ${frame.height}` }}>
                <img className="absolute inset-0 size-full select-none object-contain" src={api.cholecT50ImageUrl(frame.video_id, frame.frame_number)} alt={`${frame.video_id} authentic cholecystectomy sample at ${frame.sample_time_sec} seconds`} draggable={false} />
                {showBoxes && <svg className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${frame.width} ${frame.height}`} preserveAspectRatio="none" role="img" aria-label={`${frameSummary.boxes} published tool-tip boxes; source annotation, not model output`}>
                  {annotations.map((annotation, index) => {
                    const bbox = annotation.bbox_xywh_px
                    if (!bbox) return null
                    const [x, y, width, height] = bbox
                    const active = selectedAnnotation === index
                    const label = annotation.instrument_label
                    const labelY = Math.max(15, y - 5)
                    return <g key={`${annotation.triplet_id}-${index}`}>
                      <title>{annotation.triplet_label}</title>
                      <rect x={x} y={y} width={width} height={height} fill="var(--chart-1)" fillOpacity={active ? 0.16 : 0.05} stroke="var(--chart-1)" strokeWidth={active ? 3 : 2} vectorEffect="non-scaling-stroke" />
                      <text x={x + 3} y={labelY} fill="white" stroke="#101624" strokeWidth="3" paintOrder="stroke" fontSize="13" fontWeight="700">{labelCase(label)}</text>
                    </g>
                  })}
                </svg>}
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-neutral-950/85 px-3 py-2 text-xs text-white">
                  <span>{frame.video_id} · source frame {frame.frame_number} · {frame.width} × {frame.height} px</span>
                  <span>Sample index {activeIndex + 1} / {frames.length} · t = {frame.sample_time_sec.toFixed(0)} s</span>
                </div>
              </div>
              <div className="grid gap-3 rounded-lg border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant="outline">{frame.phase_label ? labelCase(frame.phase_label) : 'No phase label'}</Badge>
                    <Badge variant="secondary">{frameSummary.boxes} source boxes</Badge>
                    <Badge variant="outline">{frameSummary.labels} action labels</Badge>
                  </div>
                  <label className="flex items-center gap-2 text-sm" htmlFor="cholect50-box-toggle"><Checkbox id="cholect50-box-toggle" checked={showBoxes} onCheckedChange={(checked) => setShowBoxes(checked === true)} /><span>Show boxes</span></label>
                </div>
                <Slider aria-label="Published source-frame sample index" min={0} max={Math.max(0, frames.length - 1)} step={1} value={[activeIndex]} onValueChange={(value) => { const index = Array.isArray(value) ? value[0] : value; if (typeof index === 'number') goToSample(index) }} />
                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={() => goToSample(activeIndex - 1)} disabled={activeIndex === 0}><ChevronLeft data-icon="inline-start"/>Previous sample</Button>
                  <Button variant={playing ? 'secondary' : 'default'} size="sm" aria-pressed={playing} onClick={() => setPlaying((value) => !value)} disabled={frames.length < 2 || (activeIndex >= frames.length - 1 && !playing)}>{playing ? <Pause data-icon="inline-start"/> : <Play data-icon="inline-start"/>}{playing ? 'Pause samples' : 'Play samples'}</Button>
                  <Button variant="outline" size="sm" onClick={() => goToSample(activeIndex + 1)} disabled={activeIndex >= frames.length - 1}>Next sample<ChevronRight data-icon="inline-end"/></Button>
                </div>
                <p role="status" aria-live="polite" className="m-0 text-center text-xs text-muted-foreground">{playing ? 'Reviewing available source samples at one sample per second.' : 'Sparse source samples · timestamps use published frame indices · no missing frames are filled in.'} Source-time gaps are skipped; this is not continuous video.</p>
              </div>
            </div>

            <aside className="grid min-w-0 content-start gap-3">
              <Card>
                <CardHeader className="gap-1"><CardDescription>Published source annotations</CardDescription><CardTitle className="text-base">Tool · action · anatomy</CardTitle></CardHeader>
                <CardContent className="grid gap-2">
                  {annotations.length ? annotations.map((annotation, index) => (
                    <button key={`${annotation.triplet_id}-${index}`} type="button" aria-pressed={selectedAnnotation === index} onClick={() => setSelectedAnnotation(index)} className={`grid min-w-0 gap-1 rounded-md border p-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedAnnotation === index ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <span className="truncate text-sm font-semibold">{labelCase(annotation.instrument_label)} <span className="font-normal text-muted-foreground">·</span> {labelCase(annotation.verb_label)}</span>
                      <span className="truncate text-sm">{labelCase(annotation.target_label)}</span>
                      <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"><Badge variant="outline">Triplet {annotation.triplet_id}</Badge>{annotation.bbox_xywh_px ? <span>box in original pixels</span> : <span>no source box on this row</span>}</span>
                    </button>
                  )) : <p className="m-0 rounded-md border border-dashed p-3 text-sm text-muted-foreground">No action label was published for this sample.</p>}
                  {selected?.bbox_xywh_px && <dl className="m-0 grid gap-1 border-t pt-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Box x · y</dt><dd className="m-0 font-mono tabular-nums">{selected.bbox_xywh_px[0].toFixed(1)} · {selected.bbox_xywh_px[1].toFixed(1)} px</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Box w · h</dt><dd className="m-0 font-mono tabular-nums">{selected.bbox_xywh_px[2].toFixed(1)} · {selected.bbox_xywh_px[3].toFixed(1)} px</dd></div></dl>}
                </CardContent>
              </Card>
              <Alert><AlertTitle>Reference annotations, not AI output</AlertTitle><AlertDescription>The outlines and action labels are taken from the source release for this exact frame. No predictions are displayed or inferred for neighboring frames.</AlertDescription></Alert>
              <p className="m-0 break-all text-[11px] leading-relaxed text-muted-foreground">Image SHA-256 {frame.image_sha256}<br/>Annotation SHA-256 {frame.annotation_sha256}</p>
              <p className="m-0 text-xs text-muted-foreground">{currentVideo?.citation}</p>
            </aside>
          </div>
        ) : loading ? <p className="m-0 py-8 text-sm text-muted-foreground">Loading checksum-verified frames and annotations…</p> : <Alert><AlertTitle>No frame samples available</AlertTitle><AlertDescription>This source sequence has no verified frame records.</AlertDescription></Alert>}
      </CardContent>
    </Card>
  )
}
