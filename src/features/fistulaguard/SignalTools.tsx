import { useEffect, useState } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { AlertTriangle, CheckCircle2, HeartPulse, Layers, SlidersHorizontal, StickyNote, Trash2, XCircle } from "lucide-react"
import { api, type SignalQuality, type BeatAnalysis, type SignalAnnotation, type SignalFilterQuery, type SignalFilterResult, type SignalWindow } from "@/lib/api"
import { overlayWindows, validateFilterInput } from "@/lib/signal-tools"
import { useSession } from "@/lib/session"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type Props = { recordId: string; channel: string; start: number; duration: number; recordDuration: number; sampleRateHz: number }

const UNCALIBRATED = "Sensor units are uncalibrated. Compare shapes and timing within this recording; do not compare amplitudes across recordings."
const traceConfig = { raw: { label: "Raw", color: "#94a3b8" }, filtered: { label: "Filtered", color: "#6f55bd" }, a: { label: "Window A", color: "#57d1bd" }, b: { label: "Window B", color: "#ecbd67" } } satisfies ChartConfig

function pairs(trace: { time_sec: number[]; values: number[] }) {
  return trace.time_sec.map((t, index) => ({ t, v: trace.values[index] }))
}

function NumberField({ id, label, value, onChange, step = 1 }: { id: string; label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return <Field className="grid gap-1"><FieldLabel htmlFor={id}>{label}</FieldLabel><Input id={id} type="number" inputMode="decimal" step={step} value={Number.isFinite(value) ? value : ""} onChange={event => onChange(Number(event.target.value))} className="w-32 font-mono tabular-nums" /></Field>
}

function FilterTab({ recordId, channel, start, duration, sampleRateHz }: Props) {
  const [mode, setMode] = useState<"bandpass" | "notch">("bandpass")
  const [low, setLow] = useState(20), [high, setHigh] = useState(800), [notch, setNotch] = useState(50), [q, setQ] = useState(30)
  const [result, setResult] = useState<SignalFilterResult | null>(null)
  const [error, setError] = useState(""), [loading, setLoading] = useState(false)
  const filter: SignalFilterQuery = mode === "bandpass" ? { mode, low_hz: low, high_hz: high } : { mode, notch_hz: notch, q }
  const problem = validateFilterInput(filter, sampleRateHz)
  const shownDuration = Math.min(duration, 20)
  const run = async () => {
    if (problem) return
    setLoading(true); setError("")
    try { setResult(await api.signalFiltered(recordId, channel, start, shownDuration, filter)) }
    catch (e) { setError(e instanceof Error ? e.message : "The filtered window could not be calculated") }
    finally { setLoading(false) }
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <ToggleGroup value={[mode]} multiple={false} aria-label="Filter type" onValueChange={values => { if (values[0] === "bandpass" || values[0] === "notch") setMode(values[0]) }}>
          <ToggleGroupItem variant="outline" size="sm" value="bandpass">Band-pass</ToggleGroupItem>
          <ToggleGroupItem variant="outline" size="sm" value="notch">Notch</ToggleGroupItem>
        </ToggleGroup>
        {mode === "bandpass"
          ? <><NumberField id="filter-low" label="Low cutoff (Hz)" value={low} onChange={setLow} /><NumberField id="filter-high" label="High cutoff (Hz)" value={high} onChange={setHigh} /></>
          : <><NumberField id="filter-notch" label="Notch frequency (Hz)" value={notch} onChange={setNotch} /><NumberField id="filter-q" label="Quality factor Q" value={q} onChange={setQ} /></>}
        <Button type="button" size="sm" disabled={Boolean(problem) || loading} onClick={() => void run()}>{loading ? "Filtering..." : "Apply to this window"}</Button>
      </div>
      {problem && <p className="text-sm text-destructive" role="alert">{problem}</p>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {result && <>
        <p className="text-sm text-muted-foreground">{result.filter.method}. {result.channel}, {result.start_sec.toFixed(3)} to {(result.start_sec + result.duration_sec).toFixed(3)} s.</p>
        <ChartContainer config={traceConfig} className="aspect-auto h-64 w-full" role="img" aria-label={`Raw and filtered ${result.channel} traces`}>
          <LineChart margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis type="number" dataKey="t" domain={["dataMin", "dataMax"]} tickFormatter={value => `${Number(value).toFixed(1)} s`} />
            <YAxis width={64} domain={["auto", "auto"]} tickFormatter={value => Number(value).toPrecision(3)} />
            <Line data={pairs(result.raw)} dataKey="v" name="Raw" stroke="var(--color-raw)" dot={false} isAnimationActive={false} strokeWidth={1} />
            <Line data={pairs(result.filtered)} dataKey="v" name="Filtered" stroke="var(--color-filtered)" dot={false} isAnimationActive={false} strokeWidth={1.5} />
          </LineChart>
        </ChartContainer>
        <p className="text-xs text-muted-foreground">Grey: raw source values. Purple: filtered. {result.limitations.join(" ")}</p>
      </>}
    </div>
  )
}

function BeatsTab({ recordId, channel, start, duration }: Props) {
  const [result, setResult] = useState<BeatAnalysis | null>(null)
  const [error, setError] = useState(""), [loading, setLoading] = useState(false)
  const window = Math.max(2, Math.min(duration, 30))
  useEffect(() => {
    let live = true
    setLoading(true); setError(""); setResult(null)
    const timer = setTimeout(() => {
      api.signalBeats(recordId, channel, start, window).then(value => { if (live) setResult(value) })
        .catch(e => { if (live) setError(e instanceof Error ? e.message : "Beats could not be detected") })
        .finally(() => { if (live) setLoading(false) })
    }, 250)
    return () => { live = false; clearTimeout(timer) }
  }, [recordId, channel, start, window])
  if (loading) return <p className="text-sm text-muted-foreground">Detecting beats from the ECG lead...</p>
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  if (!result) return null
  const ensemble = result.ensemble.time_sec.map((t, index) => ({ t, v: result.ensemble.mean[index] }))
  return (
    <div className="grid gap-3">
      {result.occlusion_test.overlaps_window && <Alert><AlertTriangle /><AlertTitle>This window overlaps the occlusion test</AlertTitle><AlertDescription>{result.occlusion_test.meaning} Test window: {result.occlusion_test.intervals.map(([a, b]) => `${a.toFixed(1)} to ${b.toFixed(1)} s`).join(", ")}.</AlertDescription></Alert>}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{result.r_peaks_sec.length} beats detected</Badge>
        {result.heart_rate_bpm.mean !== null && <Badge variant="outline">Mean {result.heart_rate_bpm.mean.toFixed(1)} bpm (range {result.heart_rate_bpm.min?.toFixed(1)} to {result.heart_rate_bpm.max?.toFixed(1)})</Badge>}
        <Badge variant="outline">Ensemble of {result.ensemble.beats_used} beats</Badge>
      </div>
      {ensemble.length > 0 && <ChartContainer config={traceConfig} className="aspect-auto h-48 w-full" role="img" aria-label={`Ensemble average of ${result.channel} around each R peak`}>
        <LineChart data={ensemble} margin={{ left: 8, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis type="number" dataKey="t" domain={["dataMin", "dataMax"]} tickFormatter={value => `${(Number(value) * 1000).toFixed(0)} ms`} />
          <YAxis width={64} domain={["auto", "auto"]} tickFormatter={value => Number(value).toPrecision(3)} />
          <Line dataKey="v" name="Ensemble mean" stroke="var(--color-filtered)" dot={false} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>}
      <div className="max-h-64 overflow-auto rounded-md border">
        <Table>
          <TableCaption>Per-beat {result.channel} measurements, 200 ms before to 600 ms after each R peak. Source SHA-256 {result.source_sha256.slice(0, 12)}...</TableCaption>
          <TableHeader><TableRow><TableHead>Beat</TableHead><TableHead>R peak (s)</TableHead><TableHead>RR (s)</TableHead><TableHead>Peak-to-peak</TableHead><TableHead>RMS</TableHead></TableRow></TableHeader>
          <TableBody>{result.beats.map(beat => <TableRow key={beat.index}><TableCell>{beat.index + 1}</TableCell><TableCell className="font-mono tabular-nums">{beat.r_peak_sec.toFixed(3)}</TableCell><TableCell className="font-mono tabular-nums">{beat.rr_sec?.toFixed(3) ?? "-"}</TableCell><TableCell className="font-mono tabular-nums">{beat.peak_to_peak?.toPrecision(4) ?? "incomplete"}</TableCell><TableCell className="font-mono tabular-nums">{beat.rms?.toPrecision(4) ?? "incomplete"}</TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{result.method}</p>
      <ul className="list-disc pl-5 text-xs text-muted-foreground">{result.limitations.map(note => <li key={note}>{note}</li>)}</ul>
    </div>
  )
}

function OverlayTab({ recordId, channel, start, duration, recordDuration }: Props) {
  const maxStart = Math.max(0, recordDuration - duration)
  const [otherStart, setOtherStart] = useState(() => Math.min(maxStart, start + duration))
  const [windows, setWindows] = useState<[SignalWindow, SignalWindow] | null>(null)
  const [error, setError] = useState("")
  const valid = Number.isFinite(otherStart) && otherStart >= 0 && otherStart <= maxStart
  useEffect(() => {
    if (!valid) return
    let live = true
    setError("")
    const timer = setTimeout(() => {
      Promise.all([api.signalWindow(recordId, channel, start, duration), api.signalWindow(recordId, channel, otherStart, duration)])
        .then(value => { if (live) setWindows(value) })
        .catch(e => { if (live) setError(e instanceof Error ? e.message : "The windows could not be loaded") })
    }, 250)
    return () => { live = false; clearTimeout(timer) }
  }, [recordId, channel, start, duration, otherStart, valid])
  const data = windows ? overlayWindows(windows[0], windows[1]) : []
  return (
    <div className="grid gap-3">
      <Alert><AlertTriangle /><AlertDescription>{UNCALIBRATED}</AlertDescription></Alert>
      <div className="flex flex-wrap items-end gap-3">
        <NumberField id="overlay-start" label="Window B start (s)" value={otherStart} onChange={setOtherStart} step={0.1} />
        <span className="text-sm text-muted-foreground">Window A starts at {start.toFixed(3)} s. Both are {duration} s of {channel} from this recording.</span>
      </div>
      {!valid && <p className="text-sm text-destructive" role="alert">Window B must start between 0 and {maxStart.toFixed(1)} s.</p>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {data.length > 0 && <ChartContainer config={traceConfig} className="aspect-auto h-64 w-full" role="img" aria-label={`Two ${channel} windows overlaid on time since window start`}>
        <LineChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis type="number" dataKey="t" domain={["dataMin", "dataMax"]} tickFormatter={value => `${Number(value).toFixed(1)} s`} />
          <YAxis width={64} domain={["auto", "auto"]} tickFormatter={value => Number(value).toPrecision(3)} />
          <Line dataKey="a" name="Window A" stroke="var(--color-a)" dot={false} connectNulls isAnimationActive={false} />
          <Line dataKey="b" name="Window B" stroke="var(--color-b)" dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ChartContainer>}
      <p className="text-xs text-muted-foreground">Teal: window A. Amber: window B. Time is measured from each window start.</p>
    </div>
  )
}

function QualityTab({ recordId, channel, start, duration }: Props) {
  const [result, setResult] = useState<SignalQuality | null>(null)
  const [error, setError] = useState("")
  const window = Math.max(2, Math.min(duration, 30))
  useEffect(() => {
    let live = true
    setResult(null); setError("")
    api.signalQuality(recordId, channel, start, window).then(value => { if (live) setResult(value) })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : "Quality checks failed to run") })
    return () => { live = false }
  }, [recordId, channel, start, window])
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  if (!result) return <p className="text-sm text-muted-foreground">Running signal-quality checks...</p>
  return (
    <div className="grid gap-3">
      <Badge variant={result.usable ? "secondary" : "outline"}>{result.usable ? "Usable window" : "Insufficient quality, not scored"}</Badge>
      <ul className="grid gap-1.5">{result.checks.map(check => <li key={check.name} className="flex flex-wrap items-center gap-2 text-sm">
        {check.passed ? <CheckCircle2 aria-label="passed" className="size-4 text-[var(--med-success)]" /> : <XCircle aria-label="failed" className="size-4 text-destructive" />}
        <b>{check.name}</b><span className="font-mono text-xs">{check.measured.toPrecision(4)}</span><span className="text-xs text-muted-foreground">({check.threshold})</span>
      </li>)}</ul>
      <ul className="list-disc pl-5 text-xs text-muted-foreground">{result.limitations.map(note => <li key={note}>{note}</li>)}</ul>
    </div>
  )
}

function AnnotationsTab({ recordId, channel, start, duration }: Props) {
  const { user } = useSession()
  const canAnnotate = user?.role === "educator" || user?.role === "admin"
  const [items, setItems] = useState<SignalAnnotation[]>([])
  const [label, setLabel] = useState(""), [note, setNote] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!canAnnotate) return
    let live = true
    api.signalAnnotations(recordId).then(value => { if (live) setItems(value) }).catch(e => { if (live) setError(e instanceof Error ? e.message : "Annotations could not be loaded") })
    return () => { live = false }
  }, [recordId, canAnnotate])
  if (!canAnnotate) return <p className="text-sm text-muted-foreground">Educators can mark windows on this recording for teaching. Sign in as an educator in the Educator Studio to add annotations.</p>
  const save = async () => {
    setBusy(true); setError("")
    try {
      const created = await api.createSignalAnnotation(recordId, { channel, start_sec: start, end_sec: start + duration, label: label.trim(), note: note.trim() })
      setItems(current => [...current, created].sort((a, b) => a.start_sec - b.start_sec)); setLabel(""); setNote("")
    } catch (e) { setError(e instanceof Error ? e.message : "The annotation could not be saved") }
    finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    try { await api.deleteSignalAnnotation(id); setItems(current => current.filter(item => item.id !== id)) }
    catch (e) { setError(e instanceof Error ? e.message : "The annotation could not be removed") }
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Marks {channel} from {start.toFixed(3)} to {(start + duration).toFixed(3)} s. The annotation stores this recording's source hash and window bounds.</p>
      <Field className="grid gap-1"><FieldLabel htmlFor="annotation-label">Label</FieldLabel><Input id="annotation-label" value={label} maxLength={200} onChange={event => setLabel(event.target.value)} placeholder="For example: steady thrill pattern" /></Field>
      <Field className="grid gap-1"><FieldLabel htmlFor="annotation-note">Teaching note (optional)</FieldLabel><Textarea id="annotation-note" value={note} maxLength={2000} rows={3} onChange={event => setNote(event.target.value)} /></Field>
      <div><Button type="button" size="sm" disabled={busy || !label.trim()} onClick={() => void save()}>{busy ? "Saving..." : "Save annotation"}</Button></div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <ul className="grid gap-2">{items.map(item => <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-2.5"><div className="grid gap-0.5"><b>{item.label}</b><span className="text-xs text-muted-foreground">{item.channel} · {item.start_sec.toFixed(3)} to {item.end_sec.toFixed(3)} s · SHA-256 {item.source_sha256.slice(0, 12)}...</span>{item.note && <span className="text-sm">{item.note}</span>}</div><Button type="button" size="sm" variant="outline" aria-label={`Delete annotation ${item.label}`} onClick={() => void remove(item.id)}><Trash2 data-icon="inline-start" />Delete</Button></li>)}</ul>
      {!items.length && <p className="text-sm text-muted-foreground">No annotations on this recording yet.</p>}
    </div>
  )
}

export function SignalTools(props: Props) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardDescription>Teaching tools for the selected window</CardDescription>
        <CardTitle role="heading" aria-level={3}>Signal processing tools</CardTitle>
        <CardDescription>Filters, ECG beat analysis and window overlays describe measured source values. They are not diagnostic.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="filter" className="min-w-0 flex-col gap-3">
          <TabsList aria-label="Signal tools" className="flex-wrap"><TabsTrigger value="filter"><SlidersHorizontal data-icon="inline-start" />Filter</TabsTrigger><TabsTrigger value="beats"><HeartPulse data-icon="inline-start" />Beats</TabsTrigger><TabsTrigger value="overlay"><Layers data-icon="inline-start" />Overlay</TabsTrigger><TabsTrigger value="quality"><CheckCircle2 data-icon="inline-start" />Quality</TabsTrigger><TabsTrigger value="annotations"><StickyNote data-icon="inline-start" />Annotations</TabsTrigger></TabsList>
          <TabsContent value="filter"><FilterTab {...props} /></TabsContent>
          <TabsContent value="beats"><BeatsTab {...props} /></TabsContent>
          <TabsContent value="overlay"><OverlayTab {...props} /></TabsContent>
          <TabsContent value="quality"><QualityTab {...props} /></TabsContent>
          <TabsContent value="annotations"><AnnotationsTab {...props} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
