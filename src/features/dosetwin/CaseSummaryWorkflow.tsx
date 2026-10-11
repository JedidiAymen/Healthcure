import { useMemo } from "react";
import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Check, CircleAlert, Clock3, Database, FileText, FlaskConical, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { CaseRecord, DoseTwinRunRecord, EvidenceReport } from "@/lib/api";

type Stage = "ready" | "running" | "complete" | "waiting" | "failed";
type WorkflowNodeData = {
  title: string;
  detail: string;
  status: string;
  stage: Stage;
  icon: "source" | "operation" | "metrics" | "report";
  action?: {
    label: string;
    disabled: boolean;
    pending?: boolean;
    onClick: () => void;
  };
};
type WorkflowNode = Node<WorkflowNodeData, "caseSummaryStage">;

const iconByName = {
  source: Database,
  operation: FlaskConical,
  metrics: Check,
  report: FileText,
};
const stageClasses: Record<Stage, string> = {
  ready: "border-primary/50 bg-primary/5",
  running: "border-primary bg-primary/10",
  complete: "border-primary/45 bg-card",
  waiting: "border-border bg-muted/30",
  failed: "border-destructive/60 bg-destructive/5",
};
const stageLabels: Record<Stage, string> = {
  ready: "Ready",
  running: "Running",
  complete: "Complete",
  waiting: "Waiting",
  failed: "Failed",
};

