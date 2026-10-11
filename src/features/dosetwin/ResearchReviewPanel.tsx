import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ClipboardCheck, Crosshair, Download, History, ShieldAlert } from "lucide-react"
import { api, type AuditVerification, type ResearchReview, type ResearchReviewCreate, type ResearchReviewDecision, type VoxelDifference } from "@/lib/api"
import { useSession } from "@/lib/session"
import { ProvenanceBadge } from "@/components/ProvenanceBadge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Props = { caseId: string; artifactId: string; roi: string; axis: 0 | 1 | 2; index: number; onReopen?: (review: ResearchReview) => void }

const DECISIONS: { value: ResearchReviewDecision; label: string }[] = [
  { value: "accept_for_further_expert_assessment", label: "Accept for further expert assessment" },
  { value: "request_revision", label: "Request revision" },
  { value: "reject_research_candidate", label: "Reject research candidate" },
]
const BOUNDARY = "For further expert review, not for patient treatment."

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }))
  const link = Object.assign(document.createElement("a"), { href: url, download: name })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function voxelFor(axis: 0 | 1 | 2, index: number, a: number, b: number): [number, number, number] {
  return axis === 0 ? [index, a, b] : axis === 1 ? [a, index, b] : [a, b, index]
}

export function ResearchReviewPanel({ caseId, artifactId, roi, axis, index, onReopen }: Props) {
  const { user, requestResearchSignIn } = useSession()
  const canReview = user?.role === "clinical_reviewer" || user?.role === "admin"
  const queryClient = useQueryClient()
  const [a, setA] = useState(64), [b, setB] = useState(64)
  const [voxel, setVoxel] = useState<VoxelDifference | null>(null)
  const [decision, setDecision] = useState<ResearchReviewDecision | null>(null)
  const [rationale, setRationale] = useState("")
  const [supersedes, setSupersedes] = useState<ResearchReview | null>(null)
  const [saved, setSaved] = useState<ResearchReview | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [audit, setAudit] = useState<AuditVerification | null>(null)
  const history = useQuery({ queryKey: ["researchReviews", caseId, artifactId, user?.id ?? "anonymous"], queryFn: () => api.researchReviews(caseId, artifactId), enabled: canReview, retry: false })
  const ready = decision !== null && rationale.trim().length >= 10 && !busy

  const inspect = async () => {
    setError("")
    try { setVoxel(await api.doseVoxel(caseId, artifactId, voxelFor(axis, index, a, b))) }
    catch (e) { setError(e instanceof Error ? e.message : "The voxel could not be inspected") }
  }
  const record = async () => {
    if (!decision) return
    setBusy(true); setError("")
    try {
      const review = await api.createResearchReview({ case_id: caseId, artifact_id: artifactId, roi: roi as ResearchReviewCreate["roi"],
        decision, rationale: rationale.trim(), axis, index, voxel: voxel?.voxel ?? null, supersedes_id: supersedes?.id ?? null })
      setSaved(review); setDecision(null); setRationale(""); setSupersedes(null)
      await queryClient.invalidateQueries({ queryKey: ["researchReviews", caseId, artifactId] })
    } catch (e) { setError(e instanceof Error ? e.message : "The research review could not be recorded") }
    finally { setBusy(false) }
  }
  const verifyAudit = async () => {
    setError("")
    try { setAudit(await api.auditVerify()) }
    catch (e) { setError(e instanceof Error ? e.message : "The audit log could not be verified") }
  }
  const exportDocument = async (review: ResearchReview, format: "export" | "fhir") => {
    try { download(`${review.id}-${format === "fhir" ? "fhir-r4" : "report"}.json`, await api.researchReviewDocument(review.id, format)) }
    catch (e) { setError(e instanceof Error ? e.message : "The export failed") }
  }

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="gap-2">
        <CardDescription>Research review · operator-designated reviewer (qualification not verified)</CardDescription>
        <CardTitle role="heading" aria-level={3} className="flex items-center gap-2"><ClipboardCheck aria-hidden />Review this archived prediction</CardTitle>
        <ProvenanceBadge kind="ARCHIVED_PREDICTION" />
        <Alert><ShieldAlert /><AlertTitle>{BOUNDARY}</AlertTitle><AlertDescription>A research decision on a benchmark comparison is not approval to deliver radiotherapy.</AlertDescription></Alert>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!canReview ? <div className="grid gap-3"><Alert><ShieldAlert /><AlertTitle>Dedicated review access required</AlertTitle><AlertDescription>Only a locally designated Clinical Reviewer or admin account can inspect and record this research decision. This designation does not verify medical credentials or authorize patient care.</AlertDescription></Alert><Button type="button" variant="outline" className="w-fit" onClick={() => void requestResearchSignIn("dose_review")}>Sign in to review</Button></div> : <>
        <section className="grid gap-2" aria-label="Difference inspector">
          <h4 className="m-0 flex items-center gap-2 text-sm font-semibold"><Crosshair aria-hidden className="size-4" />Difference inspector</h4>
          <div className="flex flex-wrap items-end gap-2">
            <Field className="grid gap-1"><FieldLabel htmlFor="voxel-a">{axis === 0 ? "Y" : "X"} index</FieldLabel><Input id="voxel-a" type="number" min={0} max={127} value={a} onChange={event => setA(Number(event.target.value))} className="w-24 font-mono" /></Field>
            <Field className="grid gap-1"><FieldLabel htmlFor="voxel-b">{axis === 2 ? "Y" : "Z"} index</FieldLabel><Input id="voxel-b" type="number" min={0} max={127} value={b} onChange={event => setB(Number(event.target.value))} className="w-24 font-mono" /></Field>
            <span className="pb-2 text-xs text-muted-foreground">{["X", "Y", "Z"][axis]} fixed at slice {index}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void inspect()}>Inspect voxel</Button>
          </div>
          {voxel && <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4" aria-live="polite">
            <div><dt className="text-xs text-muted-foreground">Reference</dt><dd className="m-0 font-mono">{voxel.reference_gy.toFixed(3)} Gy</dd></div>
            <div><dt className="text-xs text-muted-foreground">Archived prediction</dt><dd className="m-0 font-mono">{voxel.prediction_gy.toFixed(3)} Gy</dd></div>
            <div><dt className="text-xs text-muted-foreground">Signed difference</dt><dd className="m-0 font-mono">{voxel.delta_gy >= 0 ? "+" : ""}{voxel.delta_gy.toFixed(3)} Gy</dd></div>
            <div><dt className="text-xs text-muted-foreground">Structures</dt><dd className="m-0">{voxel.roi_memberships.join(", ") || "none"}</dd></div>
            <p className="col-span-full m-0 text-xs text-muted-foreground">Voxel ({voxel.voxel.join(", ")}) on the processed benchmark grid. Reference SHA-256 {voxel.reference_dose_sha256.slice(0, 12)}..., prediction SHA-256 {voxel.prediction_sha256.slice(0, 12)}...</p>
          </dl>}
        </section>

        <section className="grid gap-2" aria-label="Record a research decision">
          <h4 className="m-0 text-sm font-semibold">Decision for {roi}{supersedes ? ` (revises review from ${new Date(supersedes.created_at).toLocaleString()})` : ""}</h4>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Research decision">
            {DECISIONS.map(option => <Button key={option.value} type="button" size="sm" variant={decision === option.value ? "default" : "outline"} aria-pressed={decision === option.value} onClick={() => setDecision(option.value)}>{option.label}</Button>)}
          </div>
          <Field className="grid gap-1"><FieldLabel htmlFor="review-rationale">Rationale (required, at least 10 characters)</FieldLabel><Textarea id="review-rationale" rows={3} maxLength={2000} value={rationale} onChange={event => setRationale(event.target.value)} placeholder="What in the comparison supports this decision?" /></Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={!ready} onClick={() => void record()}>{busy ? "Recording..." : "Record research review"}</Button>
            {supersedes && <Button type="button" variant="ghost" size="sm" onClick={() => setSupersedes(null)}>Cancel revision</Button>}
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {saved && <p role="status" className="m-0 text-sm text-primary">Recorded: {saved.decision_label}. Audit entry {saved.audit_row_hash?.slice(0, 12)}...</p>}
        </section>

        <section className="grid gap-2" aria-label="Review history">
          <h4 className="m-0 flex items-center gap-2 text-sm font-semibold"><History aria-hidden className="size-4" />Review history</h4>
          {canReview && <div className="flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant="outline" onClick={() => void verifyAudit()}>Verify audit log</Button>{audit && <span role="status" className={audit.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{audit.ok ? `Hash chain verified: ${audit.entries} entries, head ${audit.head_hash?.slice(0, 12) ?? "none"}...` : `Chain broken at entry ${audit.first_broken_id}: ${audit.reason}`}</span>}</div>}
          {history.error && <p className="m-0 text-sm text-muted-foreground">{history.error.message}</p>}
          {history.data?.length === 0 && <p className="m-0 text-sm text-muted-foreground">No research review has been recorded for this prediction yet.</p>}
          <ul className="m-0 grid list-none gap-2 p-0">
            {history.data?.map(review => <li key={review.id} className="grid gap-1 rounded-lg border p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{review.decision_label}</span><Badge variant="outline">{review.evidence.roi} · {new Date(review.created_at).toLocaleString()}</Badge></div>
              <p className="m-0 text-sm">{review.rationale}</p>
              <p className="m-0 text-xs text-muted-foreground">{review.reviewer_name} · mean {review.evidence.reference_mean_gy.toFixed(2)} vs {review.evidence.prediction_mean_gy.toFixed(2)} Gy (difference {review.evidence.mean_delta_gy >= 0 ? "+" : ""}{review.evidence.mean_delta_gy.toFixed(2)} Gy){review.supersedes_id ? " · revises an earlier review" : ""}</p>
              <div className="flex flex-wrap gap-2">
                {onReopen && <Button type="button" size="sm" variant="outline" onClick={() => onReopen(review)}>Reopen view</Button>}
                <Button type="button" size="sm" variant="outline" onClick={() => setSupersedes(review)}>Revise</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void exportDocument(review, "export")}><Download data-icon="inline-start" />Report JSON</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void exportDocument(review, "fhir")}><Download data-icon="inline-start" />FHIR R4</Button>
              </div>
            </li>)}
          </ul>
        </section>
        </>}
      </CardContent>
    </Card>
  )
}
