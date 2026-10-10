import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Layer = 'ct' | 'dose' | 'roi'
type Index = [number, number, number]
type VolumeHeaders = { sha256: string; revision: string; spacing: [number, number, number] }
type CsViewport = { canvasToWorld: (point: [number, number]) => [number, number, number]; setProperties: (p: { voiRange: { lower: number; upper: number } }) => void; jumpToWorld: (point: [number, number, number]) => boolean }

const CASE_ID = 'openkbp:pt_201'
const ORIENTATION = [
  { id: 'xy', label: 'X–Y index plane', axis: 2, orientation: 'AXIAL' },
  { id: 'xz', label: 'X–Z index plane', axis: 1, orientation: 'CORONAL' },
  { id: 'yz', label: 'Y–Z index plane', axis: 0, orientation: 'SAGITTAL' },
] as const

let initialize: Promise<void> | undefined
let initializeTools: Promise<typeof import('@cornerstonejs/tools')> | undefined
function initCornerstone() {
  initialize ??= import('@cornerstonejs/core').then(async ({ init }) => { await init() })
  return initialize
}
function initTools() {
  initializeTools ??= import('@cornerstonejs/tools').then(async tools => { await tools.init(); return tools })
  return initializeTools
}

async function fetchLayer(layer: Layer): Promise<{ values: Float32Array; headers: VolumeHeaders }> {
  const response = await fetch(`/api/v1/cases/${encodeURIComponent(CASE_ID)}/viewer/cornerstone-volume?layer=${layer}&roi=Brainstem`)
  if (!response.ok) throw new Error(`Could not load the verified ${layer} source volume (${response.status}).`)
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength !== 128 * 128 * 128 * Float32Array.BYTES_PER_ELEMENT) throw new Error(`${layer} volume has an unexpected byte length.`)
  const spacingHeader = response.headers.get('X-Voxel-Spacing-Mm')?.split(',').map(Number) ?? []
  const sha256 = response.headers.get('X-Source-SHA256') ?? ''
  const revision = response.headers.get('X-Source-Revision') ?? ''
  if (spacingHeader.length !== 3 || !spacingHeader.every(value => Number.isFinite(value) && value > 0) || !/^[a-f0-9]{64}$/i.test(sha256)) throw new Error(`${layer} source metadata failed validation.`)
  return { values: new Float32Array(buffer), headers: { sha256, revision, spacing: spacingHeader as VolumeHeaders['spacing'] } }
}