function StageNode({ data }: NodeProps<WorkflowNode>) {
  const Icon = iconByName[data.icon];
  const StatusIcon = data.stage === "running" ? LoaderCircle : data.stage === "failed" ? CircleAlert : data.stage === "complete" ? Check : Clock3;
  return (
    <Card className={`w-[min(440px,calc(100vw-5rem))] gap-0 rounded-lg p-0 shadow-sm ${stageClasses[data.stage]}`}>
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-primary" />
      <CardHeader className="flex min-w-0 grid-cols-1 flex-row items-start gap-3 p-3 sm:p-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-background text-primary ring-1 ring-border"><Icon aria-hidden="true" className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-sm font-semibold">{data.title}</h3>
            <Badge variant={data.stage === "failed" ? "destructive" : data.stage === "complete" ? "secondary" : "outline"} className="gap-1 text-[10px]">
              <StatusIcon className={`size-3 ${data.stage === "running" ? "animate-spin" : ""}`} aria-hidden="true" />{stageLabels[data.stage]} · {data.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 sm:px-3.5">
        <p className="m-0 break-words text-xs leading-relaxed text-muted-foreground">{data.detail}</p>
        {data.action && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="nodrag nopan mt-3 h-8"
            disabled={data.action.disabled}
            aria-busy={data.action.pending || undefined}
            onClick={(event) => {
              event.stopPropagation();
              data.action?.onClick();
            }}
          >
            {data.action.pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
            {data.action.label}
          </Button>
        )}
      </CardContent>
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-primary" />
    </Card>
  );
}

const nodeTypes = { caseSummaryStage: StageNode };
const edgeStyle = { stroke: "var(--primary)", strokeWidth: 1.5 };

type Props = {
  selectedCase: CaseRecord | undefined;
  selectedCaseId: string;
  run: DoseTwinRunRecord | null;
  runBusy: boolean;
  runError: string;
  report: EvidenceReport | null;
  reportBusy: boolean;
  reportError: string;
  onRun: () => void;
  onSaveReport: (runId: string) => void;
  onViewMetrics: () => void;
};

export function CaseSummaryWorkflow({ selectedCase, selectedCaseId, run, runBusy, runError, report, reportBusy, reportError, onRun, onSaveReport, onViewMetrics }: Props) {
  const nodes = useMemo<WorkflowNode[]>(() => {
    const hasCurrentRun = run?.case_id === selectedCaseId;
    const hasCurrentMetrics = hasCurrentRun && run?.results !== null && run?.results !== undefined;
    const hasSavedReport = Boolean(hasCurrentRun && report?.run_id === run?.id);
    const sourceCanRun = selectedCase?.status === "ready";
    const requestStage: Stage = runBusy ? "running" : runError ? "failed" : hasCurrentRun ? run?.status === "completed" ? "complete" : run?.status === "failed" ? "failed" : "ready" : selectedCase && !sourceCanRun ? "waiting" : "ready";
    const requestStatus = runBusy ? "POST in progress" : runError ? "Request error" : hasCurrentRun ? `Run ${run?.status}` : !selectedCase ? "Choose a case" : sourceCanRun ? "POST not started" : "Unavailable for this source";
    const metricStage: Stage = hasCurrentMetrics ? "complete" : hasCurrentRun && run?.status === "failed" ? "failed" : "waiting";
    const reportStage: Stage = reportBusy ? "running" : reportError ? "failed" : hasSavedReport ? "complete" : hasCurrentMetrics ? "ready" : "waiting";
    const metricDetails = hasCurrentMetrics && run?.results
      ? `${Object.keys(run.results.available_rois).length} returned structures · grid ${run.results.grid_shape.join(" × ")} · ${run.results.dose_reference_kind}`
      : hasCurrentRun ? "The API response contains no result metrics for this run." : "Returned dose metrics appear here after a matching run completes.";
    return [
      {
        id: "selected-source",
        type: "caseSummaryStage",
        position: { x: 0, y: 0 },
        data: {
          title: "Selected OpenKBP source",
          detail: selectedCase ? `${selectedCase.label} · ${selectedCase.id} · installed ${selectedCase.dataset_id} case` : "Choose an installed source case to configure the request.",
          status: selectedCase ? "Selected" : "Choose a case",
          stage: selectedCase ? "complete" : "waiting",
          icon: "source",
        },
      },
      {
        id: "summary-request",
        type: "caseSummaryStage",
        position: { x: 0, y: 225 },
        data: {
          title: "Case-summary API request",
          detail: runError || (!sourceCanRun && selectedCase ? "This source is inspection-only or blocked in the installed profile, so the existing run operation is unavailable." : "POST /api/v1/runs · openkbp.case_summary. The server validates the installed sparse arrays and records their provenance; identical inputs reuse the saved run."),
          status: requestStatus,
          stage: requestStage,
          icon: "operation",
          action: {
            label: runBusy ? "Calculating…" : hasCurrentMetrics ? "Run again" : "Run case summary",
            disabled: !sourceCanRun || runBusy,
            pending: runBusy,
            onClick: onRun,
          },
        },
      },
      {
        id: "returned-metrics",
        type: "caseSummaryStage",
        position: { x: 0, y: 450 },
        data: {
          title: "Returned benchmark metrics",
          detail: metricDetails,
          status: hasCurrentMetrics ? "API result" : "Awaiting result",
          stage: metricStage,
          icon: "metrics",
          action: hasCurrentMetrics ? {
            label: "View returned metrics",
            disabled: false,
            onClick: onViewMetrics,
          } : undefined,
        },
      },
      {
        id: "saved-report",
        type: "caseSummaryStage",
        position: { x: 0, y: 675 },
        data: {
          title: "Evidence report · this visit",
          detail: reportError || (hasSavedReport ? `Saved during this visit · ${report?.id} · ${report?.status}` : reportBusy ? "Saving a report from the selected run." : hasCurrentMetrics ? "Save a provenance-linked report from the selected run. This trace only tracks saves made during this visit." : "Available after a result has been returned. This trace only tracks saves made during this visit."),
          status: reportBusy ? "Save in progress" : reportError ? "Save error" : hasSavedReport ? "Saved this visit" : hasCurrentMetrics ? "Not saved this visit" : "Not available yet",
          stage: reportStage,
          icon: "report",
          action: hasCurrentMetrics && run ? {
            label: reportBusy ? "Saving report…" : hasSavedReport ? "Save another report" : "Save evidence report",
            disabled: reportBusy,
            pending: reportBusy,
            onClick: () => onSaveReport(run.id),
          } : undefined,
        },
      },
    ];
  }, [selectedCase, selectedCaseId, run, runBusy, runError, report, reportBusy, reportError, onRun, onSaveReport, onViewMetrics]);
  const edges = useMemo<Edge[]>(() => [
    { id: "source-to-request", source: "selected-source", target: "summary-request", type: "smoothstep", animated: runBusy, markerEnd: { type: MarkerType.ArrowClosed }, style: edgeStyle },
    { id: "request-to-metrics", source: "summary-request", target: "returned-metrics", type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed }, style: edgeStyle },
    { id: "metrics-to-report", source: "returned-metrics", target: "saved-report", type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed }, style: edgeStyle },
  ], [runBusy]);

  return (
    <section aria-labelledby="case-summary-workflow-title" className="mb-4 rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="case-summary-workflow-title" className="m-0 text-sm font-semibold">Scientific operation trace</h2>
          <p className="m-0 mt-1 text-xs text-muted-foreground">Live view of the selected source, returned API result and report saves made during this visit.</p>
        </div>
        <span className="text-[10px] text-muted-foreground">Source truth comes from this profile&apos;s API.</span>
      </div>
      <div className="h-[850px] w-full overflow-hidden rounded-md border border-border bg-background" aria-label="OpenKBP case-summary workflow graph">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12, minZoom: 0.55, maxZoom: 1 }}
          minZoom={0.45}
          maxZoom={1.2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll={false}
          className="text-foreground"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--border)" />
        </ReactFlow>
      </div>
    </section>
  );
}
