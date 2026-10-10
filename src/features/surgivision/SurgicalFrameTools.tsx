import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Columns2, Filter, X } from "lucide-react"
import { api, type SurgicalFrameBrowse, type SurgicalFrameFilters, type SurgicalFrameRecord } from "@/lib/api"
import { CVS_CRITERIA, describeAnnotatorMean } from "@/lib/cvs-self-check"
import { cvsVoteSummary, filtersFromSearch, filtersToSearch } from "@/lib/surgical-frame-filters"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const PAGE_SIZE = 25
const ANY = "any"
const VALUE_STEPS = [
  { value: "0", label: "0/3" }, { value: "0.3333333333", label: "1/3" },
  { value: "0.6666666667", label: "2/3" }, { value: "1", label: "3/3" },
]

function FilterSelect({ id, label, value, options, onChange }: { id: string; label: string; value: string | undefined; options: { value: string; label: string }[]; onChange: (value: string | undefined) => void }) {
  const items = [{ value: ANY, label: "Any" }, ...options]
  return (
    <Field className="grid gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={items} value={value ?? ANY} onValueChange={next => { if (typeof next === "string") onChange(next === ANY ? undefined : next) }}>
        <SelectTrigger id={id} size="sm" className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent><SelectGroup>{items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
    </Field>
  )
}

function FrameBrowser({ currentFrameId, filters, onFiltersChange, onCompare }: { currentFrameId: string; filters: SurgicalFrameFilters; onFiltersChange: (filters: SurgicalFrameFilters) => void; onCompare: (frameId: string) => void }) {
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<SurgicalFrameBrowse | null>(null)
  const [error, setError] = useState("")
  const filterKey = JSON.stringify(filters)
  useEffect(() => {
    let live = true
    setError("")
    api.surgicalFrames({ ...filters, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then(value => { if (live) setResult(value) })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : "Frames could not be filtered") })
    return () => { live = false }
    // filterKey captures every filter value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, page])
  const update = (next: SurgicalFrameFilters) => { setPage(0); onFiltersChange(next) }
  const pages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1

  return (
    <Card>
      <CardHeader>
        <CardDescription>Expert annotations only</CardDescription>
        <CardTitle role="heading" aria-level={3} className="flex items-center gap-2"><Filter aria-hidden />Find frames by annotation</CardTitle>
        <CardDescription>Filter the annotated keyframes by split, labelled structure or tool, CVS value and annotator agreement.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <FilterSelect id="frames-split" label="Split" value={filters.split} options={["train", "val", "test"].map(split => ({ value: split, label: `${split}${result ? ` (${result.facets.splits[split] ?? 0})` : ""}` }))} onChange={split => update({ ...filters, split: split as SurgicalFrameFilters["split"] })} />
          <FilterSelect id="frames-category" label="Labelled structure or tool" value={filters.category} options={(result?.facets.categories ?? []).map(name => ({ value: name, label: name }))} onChange={category => update({ ...filters, category })} />
          <FilterSelect id="frames-agreement" label="Annotator agreement" value={filters.agreement} options={[{ value: "disputed", label: "Annotators disagreed" }, { value: "unanimous", label: "Annotators agreed" }]} onChange={agreement => update({ ...filters, agreement: agreement as SurgicalFrameFilters["agreement"] })} />
          <FilterSelect id="frames-criterion" label="CVS criterion" value={filters.criterion} options={CVS_CRITERIA.map(item => ({ value: item.id, label: item.label }))} onChange={criterion => update({ ...filters, criterion: criterion as SurgicalFrameFilters["criterion"], ...(criterion ? {} : { min_value: undefined, max_value: undefined }) })} />
          {filters.criterion && <>
            <FilterSelect id="frames-min" label="At least" value={filters.min_value === undefined ? undefined : VALUE_STEPS.find(step => Math.abs(Number(step.value) - filters.min_value!) < 0.01)?.value} options={VALUE_STEPS} onChange={value => update({ ...filters, min_value: value === undefined ? undefined : Number(value) })} />
            <FilterSelect id="frames-max" label="At most" value={filters.max_value === undefined ? undefined : VALUE_STEPS.find(step => Math.abs(Number(step.value) - filters.max_value!) < 0.01)?.value} options={VALUE_STEPS} onChange={value => update({ ...filters, max_value: value === undefined ? undefined : Number(value) })} />
          </>}
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {result && <p className="text-sm text-muted-foreground" aria-live="polite">{result.total.toLocaleString()} matching {result.total === 1 ? "frame" : "frames"}</p>}
        {result && result.total === 0 && <p className="text-sm">No installed frame matches these filters.</p>}
        <ul className="grid gap-2">
          {result?.frames.map(frame => (
            <li key={frame.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
              <div className="grid min-w-0 gap-0.5">
                <Link className="font-medium text-primary hover:underline" to={`/studio/surgivision/cases/${encodeURIComponent(frame.id)}`} aria-current={frame.id === currentFrameId ? "page" : undefined}>{frame.split} · video {frame.video_id} · frame {frame.frame_number}</Link>
                <span className="text-xs text-muted-foreground">{cvsVoteSummary(frame.cvs_criteria)} · {frame.categories.length ? frame.categories.join(", ") : "no labelled regions"}</span>
              </div>
              <div className="flex items-center gap-2">
                {frame.agreement === "disputed" && <Badge variant="outline">Disagreement on {frame.disputed_criteria}</Badge>}
                <Button type="button" size="sm" variant="outline" disabled={frame.id === currentFrameId} onClick={() => onCompare(frame.id)}><Columns2 data-icon="inline-start" />Compare</Button>
              </div>
            </li>
          ))}
        </ul>
        {result && result.total > PAGE_SIZE && <div className="flex items-center justify-between gap-2 text-sm">
          <Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
          <Button type="button" size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>}
        {result && <ul className="list-disc pl-5 text-xs text-muted-foreground">{result.limitations.map(note => <li key={note}>{note}</li>)}</ul>}
      </CardContent>
    </Card>
  )
}

function ComparePane({ frameId, showBoxes }: { frameId: string; showBoxes: boolean }) {
  const [frame, setFrame] = useState<SurgicalFrameRecord | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let live = true
    let url: string | null = null
    setFrame(null); setImageUrl(null); setSize(null); setError("")
    Promise.all([api.surgicalFrame(frameId), api.surgicalImage(frameId)]).then(([record, objectUrl]) => {
      url = objectUrl
      if (live) { setFrame(record); setImageUrl(objectUrl) } else URL.revokeObjectURL(objectUrl)
    }).catch(e => { if (live) setError(e instanceof Error ? e.message : "This frame could not be loaded") })
    return () => { live = false; if (url) URL.revokeObjectURL(url) }
  }, [frameId])
  // Overlays use source-pixel coordinates, so they pause if the JPEG disagrees with its record.
  const dimensionsMatch = Boolean(frame && size && size.width === frame.width && size.height === frame.height)
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  if (!frame) return <p className="text-sm text-muted-foreground">Loading frame...</p>
  return (
    <figure className="m-0 grid min-w-0 gap-2">
      <div className="relative overflow-hidden rounded-lg border bg-muted">
        {imageUrl && <img className="block w-full" src={imageUrl} alt={`Endoscapes source image, ${frame.split} split, video ${frame.video_id}, frame ${frame.frame_number}`} onLoad={event => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />}
        {showBoxes && dimensionsMatch && <svg className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${frame.width} ${frame.height}`} preserveAspectRatio="none" role="img" aria-label={`${frame.annotations.length} expert annotation boxes`}>
          {frame.annotations.map(item => <g key={item.id}><rect x={item.bbox[0]} y={item.bbox[1]} width={item.bbox[2]} height={item.bbox[3]} fill="none" stroke="#f5b942" strokeWidth={3} /><text x={item.bbox[0] + 4} y={item.bbox[1] + 18} fill="#f5b942" fontSize={16} fontWeight={600}>{item.category_name}</text></g>)}
        </svg>}
      </div>
      {size && !dimensionsMatch && <Alert><AlertDescription>The JPEG is {size.width} × {size.height} pixels but its record says {frame.width} × {frame.height}. Overlays are paused for this frame.</AlertDescription></Alert>}
      <figcaption className="grid gap-1 text-sm">
        <b>{frame.split} · video {frame.video_id} · frame {frame.frame_number}</b>
        <ul className="grid gap-0.5 text-muted-foreground">{CVS_CRITERIA.map((criterion, index) => <li key={criterion.id}>{criterion.label}: {frame.cvs_criteria.length === 3 ? describeAnnotatorMean(frame.cvs_criteria[index]).toLowerCase() : "no label"}</li>)}</ul>
        <span className="text-xs text-muted-foreground">Image SHA-256 {frame.image_sha256.slice(0, 12)}...</span>
      </figcaption>
    </figure>
  )
}

function FrameCompare({ leftId, rightId, onClose }: { leftId: string; rightId: string; onClose: () => void }) {
  const [showBoxes, setShowBoxes] = useState(true)
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <div><CardDescription>Side-by-side expert annotations</CardDescription><CardTitle role="heading" aria-level={3} className="flex items-center gap-2"><Columns2 aria-hidden />Compare two frames</CardTitle></div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" aria-pressed={showBoxes} onClick={() => setShowBoxes(!showBoxes)}>{showBoxes ? "Hide boxes" : "Show boxes"}</Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose}><X data-icon="inline-start" />Close comparison</Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <ComparePane frameId={leftId} showBoxes={showBoxes} />
        <ComparePane frameId={rightId} showBoxes={showBoxes} />
        <p className="text-xs text-muted-foreground md:col-span-2">Both frames are independent Endoscapes stills with their own annotations. Segmentation masks are shown in the main viewer only.</p>
      </CardContent>
    </Card>
  )
}

export function SurgicalFrameTools({ currentFrameId }: { currentFrameId: string }) {
  const [search, setSearch] = useSearchParams()
  const filters = useMemo(() => filtersFromSearch(search), [search])
  const compareId = search.get("compare")
  const setCompare = (frameId: string | null) => {
    const next = new URLSearchParams(search)
    if (frameId) next.set("compare", frameId); else next.delete("compare")
    setSearch(next, { replace: true })
  }
  return (
    <div className="mt-3 grid gap-3">
      {compareId && compareId !== currentFrameId && <FrameCompare leftId={currentFrameId} rightId={compareId} onClose={() => setCompare(null)} />}
      <FrameBrowser currentFrameId={currentFrameId} filters={filters} onFiltersChange={next => setSearch(filtersToSearch(next, search), { replace: true })} onCompare={setCompare} />
    </div>
  )
}
