import '@kitware/vtk.js/Rendering/Profiles/Geometry'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor'
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData'
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow'
import { AlertCircle, Box, Eye, EyeOff, LoaderCircle, RotateCcw } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DOSE_ROIS } from '@/lib/workspace-preferences'
import { buildRoiImage, meshStats } from './roi-surface-geometry'

const palette: Record<string, [number, number, number]> = {
  Brainstem:[255,205,86],SpinalCord:[95,211,195],RightParotid:[248,133,123],LeftParotid:[155,140,255],
  Esophagus:[255,161,92],Larynx:[113,184,255],Mandible:[229,121,187],PTV56:[227,231,111],PTV63:[249,178,92],PTV70:[245,120,100],
}

export function DoseTwinSurfaceViewer({caseId,selectedRoi,onRoiChange}:{caseId:string;selectedRoi:string;onRoiChange:(roi:string)=>void}) {
  const host=useRef<HTMLDivElement>(null)
  const actorRef=useRef<ReturnType<typeof vtkActor.newInstance>|null>(null)
  const viewRef=useRef<ReturnType<typeof vtkGenericRenderWindow.newInstance>|null>(null)
  const [visible,setVisible]=useState(true)
  const [opacity,setOpacity]=useState(.82)
  const [smallViewport,setSmallViewport]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 480px)').matches)
  const surfaceState=useRef({visible,opacity})
  const [stats,setStats]=useState<{points:number;triangles:number;bounds:number[]}|null>(null)
  const [error,setError]=useState('')
  const query=useQuery({queryKey:['dosetwin','roi-volume',caseId,selectedRoi],queryFn:()=>api.roiVolume(caseId,selectedRoi),retry:false,staleTime:Infinity})
  const payload=query.data
  const color=useMemo(()=>palette[selectedRoi]??[130,190,220],[selectedRoi])

  useEffect(()=>{
    const query=window.matchMedia('(max-width: 480px)')
    const update=()=>setSmallViewport(query.matches)
    update();query.addEventListener('change',update)
    return ()=>query.removeEventListener('change',update)
  },[])

  useEffect(()=>{
    const container=host.current
    if(!container||!payload)return
    if(smallViewport){
      setError('3D rendering is paused on this narrow screen to protect device memory. The linked 2D planes remain available above.')
      return
    }
    let window3d: ReturnType<typeof vtkGenericRenderWindow.newInstance>|null=null
    let actor: ReturnType<typeof vtkActor.newInstance>|null=null
    let mapping: ReturnType<typeof meshStats>['mesh']|null=null
    let marching: ReturnType<typeof meshStats>['marching']|null=null
    let image: ReturnType<typeof vtkImageData.newInstance>|null=null
    let disposed=false
    setError('');setStats(null)
    try {
      const built=buildRoiImage(payload);image=built.image
      const result=meshStats(image);marching=result.marching;mapping=result.mesh
      if(result.points<1||result.triangles<1)throw new Error('No closed surface was produced for this source structure mask.')
      if(disposed)return
      setStats({points:result.points,triangles:result.triangles,bounds:result.bounds})
      window3d=vtkGenericRenderWindow.newInstance({background:[0.063,0.086,0.137],listenWindowResize:true})
      window3d.setContainer(container)
      const renderer=window3d.getRenderer()
      renderer.setBackground(0.063,0.086,0.137)
      actor=vtkActor.newInstance()
      actorRef.current=actor
      viewRef.current=window3d
      actor.setMapper(mapping)
      actor.getProperty().setColor(color.map(value=>value/255) as [number,number,number])
      actor.getProperty().setOpacity(surfaceState.current.visible?surfaceState.current.opacity:0)
      actor.getProperty().setAmbient(.24)
      actor.getProperty().setDiffuse(.76)
      renderer.addActor(actor)
      renderer.resetCamera()
      window3d.resize()
      window3d.getRenderWindow().render()
      const view=window3d
      const resizeObserver=new ResizeObserver(()=>{view.resize();view.getRenderWindow().render()})
      resizeObserver.observe(container)
      container.dataset.vtkReady='true'
      // Disconnect the observer before the render window releases its WebGL context.
      container.addEventListener('medforge-vtk-dispose',()=>resizeObserver.disconnect(),{once:true})
    } catch (cause) {
      setError(cause instanceof Error?cause.message:'The local graphics device could not render this surface.')
    }
    return ()=>{
      disposed=true
      container.dispatchEvent(new Event('medforge-vtk-dispose'))
      delete container.dataset.vtkReady
      if(actor&&window3d)window3d.getRenderer().removeActor(actor)
      if(actorRef.current===actor)actorRef.current=null
      if(viewRef.current===window3d)viewRef.current=null
      actor?.delete();mapping?.delete();marching?.delete();image?.delete();window3d?.delete()
    }
  },[payload,color,smallViewport])

  useEffect(()=>{
    surfaceState.current={visible,opacity}
    const actor=actorRef.current,view=viewRef.current
    if(!actor||!view)return
    actor.getProperty().setOpacity(visible?opacity:0)
    view.getRenderWindow().render()
  },[visible,opacity])

  const resetCamera=()=>{viewRef.current?.getRenderer().resetCamera();viewRef.current?.getRenderWindow().render()}

  if(query.isError)return <Card className="border-amber-300 bg-amber-50 text-amber-950"><CardContent className="flex items-start gap-2 p-4 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0"/><div><b>3D structure source unavailable</b><p className="mb-0 mt-1">{query.error.message} · Continue with the validated linked 2D planes.</p></div></CardContent></Card>

  return <Card className="overflow-hidden border-border bg-card shadow-none" aria-label="DoseTwin 3D structure surface">
    <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 border-b border-border/70">
      <div><CardTitle className="flex items-center gap-2 text-base"><Box className="size-4 text-primary"/>3D structure surface</CardTitle><CardDescription className="mt-1">Reconstructed from the selected verified OpenKBP voxel mask · orbit, pan, and zoom with pointer or trackpad.</CardDescription></div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="dosetwin-3d-structure">Structure to reconstruct</label>
        <select id="dosetwin-3d-structure" value={selectedRoi} onChange={event=>onRoiChange(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{DOSE_ROIS.map(roi=><option key={roi} value={roi}>{roi}</option>)}</select>
        <Button type="button" variant="outline" size="sm" aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?<Eye/>:<EyeOff/>}{visible?'Visible':'Hidden'}</Button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Surface opacity <input aria-label="3D surface opacity" type="range" min="0.2" max="1" step="0.05" value={opacity} onChange={event=>setOpacity(Number(event.target.value))}/></label>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Reset 3D camera" onClick={resetCamera}><RotateCcw/></Button>
      </div>
    </CardHeader>
    <CardContent className="grid gap-3 p-3">
      <div ref={host} data-testid="dosetwin-3d-viewport" className="relative h-[min(55vh,480px)] min-h-[300px] overflow-hidden rounded-lg border border-[#304156] bg-[#101624]" aria-label={`${selectedRoi} reconstructed 3D surface viewport`}>
        {(query.isPending||(!stats&&!error))&&<div className="absolute inset-0 z-10 grid place-content-center gap-2 text-center text-sm text-slate-200"><LoaderCircle className="mx-auto size-5 animate-spin"/>Building a surface from {query.data?.voxel_count.toLocaleString()??'verified'} source voxels…</div>}
        {error&&<div role="status" className="absolute inset-0 z-10 grid place-content-center gap-2 bg-[#101624] px-6 text-center text-sm text-amber-100"><AlertCircle className="mx-auto size-5"/>{error}<span>Use the linked 2D planes to inspect this structure.</span></div>}
        {query.isPending&&<div className="sr-only" role="status">Loading verified structure mask</div>}
      </div>
      {query.data&&stats&&<div className="grid gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs sm:grid-cols-3"><p className="m-0"><b>{query.data.voxel_count.toLocaleString()}</b> source mask voxels · {stats.points.toLocaleString()} surface points</p><p className="m-0 font-mono text-muted-foreground">Spacing {query.data.spacing_mm.map(value=>value.toFixed(3)).join(' × ')} mm</p><p className="m-0 font-mono text-muted-foreground">{query.data.source_file} · revision {query.data.source_revision.slice(0,12)}</p><p className="m-0 truncate font-mono text-muted-foreground" title={query.data.source_sha256}>Mask SHA-256 {query.data.source_sha256.slice(0,16)}…</p><p className="m-0 sm:col-span-3 text-muted-foreground">Processed-index coordinates with approximate benchmark spacing; no patient orientation or DICOM frame is asserted. Surface follows the source voxel grid and its limited resolution.</p><p className="m-0 font-mono text-muted-foreground sm:col-span-3" data-testid="dosetwin-3d-bounds">Mesh bounds (approx. mm): {stats.bounds.map(value=>value.toFixed(2)).join(', ')} · {stats.triangles.toLocaleString()} triangles</p></div>}
      {error&&<div className="flex items-center justify-between gap-3 text-sm text-amber-900"><span>WebGL may be unavailable or the mesh could not be built.</span><Button variant="outline" size="sm" onClick={()=>void query.refetch()}>Try again</Button></div>}
      {!stats&&<p className="m-0 flex items-center gap-2 text-xs leading-relaxed text-muted-foreground"><AlertCircle className="size-4 shrink-0"/>If WebGL fails or device memory is limited, the validated 2D viewer remains available above.</p>}
    </CardContent>
  </Card>
}
