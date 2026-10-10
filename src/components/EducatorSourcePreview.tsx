import { useEffect, useRef, useState } from "react";
import { CircleAlert, Database, LoaderCircle, ShieldCheck } from "lucide-react";
import type { CaseRecord } from "@/lib/api";
import { api } from "@/lib/api";
import { renderDoseSlicePixels } from "@/lib/dose-visualization";
import { getEducatorSourcePreviewAccess } from "@/lib/educator-source-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type EducatorEvidenceItem = Awaited<ReturnType<typeof api.educatorEvidence>>[number];
type Props = { source: CaseRecord | null; evidence: EducatorEvidenceItem | null; evidenceError: string };
type PreviewData =
  | { kind: "dose"; caseId: string; ct: number[]; dose: number[]; ctHash: string; doseHash: string; revision: string }
  | { kind: "surgery"; caseId: string; imageUrl: string; width: number; height: number; imageHash: string; annotationHash: string }
  | { kind: "signal"; caseId: string; recordId: string; channel: string; unit: string; start: number; end: number; samples: { time_sec: number; value: number }[]; sourceHash: string };

function SourceGraphic({ data }: { data: PreviewData }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (data.kind !== "dose" || !canvas.current) return;
    const context = canvas.current.getContext("2d");
    if (!context) return;
    const pixels = renderDoseSlicePixels(data.ct, data.dose, new Uint8Array(128 * 128), { showDose: true, showRoi: false, opacity: 0.58 });
    const image = context.createImageData(128, 128);
    image.data.set(pixels);
    context.putImageData(image, 0, 0);
  }, [data]);

  if (data.kind === "dose") {
    return <div className="grid min-h-44 place-items-center rounded-lg border border-border bg-[#101624] p-3">
      <canvas ref={canvas} width={128} height={128} role="img" aria-label="Installed OpenKBP CT and reference dose slice, Z index 64" className="h-40 w-40 max-w-full [image-rendering:pixelated]" />
    </div>;
  }
  if (data.kind === "surgery") {
    return <div className="grid min-h-44 place-items-center overflow-hidden rounded-lg border border-border bg-[#101624] p-2">
      <img src={data.imageUrl} width={data.width} height={data.height} alt={`Installed Endoscapes source frame ${data.caseId}`} className="max-h-56 max-w-full object-contain" />
    </div>;
  }
  const values = data.samples.map(({ value }) => value);
  const min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, Number.EPSILON);
  const points = data.samples.map((sample, index) => `${(index / Math.max(1, data.samples.length - 1)) * 640},${110 - ((sample.value - min) / span) * 100}`).join(" ");
  return <div className="rounded-lg border border-border bg-[#101624] p-3">
    <svg viewBox="0 0 640 120" role="img" aria-label={`${data.recordId} measured ${data.channel} waveform, ${data.start.toFixed(2)} to ${data.end.toFixed(2)} seconds`} className="h-36 w-full">
      <path d="M0 110H640" stroke="#405667" strokeWidth="1" />
      <polyline points={points} fill="none" stroke="#57d1bd" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  </div>;
}

function Provenance({ data }: { data: PreviewData }) {
  const hashes = data.kind === "dose" ? [["CT", data.ctHash], ["Dose", data.doseHash]] as const
    : data.kind === "surgery" ? [["Image", data.imageHash], ["Annotation", data.annotationHash]] as const
      : [["Source", data.sourceHash]] as const;
  return <div className="grid gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
    {data.kind === "dose" ? <span>OpenKBP reference · processed-grid slice Z 64 · revision <code className="break-all">{data.revision}</code></span>
      : data.kind === "surgery" ? <span>Endoscapes annotated still · source frame <code>{data.caseId}</code></span>
        : <span>FiSaV measured recording · {data.recordId} · {data.channel} · uncalibrated {data.unit}</span>}
    <div className="grid gap-1 font-mono text-[10px]">{hashes.map(([label, hash]) => <span key={label} className="break-all">{label} SHA-256 · {hash}</span>)}</div>
  </div>;
}