export function CornerstoneTrial() {
  const hostRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const engineRef = useRef<import('@cornerstonejs/core').RenderingEngine | null>(null)
  const resourceRef = useRef<{ volumeId: string; labelmapVolumeId: string; segmentationId: string } | null>(null)
  const dataRef = useRef<{ ct: Float32Array; dose: Float32Array; roi: Float32Array } | null>(null)
  const [status, setStatus] = useState('Loading verified OpenKBP arrays…')
  const [index, setIndex] = useState<Index>([64, 64, 64])
  const [headers, setHeaders] = useState<VolumeHeaders | null>(null)
  const [sampleValues, setSampleValues] = useState<{ ct: number; dose: number; roi: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let resizeObserver: ResizeObserver | undefined
    const engineId = `cornerstone-one-case-${Date.now()}`
    const volumeId = `local-openkbp-pt201-ct-${Date.now()}`
    const segmentationId = `openkbp-pt201-brainstem-${Date.now()}`
    const labelmapVolumeId = `${segmentationId}-labelmap`
    resourceRef.current = { volumeId, labelmapVolumeId, segmentationId }
    void (async () => {
      try {
        await initCornerstone()
        const [ct, dose, roi] = await Promise.all([fetchLayer('ct'), fetchLayer('dose'), fetchLayer('roi')])
        if (cancelled) return
        if (ct.headers.spacing.join(',') !== dose.headers.spacing.join(',') || ct.headers.spacing.join(',') !== roi.headers.spacing.join(',')) throw new Error('CT, dose and ROI source spacing do not match.')
        const core = await import('@cornerstonejs/core')
        const tools = await initTools()
        const engine = new core.RenderingEngine(engineId)
        engineRef.current = engine
        const viewports = ORIENTATION.map(plane => ({
          viewportId: `cs-${plane.id}`,
          type: core.Enums.ViewportType.ORTHOGRAPHIC,
          element: hostRefs.current[plane.id]!,
          defaultOptions: { orientation: core.Enums.OrientationAxis[plane.orientation], background: [0.04, 0.06, 0.1] as [number, number, number] },
        }))
        engine.setViewports(viewports)
        const volume = core.volumeLoader.createLocalVolume(volumeId, {
          dimensions: [128, 128, 128], spacing: ct.headers.spacing, origin: [0, 0, 0],
          direction: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          // Core's declared metadata shape is DICOM-only; this processed array has no DICOM metadata.
          metadata: {} as never,
          scalarData: ct.values,
        })
        await volume.load()
        await core.setVolumesForViewports(engine, [{ volumeId }], ORIENTATION.map(plane => `cs-${plane.id}`))
        const labelmapValues = Uint8Array.from(roi.values, value => value > 0 ? 1 : 0)
        const labelmapVolume = core.volumeLoader.createLocalVolume(labelmapVolumeId, {
          dimensions: [128, 128, 128], spacing: ct.headers.spacing, origin: [0, 0, 0],
          direction: [1, 0, 0, 0, 1, 0, 0, 0, 1], metadata: {} as never, scalarData: labelmapValues,
        })
        await labelmapVolume.load()
        tools.segmentation.addSegmentations([{
          segmentationId,
          representation: { type: tools.Enums.SegmentationRepresentations.Labelmap, data: { volumeId: labelmapVolumeId } },
          config: { label: 'Brainstem source mask', segments: { 1: { segmentIndex: 1, label: 'Brainstem', locked: true, cachedStats: {}, active: false } } },
        }])
        for (const plane of ORIENTATION) {
          const viewportId = `cs-${plane.id}`
          tools.segmentation.addSegmentationRepresentations(viewportId, [{ segmentationId, type: tools.Enums.SegmentationRepresentations.Labelmap }])
          tools.segmentation.config.color.setSegmentIndexColor(viewportId, segmentationId, 1, [255, 205, 86, 255])
          tools.segmentation.config.style.setStyle({ viewportId, segmentationId, segmentIndex: 1, type: tools.Enums.SegmentationRepresentations.Labelmap }, { renderOutline: true, outlineWidth: 2, outlineOpacity: 1, renderFill: true, fillAlpha: 0.12 })
        }
        const dvhResponse = await fetch(`/api/v1/cases/${encodeURIComponent(CASE_ID)}/viewer/dvh?roi=Brainstem`)
        if (!dvhResponse.ok) throw new Error('The reference DoseTwin display range could not be loaded.')
        const dvh = await dvhResponse.json() as { ct_display_range: [number, number] }
        const [low, high] = dvh.ct_display_range
        for (const plane of ORIENTATION) {
          const viewport = engine.getViewport(`cs-${plane.id}`) as CsViewport
          viewport.setProperties({ voiRange: { lower: low, upper: Math.max(high, low + 1) } })
        }
        engine.render()
        resizeObserver = new ResizeObserver(() => engine.resize(true, true))
        for (const plane of ORIENTATION) if (hostRefs.current[plane.id]) resizeObserver.observe(hostRefs.current[plane.id]!)
        setHeaders(ct.headers)
        dataRef.current = { ct: ct.values, dose: dose.values, roi: roi.values }
        const voxelOffset = (x: number, y: number, z: number) => x + y * 128 + z * 128 * 128
        const offset = voxelOffset(64, 64, 64)
        setSampleValues({ ct: ct.values[offset], dose: dose.values[offset], roi: roi.values[offset] > 0 })
        setStatus('Cornerstone3D rendered the verified 128³ CT volume. Dose and mask values loaded for parity checks.')
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Cornerstone3D could not render this source volume.')
      }
    })()
    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      engineRef.current?.destroy()
      engineRef.current = null
      const resources = resourceRef.current
      resourceRef.current = null
      dataRef.current = null
      if (resources) {
        void import('@cornerstonejs/core').then(core => {
          core.cache.removeVolumeLoadObject(resources.volumeId)
          core.cache.removeVolumeLoadObject(resources.labelmapVolumeId)
        })
        void initTools().then(tools => tools.segmentation.removeSegmentation(resources.segmentationId))
      }
    }
  }, [])

  const handleViewportClick = (planeId: string, event: React.MouseEvent<HTMLDivElement>) => {
    const engine = engineRef.current
    const host = hostRefs.current[planeId]
    if (!engine || !host || !headers) return
    const viewport = engine.getViewport(`cs-${planeId}`) as CsViewport
    const bounds = host.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const world = viewport.canvasToWorld([(event.clientX - bounds.left) * dpr, (event.clientY - bounds.top) * dpr])
    const next: Index = [0, 1, 2].map(axis => Math.max(0, Math.min(127, Math.round(world[axis] / headers.spacing[axis])))) as Index
    setIndex(next)
    for (const plane of ORIENTATION) (engine.getViewport(`cs-${plane.id}`) as CsViewport).jumpToWorld(world)
    const values = dataRef.current
    if (values) {
      const offset = next[0] + next[1] * 128 + next[2] * 128 * 128
      setSampleValues({ ct: values.ct[offset], dose: values.dose[offset], roi: values.roi[offset] > 0 })
      engine.render()
    }
  }

  return <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 sm:p-6" data-testid="cornerstone-trial">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="m-0 text-sm font-medium text-muted-foreground">DoseTwin · renderer trial</p><h1 className="mb-1 mt-1 text-2xl font-semibold">Cornerstone3D on OpenKBP pt_201</h1><p className="m-0 max-w-3xl text-sm text-muted-foreground">Three processed index planes from the installed source arrays. Spacing is preserved; native DICOM origin and orientation are unavailable.</p></div>
      <Badge variant="outline">Review only · not in the product navigation</Badge>
    </div>
    {error ? <Card><CardContent className="p-5 text-destructive" role="alert">{error}</CardContent></Card> : <>
      <Card className="overflow-hidden border-border bg-[#101624] text-white">
        <CardHeader className="border-b border-white/10 px-4 py-3"><CardTitle className="text-sm font-medium">OpenKBP processed CT · benchmark values, not HU</CardTitle></CardHeader>
        <CardContent className="grid gap-1 p-1 md:grid-cols-3">
          {ORIENTATION.map(plane => <section key={plane.id} className="min-w-0 overflow-hidden rounded-md bg-[#101624]" aria-label={plane.label}>
            <div className="flex items-center justify-between px-3 py-2 text-xs text-white/80"><span>{plane.label}</span><span>Index {index[plane.axis]}</span></div>
            <div ref={element => { hostRefs.current[plane.id] = element }} onClick={event => handleViewportClick(plane.id, event)} className="h-[36vh] min-h-52 cursor-crosshair touch-none bg-[#101624]" data-testid={`cornerstone-${plane.id}`} role="img" aria-label={`Cornerstone3D ${plane.label} volume view; click to inspect an index voxel`} />
          </section>)}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card><CardHeader><CardTitle className="text-base">Source parity probe</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <p className="m-0 text-muted-foreground">{status}</p>
          <div className="grid grid-cols-3 gap-2">{index.map((value, axis) => <div key={axis} className="rounded-md border border-border p-3"><span className="block text-xs text-muted-foreground">{['X','Y','Z'][axis]} index</span><strong data-testid={`cornerstone-index-${['x','y','z'][axis]}`}>{value}</strong></div>)}</div>
          <p className="m-0">CT source value <strong data-testid="cornerstone-ct-value">{sampleValues?.ct.toPrecision(6) ?? '—'}</strong> · dose <strong data-testid="cornerstone-dose-value">{sampleValues?.dose.toPrecision(6) ?? '—'}</strong> Gy · Brainstem mask <strong data-testid="cornerstone-roi-value">{sampleValues ? sampleValues.roi ? 'inside' : 'outside' : '—'}</strong></p>
          <p className="m-0 break-all text-xs text-muted-foreground">CT SHA-256: {headers?.sha256 ?? 'verifying…'}<br/>Source revision: {headers?.revision ?? 'verifying…'}</p>
          <Button variant="outline" size="sm" onClick={() => { const engine = engineRef.current; engine?.resize(true, true); engine?.render() }}>Reset viewport sizing</Button>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Interpretation limits</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p className="m-0">OpenKBP values are reshaped into Cornerstone storage order without changing the displayed X/Y/Z source index identity.</p><p className="m-0">The identity display basis is only a processed-array convention. No patient direction, left/right or clinical plane name is asserted.</p><p className="m-0">The existing DoseTwin canvas remains the source reference. This route is available only when the local spike flag is enabled.</p></CardContent></Card>
      </div>
    </>}
  </main>
}
