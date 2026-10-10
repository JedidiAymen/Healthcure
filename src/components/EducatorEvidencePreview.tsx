import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Database } from "lucide-react";
import { api, type EducatorAttemptReview } from "@/lib/api";
import { assessEducatorEvidencePreview, verifyAssignedSignalEvidence } from "@/lib/educator-evidence-preview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const DoseViewer = lazy(() => import("@/pages/DoseViewer").then((module) => ({ default: module.DoseViewer })));
const SurgiViewer = lazy(() => import("@/pages/SurgiViewer").then((module) => ({ default: module.SurgiViewer })));
const FistulaViewer = lazy(() => import("@/pages/FistulaViewer").then((module) => ({ default: module.FistulaViewer })));

export function EducatorEvidencePreview({ attempt }: { attempt: EducatorAttemptReview }) {
  const assessment = assessEducatorEvidencePreview(attempt);
  const evidence = assessment.state === "ready" ? assessment.evidence : null;
  const sourceCheck = useQuery({
    queryKey: ["educator-evidence-source", attempt.attempt_id, evidence],
    enabled: evidence !== null,
    queryFn: async () => {
      if (!evidence) throw new Error("Submitted evidence is unavailable.");
      if (evidence.kind === "fistulaguard") {
        const record = await api.signalRecord(evidence.record_id);
        const window = await api.signalWindow(evidence.record_id, evidence.channel, evidence.start_sec, evidence.duration_sec);
        verifyAssignedSignalEvidence(evidence, record, window);
        return true;
      }
      if (evidence.kind === "surgivision") {
        const frame = await api.surgicalFrame(evidence.frame_id);
        if (frame.id !== evidence.case_id || !/^[a-f\d]{64}$/i.test(frame.image_sha256) || !/^[a-f\d]{64}$/i.test(frame.annotation_sha256)) {
          throw new Error("EVIDENCE_MISMATCH: The Endoscapes frame identity or source checksums do not match.");
        }
        return true;
      }
      const [ct, dose, roi] = await Promise.all([
        api.slice(evidence.case_id, 2, evidence.voxel[2], "ct", evidence.roi),
        api.slice(evidence.case_id, 2, evidence.voxel[2], "dose", evidence.roi),
        api.slice(evidence.case_id, 2, evidence.voxel[2], "roi", evidence.roi),
      ]);
      const slices = [ct, dose, roi];
      if (slices.some((slice) => slice.case_id !== evidence.case_id || !/^[a-f\d]{64}$/i.test(slice.source_sha256) || slice.source_revision !== ct.source_revision)) {
        throw new Error("EVIDENCE_MISMATCH: The DoseTwin arrays do not share the assigned case and verified source revision.");
      }
      return true;
    },
  });
  const issue = assessment.state !== "ready" || sourceCheck.isError || sourceCheck.data !== true;
  const issueMessage = assessment.state !== "ready" ? assessment.message
    : sourceCheck.error instanceof Error ? sourceCheck.error.message.replace(/^EVIDENCE_MISMATCH: /, "")
      : "Verifying the assigned source and checksum before display…";
  const issueState = assessment.state !== "ready" ? assessment.state
    : sourceCheck.isError ? (sourceCheck.error instanceof Error && sourceCheck.error.message.startsWith("EVIDENCE_MISMATCH:") ? "mismatch" : "unavailable")
      : "unavailable";
  return (
    <Card className="min-w-0 overflow-hidden" aria-label="Submitted scientific evidence preview">
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Submitted evidence</Badge>
          {assessment.state === "ready" && <Badge variant="secondary">Assigned source · read only</Badge>}
        </div>
        <CardTitle className="mt-1 text-base">Scientific evidence</CardTitle>
        <CardDescription>
          {assessment.state === "ready"
            ? `${attempt.assigned_case?.case_label} · submitted coordinates and source window are restored from this attempt.`
            : issueMessage}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 p-3 sm:p-4">
        {issue ? (
          <div role={issueState === "absent" || !sourceCheck.isError ? "status" : "alert"} className="flex min-h-32 items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {issueState === "absent" ? <Database className="size-5 shrink-0"/> : <CircleAlert className="size-5 shrink-0 text-amber-600"/>}
            <span>{issueMessage}</span>
          </div>
        ) : (
          <div className="min-w-0 overflow-hidden" data-testid="assigned-evidence-viewer">
            <Suspense fallback={<Skeleton className="h-72"/>}>
              {assessment.evidence.kind === "dosetwin" && <DoseViewer key={`${assessment.evidence.case_id}:${attempt.attempt_id}`} caseId={assessment.evidence.case_id} viewerEvidence={assessment.evidence} guided locked/>}
              {assessment.evidence.kind === "surgivision" && <SurgiViewer key={`${assessment.evidence.frame_id}:${attempt.attempt_id}`} frameId={assessment.evidence.frame_id} availableFrameIds={[assessment.evidence.frame_id]} viewerEvidence={assessment.evidence} guided locked/>}
              {assessment.evidence.kind === "fistulaguard" && <FistulaViewer key={`${assessment.evidence.record_id}:${attempt.attempt_id}`} recordId={assessment.evidence.record_id} availableRecordIds={[assessment.evidence.record_id]} viewerEvidence={assessment.evidence} guided locked/>}
            </Suspense>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