export function EducatorSourcePreview({ source, evidence, evidenceError }: Props) {
  const access = getEducatorSourcePreviewAccess(source, evidence);
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setData(null);
    setError("");
    if (!source || access.state !== "ready") { setLoading(false); return; }
    let live = true;
    let imageUrl = "";
    setLoading(true);
    const load = async () => {
      if (source.module === "dosetwin") {
        const [ct, dose] = await Promise.all([
          api.slice(source.id, 2, 64, "ct", "Brainstem"),
          api.slice(source.id, 2, 64, "dose", "Brainstem"),
        ]);
        if (ct.case_id !== source.id || dose.case_id !== source.id) throw new Error("The returned slice does not match the selected source case.");
        if (ct.source_kind !== source.reference_kind || dose.source_kind !== source.reference_kind || ct.origin === "synthetic-test-fixture" || dose.origin === "synthetic-test-fixture") throw new Error("The returned arrays do not match this verified source type.");
        if (ct.source_revision !== dose.source_revision) throw new Error("The CT and dose arrays have different source revisions.");
        return { kind: "dose" as const, caseId: source.id, ct: ct.values, dose: dose.values, ctHash: ct.source_sha256, doseHash: dose.source_sha256, revision: ct.source_revision };
      }
      if (source.module === "surgivision") {
        const frame = await api.surgicalFrame(source.id);
        if (frame.id !== source.id || frame.dataset_id !== source.dataset_id) throw new Error("The returned frame does not match the selected source case.");
        imageUrl = await api.surgicalImage(source.id);
        return { kind: "surgery" as const, caseId: source.id, imageUrl, width: frame.width, height: frame.height, imageHash: frame.image_sha256, annotationHash: frame.annotation_sha256 };
      }
      const record = await api.signalRecord(source.source_case_id);
      if (record.case_id !== source.id || record.source_case_id !== source.source_case_id || record.dataset_id !== source.dataset_id) throw new Error("The returned recording does not match the selected source case.");
      const channel = record.channels[0];
      if (!channel) throw new Error("The selected recording has no available signal channel.");
      const trace = await api.signalWindow(record.id, channel, 0, Math.min(5, record.duration_sec));
      if (trace.case_id !== source.id || trace.source_sha256 !== record.source_sha256) throw new Error("The returned waveform provenance does not match the selected source recording.");
      return { kind: "signal" as const, caseId: source.id, recordId: record.source_case_id, channel, unit: trace.channel_unit, start: trace.start_sec, end: trace.start_sec + trace.duration_sec, samples: trace.samples, sourceHash: trace.source_sha256 };
    };
    load().then(value => { if (live) setData(value); else if (value.kind === "surgery") URL.revokeObjectURL(value.imageUrl); })
      .catch(reason => { if (live) setError(reason instanceof Error ? reason.message : "Installed source preview could not load."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [source, access.state]);

  const sourceMatches = data !== null && source?.id === data.caseId;
  return <Card size="sm" aria-label="Selected scientific source preview">
    <CardHeader className="gap-1 pb-3">
      <div className="flex items-start justify-between gap-2">
        <div><CardTitle className="flex items-center gap-2 text-sm"><Database className="size-4 text-primary" />Selected source</CardTitle>
          <CardDescription className="mt-1">A read-only view of installed scientific evidence.</CardDescription></div>
        {evidence?.publication_review === "blocked" && <Badge variant="destructive">Publication blocked</Badge>}
      </div>
    </CardHeader>
    <CardContent className="grid gap-3">
      {source && <div className="grid gap-0.5 text-xs"><b className="text-foreground">{source.label}</b><span className="text-muted-foreground">{source.dataset_id} · {source.source_case_id} · {source.reference_kind}</span>
        <span className="text-muted-foreground">License: {evidence?.license_label ?? evidenceError ?? "Unavailable"}</span></div>}
      {access.state !== "ready" && <p className="m-0 text-xs leading-relaxed text-muted-foreground">{access.message}</p>}
      {access.state === "ready" && loading && <div role="status" className="flex min-h-28 items-center justify-center gap-2 rounded-lg border border-border text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading installed source…</div>}
      {access.state === "ready" && error && <Alert variant="destructive"><CircleAlert /><AlertTitle>Source preview unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {sourceMatches && data && <>
        <SourceGraphic data={data} />
        <Provenance data={data} />
      </>}
      {access.state === "ready" && evidence?.publication_review !== "blocked" && <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />Preview only. Confirm license conditions before publishing to learners.</div>}
    </CardContent>
  </Card>;
}
