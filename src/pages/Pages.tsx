import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueries, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  Boxes,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Database,
  Download,
  ExternalLink,
  FileLock2,
  FileText,
  FlaskConical,
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  Microscope,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trophy,
  Upload,
  Workflow,
  X,
} from "lucide-react";
import {
  api,
  type CaseRecord,
  type EducatorDraftSummary,
  type EvidenceReport,
  type SignalWindowComparison,
  type StudentChallenge,
  type StudentLearningPath,
  type StudentLearningPathLesson,
  type StudentAttempt,
  type StudentDebrief,
  type StudentViewerEvidence,
  type StudentProgress,
  type EducatorAssignment,
  type EducatorAttemptReview,
  type EducatorCohort,
  type EducatorStudent,
  type PublishedLessonVersion,
  type ModelRecord,
  type ModelValidation,
  type DoseTwinRunRecord,
  type RunRecord,
  type ViewerEvidenceState,
} from "../lib/api";
import { buildSignalComparisonReport } from "../lib/signal-evidence";
import { activityAchievementKey, unannouncedActivityAchievements } from "../lib/academy-achievement-announcement";
import { useSession } from "@/lib/session";
const DoseViewer = lazy(() =>
  import("./DoseViewer").then((module) => ({ default: module.DoseViewer })),
);
const StudentProgressChart = lazy(() =>
  import("./StudentProgressChart").then((module) => ({ default: module.StudentProgressChart })),
);
const SurgiViewer = lazy(() =>
  import("./SurgiViewer").then((module) => ({ default: module.SurgiViewer })),
);
const FistulaViewer = lazy(() =>
  import("./FistulaViewer").then((module) => ({
    default: module.FistulaViewer,
  })),
);
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AchievementBadge } from "@/components/ui/achievement-badge";
import { AchievementGrid } from "@/components/ui/achievement-grid";
import { PointsBadge } from "@/components/ui/points-badge";
import { ResearchCasePicker } from "@/components/ResearchCasePicker";
import { StudentMissionStepper } from "./StudentMissionStepper";
import { EducatorEvidencePreview } from "@/components/EducatorEvidencePreview";
import "./academy.css";
import { queryKeys } from "@/lib/query-client";
import { renderDoseSlicePixels } from "@/lib/dose-visualization";
import { filterModelCatalog, type ModelReadinessFilter } from "@/lib/model-catalog";
import { canSubmitMission, getMissionProgress } from "@/lib/academy-mission-progress";
import { offlineStore } from "@/lib/mission-offline";
import { clearDraft, enqueueSubmit, isNetworkError, loadDraft, saveDraft } from "@/lib/offline-queue";
import { CvsSelfCheck, CvsSelfCheckSummary } from "@/features/surgivision/CvsSelfCheck";
import clinicalTeamImage from "../assets/clinical-team.jpg";

const specialtyData = {
  surgivision: {
    name: "SurgiVision",
    subtitle: "Laparoscopic gallbladder scene research",
    short: "Surgical computer vision",
    color: "sea",
    icon: Stethoscope,
    source: "Endoscapes",
    sourceUrl: "https://github.com/CAMMA-public/Endoscapes",
    tasks: [
      "Frame and annotation review",
      "COCO anatomy and tool bounding boxes",
      "Image-level CVS label array",
      "Endoscapes 1 fps sampled-frame browsing",
      "Cholec80 full-rate video with frame-matched phase labels",
      "Licensed Appendix300 video excerpt playback",
    ],
    blockers: [
      "Endoscapes is a sampled-still release; its sequence is not continuous video",
      "CVS-AdaptNet remains gated on independent checkpoint hash and terms",
    ],
    unavailableMethods: [
      { task: "Continuous video aligned with Endoscapes frames and annotations", reason: "The available Cholec80 and Appendix300 videos are distinct sources; neither is frame-linked to Endoscapes stills." },
      { task: "Single-frame model inference", reason: "Checkpoint identity and checkpoint-specific terms remain unverified." },
    ],
  },
  dosetwin: {
    name: "DoseTwin",
    subtitle: "Head-and-neck radiotherapy benchmark analysis",
    short: "Dose distribution research",
    color: "blue",
    icon: Activity,
    source: "OpenKBP",
    sourceUrl: "https://github.com/ababier/open-kbp",
    tasks: [
      "CT, reference dose and ROI masks",
      "Index-space linked slice views",
      "Dose statistics and DVH",
      "Validate a local same-case prediction before comparison",
    ],
    blockers: [
      "No prediction checkpoint is installed",
      "Clinical-treatment workflows remain disabled",
    ],
    unavailableMethods: [
      { task: "Dose prediction inference", reason: "No verified checkpoint, runtime or prediction output is installed." },
      { task: "Reference-versus-prediction comparison", reason: "No authentic compatible second array is installed. Local import and grid validation are supported; no prediction is generated or supplied." },
    ],
  },
  fistulaguard: {
    name: "FistulaGuard",
    subtitle: "Hemodialysis vascular-access acoustics",
    short: "Vascular-access signal research",
    color: "violet",
    icon: Radio,
    source: "FiSaV",
    sourceUrl: "https://osf.io/hypfr/",
    tasks: [
      "Measured multichannel signal window",
      "Time-aligned waveform and calculated PSD",
      "Source-derived sample rate and integrity hash",
    ],
    blockers: [
      "All 59 source recordings are installed; this view shows one at a time",
      "Physical sensor units are unspecified",
      "No stenosis classifier or patient-disjoint validation is implemented",
    ],
    unavailableMethods: [
      { task: "Stenosis classification", reason: "Supported outcome labels and patient-disjoint validation are not available." },
    ],
  },
} as const;
type ModuleId = keyof typeof specialtyData;
const challengeStatePresentation = {
  not_started: { label: "Available", variant: "outline" as const },
  in_progress: { label: "In progress", variant: "secondary" as const },
  submitted: { label: "Submitted", variant: "secondary" as const },
  reviewed: { label: "Reviewed", variant: "outline" as const },
};

function useApi<T>(queryKey: QueryKey, load: () => Promise<T>, initial: T) {
  const query = useQuery({
    queryKey,
    queryFn: load,
  });
  return {
    data: query.data ?? initial,
    loading: !query.isFetched,
    error: query.error instanceof Error ? query.error.message : query.error ? "Unable to reach local API" : "",
  };
}
function savedViewerState(caseId: string): ViewerEvidenceState | undefined {
  try {
    const state = JSON.parse(
      localStorage.getItem("medforge-dose-viewer-state") ?? "null",
    ) as Partial<ViewerEvidenceState> | null;
    if (
      !state ||
      state.case_id !== caseId ||
      !Array.isArray(state.voxel) ||
      state.voxel.length !== 3 ||
      !state.voxel.every((v) => Number.isInteger(v) && v >= 0 && v <= 127) ||
      typeof state.roi !== "string" ||
      ![
        "Brainstem",
        "SpinalCord",
        "RightParotid",
        "LeftParotid",
        "Esophagus",
        "Larynx",
        "Mandible",
        "PTV56",
        "PTV63",
        "PTV70",
      ].includes(state.roi) ||
      typeof state.dose_overlay !== "boolean" ||
      typeof state.roi_overlay !== "boolean" ||
      typeof state.dose_opacity !== "number" ||
      state.dose_opacity < 0 ||
      state.dose_opacity > 1
    )
      return;
    return state as ViewerEvidenceState;
  } catch {
    return;
  }
}
function Header({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
      <div className="max-w-3xl">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground md:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action && <div className="flex w-full items-center gap-2 md:w-auto">{action}</div>}
    </header>
  );
}
function SourceBadge({
  children,
  kind = "ready",
}: {
  children: ReactNode;
  kind?: "ready" | "blocked" | "planned";
}) {
  return (
    <Badge variant="outline" className={`source-badge ${kind}`}>
      <span className="badge-dot" />
      {children}
    </Badge>
  );
}
function EmptySource({ module }: { module: ModuleId }) {
  const m = specialtyData[module],
    Icon = m.icon;
  const dataLabel =
    module === "fistulaguard"
      ? "FiSaV recording"
      : module === "surgivision"
        ? "Endoscapes frame"
        : "OpenKBP case";
  return (
    <Alert className="my-4 border-amber-900/50 bg-amber-950/20 text-foreground [&>svg]:text-amber-300">
      <Icon aria-hidden="true" />
      <AlertTitle>No authorized {dataLabel} is installed</AlertTitle>
      <AlertDescription>
        <p>MEDFORGE checks local source files before creating a case. It does not substitute a mock image, waveform, mask, or dose map.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2 text-muted-foreground"><Database aria-hidden="true"/>Expected source: {m.source}</span>
          <Button render={<a href={m.sourceUrl} target="_blank" rel="noreferrer" />} nativeButton={false} variant="link" size="sm" className="h-auto p-0">
            Source requirements <ExternalLink data-icon="inline-end" />
          </Button>
          <Button render={<Link to="/studio/cases" />} nativeButton={false} variant="outline" size="sm">
            <Upload data-icon="inline-start" />Open case registry
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function Home() {
  const cases = useApi(queryKeys.cases, api.cases, [] as CaseRecord[]);
  const runHistory = useApi(queryKeys.runs, api.runs, [] as RunRecord[]);
  const resumableRun = runHistory.data.find((run): run is DoseTwinRunRecord =>
    run.operation_id === "openkbp.case_summary" && run.status === "completed" && run.results !== null,
  );
  const areas = [
    { id: "surgivision", name: "SurgiVision", discipline: "Surgical vision research", source: "Endoscapes", measure: "annotated frames" },
    { id: "dosetwin", name: "DoseTwin", discipline: "Radiation oncology & physics", source: "OpenKBP", measure: "benchmark case" },
    { id: "fistulaguard", name: "FistulaGuard", discipline: "Nephrology & access care", source: "FiSaV", measure: "signal recordings" },
  ] as const;
  return (
    <main className="home-page grid gap-10 pb-8">
      <section className="home-hero grid items-stretch gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)]">
        <div className="flex min-w-0 flex-col justify-center gap-6 py-2 xl:py-8">
          <Badge variant="outline" className="w-fit gap-2 rounded-md border-primary/25 bg-card px-3 py-1.5 font-medium text-primary">
            <Stethoscope data-icon="inline-start" /> Research tools for clinical teams
          </Badge>
          <div className="max-w-[720px] space-y-4">
            <h1 className="home-title text-4xl leading-[1.04] font-semibold tracking-[-0.045em] text-foreground sm:text-5xl xl:text-[56px]">
              Clinical research, grounded in evidence.
            </h1>
            <p className="max-w-[590px] text-base leading-7 text-muted-foreground">
              Explore source-verified surgical imagery, radiotherapy benchmark volumes, and measured vascular-access signals in tools built for scientific inspection.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={resumableRun ? `/studio/experiments?runId=${encodeURIComponent(resumableRun.id)}` : "/studio"}
              className={buttonVariants({ size: "lg", className: "h-11 rounded-[10px] px-5" })}
            >
              {resumableRun ? "Continue analysis" : "Open Professional Studio"} <ArrowRight data-icon="inline-end" />
            </Link>
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-primary"/> Source and limits stay visible</span>
          </div>
          <div className="grid max-w-[640px] grid-cols-3 border-t border-border pt-4">
            {areas.map((area) => {
              const count = cases.data.filter((record) => record.module === area.id).length;
              return <div className="grid content-start gap-1 border-r border-border pr-3 pl-3 first:pl-0 last:border-0" key={area.id}>
                <span className="text-xs leading-snug text-muted-foreground">{area.name}</span>
                <b className="font-mono text-xl font-medium tracking-tight text-foreground">{cases.loading ? "—" : count.toLocaleString()}</b>
                <small className="text-[11px] leading-snug text-muted-foreground">{area.measure}</small>
              </div>;
            })}
          </div>
        </div>
        <div role="group" aria-label="Live previews of the three independent research sources" className="relative min-h-[280px] overflow-hidden rounded-xl border border-[#34415C] bg-[#101624] sm:min-h-[340px] xl:min-h-[400px]">
          <ResearchEvidenceMontage cases={cases.data} />
        </div>
      </section>

      <StudioDepartmentAtlas cases={cases.data} />

      <section aria-label="Other MEDFORGE workspaces" className="grid gap-4 border-t border-border pt-7 md:grid-cols-2">
        <Link to="/academy" className="home-role-link group flex min-h-24 items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/35">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#DFF4F8] text-[#23576b]"><GraduationCap aria-hidden="true"/></span>
          <span className="grid flex-1 gap-1"><b className="font-medium text-foreground">Student Academy</b><small className="text-sm leading-5 text-muted-foreground">Learn through source-backed medical investigations.</small></span>
          <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1"/>
        </Link>
        <Link to="/educator" className="home-role-link group flex min-h-24 items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/35">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#edf1f8] text-primary"><BookOpenCheck aria-hidden="true"/></span>
          <span className="grid flex-1 gap-1"><b className="font-medium text-foreground">Educator Studio</b><small className="text-sm leading-5 text-muted-foreground">Build evidence-centered lessons and review submissions.</small></span>
          <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1"/>
        </Link>
      </section>
    </main>
  );
}

function SurgicalAtlasView({ frameId }: { frameId: string }) {
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setImageUrl("");
    setImageError(false);
    api.surgicalImage(frameId)
      .then((url) => {
        objectUrl = url;
        if (active) setImageUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch(() => { if (active) setImageError(true); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [frameId]);
  return imageUrl ? (
    <img src={imageUrl} alt={`Verified Endoscapes source frame ${frameId}; reference data, not model output`} className="h-full w-full object-cover" />
  ) : (
    <div className="grid h-full place-items-center bg-[#182b31] text-cyan-100">
      <div className="grid justify-items-center gap-2">
        <Stethoscope aria-hidden="true" className="size-8 opacity-75" />
        <span className="text-[11px]">{imageError ? "Source frame unavailable" : "Loading verified source frame…"}</span>
      </div>
    </div>
  );
}

function DoseAtlasView({ caseId }: { caseId: string }) {
  const { data } = useQuery({
    queryKey: [...queryKeys.cases, "studio-preview", caseId],
    queryFn: async () => {
      const [ct, dose, roi] = await Promise.all([
        api.slice(caseId, 2, 54, "ct", "PTV70"),
        api.slice(caseId, 2, 54, "dose", "PTV70"),
        api.slice(caseId, 2, 54, "roi", "PTV70"),
      ]);
      return { ct, dose, roi };
    },
  });
  const cells = useMemo(() => {
    if (!data) return [];
    const pixels = renderDoseSlicePixels(data.ct.values, data.dose.values, data.roi.values, {
      showDose: true,
      showRoi: true,
      opacity: 0.78,
    });
    return Array.from({ length: 32 * 32 }, (_, index) => {
      const x = (index % 32) * 4;
      const y = Math.floor(index / 32) * 4;
      const rgb = [0, 1, 2].map((channel) => {
        let total = 0;
        for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
          total += pixels[((y + row) * 128 + x + column) * 4 + channel];
        }
        return Math.round(total / 16);
      });
      return { x, y, fill: `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})` };
    });
  }, [data]);
  const caseLabel = caseId.split(":").at(-1) ?? caseId;
  return (
    <div className="relative grid h-full place-items-center overflow-hidden bg-[#0b1420]">
      {data ? <svg viewBox="0 0 128 128" role="img" aria-label={`OpenKBP ${caseLabel} axial slice z54; source CT, reference dose and PTV70 boundary`} className="size-32 sm:size-36 [image-rendering:pixelated]">{cells.map((cell) => <rect key={`${cell.x}-${cell.y}`} x={cell.x} y={cell.y} width="4" height="4" fill={cell.fill} />)}</svg> : <div className="grid size-20 place-items-center rounded-full border border-sky-300/20 text-sky-100"><Activity aria-hidden="true" className="size-7" /></div>}
      <span className="absolute bottom-2 left-2 rounded-sm bg-black/65 px-2 py-1 font-mono text-[10px] text-white">{data ? `${caseLabel} · axial z54 · PTV70 boundary` : `Reading ${caseLabel} source arrays…`}</span>
    </div>
  );
}

function SignalAtlasView({ recordId, compact = false }: { recordId: string; compact?: boolean }) {
  const { data, error } = useQuery({
    queryKey: [...queryKeys.cases, "studio-preview", "fisav", recordId],
    queryFn: () => api.signalWindow(recordId, "raw PZT1", 0, 0.5),
  });
  const samples = data?.samples ?? [];
  const low = samples.length ? Math.min(...samples.map((point) => point.value)) : 0;
  const high = samples.length ? Math.max(...samples.map((point) => point.value)) : 1;
  const span = Math.max(high - low, Number.EPSILON);
  const polyline = samples.filter((_, index) => index % Math.max(1, Math.ceil(samples.length / 240)) === 0)
    .map((point) => `${8 + (point.time_sec - (data?.start_sec ?? 0)) / Math.max(data?.duration_sec ?? 0.5, Number.EPSILON) * 284},${63 - ((point.value - low) / span) * 48}`)
    .join(" ");
  return (
    <div className={compact ? "grid size-full place-items-center overflow-hidden bg-[#0d1a1c] p-1" : "grid h-full grid-rows-[1fr_auto] bg-[#0d1a1c] p-3"}>
      <svg viewBox="0 0 300 72" role="img" aria-label={data ? `Measured FiSaV ${data.case_id} raw PZT1 waveform, 0 to 0.5 seconds; physical unit unspecified; source hash ${data.source_sha256}` : error ? "FiSaV waveform preview unavailable" : "Loading authentic FiSaV source waveform"} className={compact ? "h-full w-full" : "h-full w-full overflow-visible"}>
        <path d="M8 15H292M8 39H292M8 63H292" stroke="rgba(140,185,183,.16)" strokeWidth="1" />
        {polyline && <polyline points={polyline} fill="none" stroke="#6bd6c6" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
      </svg>
      {!compact && <div className="flex items-end justify-between gap-2 border-t border-emerald-100/10 pt-2 text-[10px] text-emerald-50/65">
        <span>{data ? `${data.case_id} · raw PZT1 · ${data.source_sample_rate_hz.toLocaleString()} Hz` : error ? "Assigned waveform preview unavailable" : "Loading measured PZT1 samples…"}</span>
        <span className="shrink-0">unit unspecified</span>
      </div>}
    </div>
  );
}

function ResearchEvidenceMontage({ cases }: { cases: CaseRecord[] }) {
  const surgery = cases.find((record) => record.module === "surgivision");
  const dose = cases.find((record) => record.module === "dosetwin");
  const signal = cases.find((record) => record.module === "fistulaguard");
  const unavailable = (label: string) => (
    <div className="grid h-full min-h-0 place-items-center bg-[#101624] px-3 text-center text-xs text-slate-300">
      <span>{label}</span>
    </div>
  );

  return (
    <div className="grid h-full min-h-[280px] grid-cols-[minmax(0,1.45fr)_minmax(112px,0.85fr)] grid-rows-2 gap-px bg-[#34415C] sm:min-h-[340px] xl:min-h-[400px]">
      <figure className="relative m-0 row-span-2 min-h-0 overflow-hidden bg-[#101624]">
        {surgery ? <SurgicalAtlasView frameId={surgery.id} /> : unavailable("No verified Endoscapes frame is installed")}
        <figcaption className="absolute inset-x-0 bottom-0 grid gap-0.5 bg-gradient-to-t from-[#101624]/95 via-[#101624]/75 to-transparent px-3 pb-3 pt-8 text-white sm:px-4 sm:pb-4">
          <span className="text-xs font-medium">Endoscapes · annotated source frame</span>
          <span className="font-mono text-[10px] text-slate-200">{surgery?.source_case_id ?? "Source unavailable"} · reference labels, not model output</span>
        </figcaption>
      </figure>
      <figure className="relative m-0 min-h-0 overflow-hidden bg-[#0b1420]">
        {dose ? <DoseAtlasView caseId={dose.id} /> : unavailable("No verified OpenKBP case is installed")}
        <figcaption className="sr-only">OpenKBP {dose?.source_case_id ?? "case unavailable"}, reference dose and PTV70 boundary</figcaption>
      </figure>
      <figure className="relative m-0 min-h-0 overflow-hidden bg-[#0d1a1c]">
        {signal ? <SignalAtlasView compact recordId={signal.id.split(":").at(-1) ?? signal.id} /> : unavailable("No verified FiSaV recording is installed")}
        <figcaption className="absolute inset-x-0 bottom-0 bg-[#0d1a1c]/90 px-2 py-1 font-mono text-[9px] leading-tight text-emerald-50/85">
          FiSaV · {signal?.source_case_id ?? "source unavailable"} · measured PZT1 · unit unspecified
        </figcaption>
      </figure>
    </div>
  );
}

function AcademyPathPreview({ path }: { path: StudentLearningPath }) {
  const lesson = path.lessons[0];
  if (!lesson?.case_id) {
    const Icon = path.module === "surgivision" ? Stethoscope : path.module === "dosetwin" ? Activity : Radio;
    return <span className="grid size-14 shrink-0 place-items-center rounded-md border bg-muted/40 text-muted-foreground"><Icon aria-hidden="true"/></span>;
  }
  const preview = path.module === "surgivision"
    ? <SurgicalAtlasView frameId={lesson.case_id}/>
    : path.module === "dosetwin"
      ? <DoseAtlasView caseId={lesson.case_id}/>
      : <SignalAtlasView compact recordId={lesson.case_id.split(":").pop() ?? lesson.case_id}/>;
  return <figure className="h-14 w-24 shrink-0 overflow-hidden rounded-md border bg-muted" aria-label={`${lesson.case_label} source preview`}>
    {preview}
    <figcaption className="sr-only">Preview from the assigned {path.module} source case {lesson.case_label}</figcaption>
  </figure>;
}

const academyPathDetails = {
  surgivision: { label: "Surgical teams", source: "Endoscapes frame evidence", icon: Stethoscope },
  dosetwin: { label: "Radiation oncology", source: "OpenKBP dose benchmark", icon: Activity },
  fistulaguard: { label: "Nephrology and access care", source: "FiSaV measured signals", icon: Radio },
} as const;

const academyLessonState = {
  not_started: { label: "Available", marker: "is-available" },
  in_progress: { label: "In progress", marker: "is-active" },
  submitted: { label: "Submitted", marker: "is-submitted" },
  reviewed: { label: "Reviewed", marker: "is-reviewed" },
} as const;

function AcademyJourneyLesson({ lesson, index }: { lesson: StudentLearningPathLesson; index: number }) {
  const state = academyLessonState[lesson.state];
  const action = lesson.state === "in_progress"
    ? "Continue"
    : lesson.state === "submitted" || lesson.state === "reviewed"
      ? "View feedback"
      : "Investigate";
  return (
    <li className="academy-journey-stop">
      <span className={`academy-journey-marker ${state.marker}`} aria-hidden="true">{index + 1}</span>
      <Card className="academy-journey-lesson">
        <CardHeader>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="academy-journey-state">Investigation {String(index + 1).padStart(2, "0")}</p>
              <CardTitle className="mt-1 break-words text-base leading-snug">{lesson.title}</CardTitle>
              <CardDescription className="mt-1 break-words">{lesson.case_label} · version {lesson.version}{lesson.due_at ? ` · due ${new Date(lesson.due_at).toLocaleDateString()}` : ""}</CardDescription>
            </div>
            <Badge variant={lesson.state === "in_progress" ? "secondary" : "outline"} className="shrink-0">{state.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Button render={<Link to={`/academy/missions/${encodeURIComponent(lesson.assignment_id)}`}/>} nativeButton={false} variant={lesson.state === "in_progress" ? "default" : "outline"} size="sm" className="w-full justify-between">
            {action}<ArrowRight data-icon="inline-end"/>
          </Button>
        </CardContent>
      </Card>
    </li>
  );
}

function AcademyJourneyBranch({ path, module, index }: { path: StudentLearningPath | undefined; module: ModuleId; index: number }) {
  const detail = academyPathDetails[module];
  const Icon = detail.icon;
  return (
    <Card className={`academy-journey-branch academy-journey-branch-${module}`}>
      <CardHeader className="academy-journey-branch-header">
        <div className="flex items-start justify-between gap-3">
          <span className="academy-journey-discipline"><Icon aria-hidden="true"/><span>{detail.label}</span></span>
          <span className="academy-journey-branch-number" aria-hidden="true">0{index + 1}</span>
        </div>
        <CardTitle className="text-lg leading-snug">{path?.title ?? `${detail.label} pathway`}</CardTitle>
        <CardDescription>{detail.source}</CardDescription>
        {path?.lessons.length ? <div className="academy-journey-progress" aria-label={`${path.assigned_count} assigned, ${path.in_progress_count} in progress, ${path.submitted_count} submitted, ${path.reviewed_count} reviewed`}>
          <span>{path.assigned_count} assigned</span><span>{path.reviewed_count} reviewed</span>
        </div> : null}
      </CardHeader>
      <CardContent className="academy-journey-branch-content">
        {path ? <>
          <p className="academy-journey-description">{path.description}</p>
          {path.lessons.length ? <ol className="academy-journey-route" aria-label={`${detail.label} assigned investigations`}>
            {path.lessons.map((lesson, lessonIndex) => <AcademyJourneyLesson key={lesson.assignment_id} lesson={lesson} index={lessonIndex}/>) }
          </ol> : <div className="academy-journey-unassigned">
            <Badge variant="outline">Not assigned</Badge>
            <p>Explore the source and objectives. Lessons appear here only after your educator assigns them.</p>
          </div>}
          <Button render={<Link to={`/academy/paths/${encodeURIComponent(path.path_id)}`}/>} nativeButton={false} variant="ghost" size="sm" className="academy-journey-overview">
            Path overview<ArrowRight data-icon="inline-end"/>
          </Button>
        </> : <div className="academy-journey-unassigned">
          <Badge variant="outline">Not available</Badge>
          <p>No published learning path is currently available for this research source.</p>
        </div>}
      </CardContent>
    </Card>
  );
}

function StudioDepartmentAtlas({ cases }: { cases: CaseRecord[] }) {
  const sourceInventory = (Object.keys(specialtyData) as ModuleId[]).map((id) => ({
    id,
    module: specialtyData[id],
    record: cases.find((item) => item.module === id),
    count: cases.filter((item) => item.module === id).length,
  }));
  const labName: Record<ModuleId, string> = {
    surgivision: "Surgery lab",
    dosetwin: "Radiation physics lab",
    fistulaguard: "Vascular acoustics lab",
  };
  const clinicalAudience: Record<ModuleId, string> = {
    surgivision: "For surgeons and surgical educators",
    dosetwin: "For radiation oncologists and medical physicists",
    fistulaguard: "For nephrology and vascular-access teams",
  };
  const accent: Record<ModuleId, string> = {
    surgivision: "border-l-cyan-300/70",
    dosetwin: "border-l-sky-300/70",
    fistulaguard: "border-l-emerald-300/70",
  };
  return (
    <section aria-labelledby="department-atlas-title" className="grid gap-3 sm:gap-4">
      <div className="grid items-end gap-3 border-b border-border/70 pb-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="mb-1 text-xs font-medium text-primary">Professional Studio · specialty workspaces</p>
          <h2 id="department-atlas-title" className="m-0 text-xl font-semibold tracking-tight">Start with your clinical specialty</h2>
          <p className="mb-0 mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Open original research evidence for your field. The three datasets remain separate and do not form a shared patient record.</p>
        </div>
        <Badge variant="outline" className="w-fit rounded-sm font-normal">Three independent research collections</Badge>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {sourceInventory.map(({ id, module, record, count }) => {
          const caseId = record?.id ?? "";
          const unavailable = !record;
          const measure = id === "surgivision" ? "annotated frames" : id === "dosetwin" ? "benchmark case" : "signal recordings";
          return (
            <Card key={id} className={`min-w-0 overflow-hidden rounded-lg border-l-2 ${accent[id]}`}>
              <div className="relative h-44 overflow-hidden border-b border-border/70 sm:h-48">
                {id === "surgivision" && caseId && <SurgicalAtlasView frameId={caseId} />}
                {id === "dosetwin" && caseId && <DoseAtlasView caseId={caseId} />}
                {id === "fistulaguard" && caseId && <SignalAtlasView recordId={caseId.split(":").at(-1) ?? "pat001"} />}
                {unavailable && <div className="grid h-full place-items-center bg-muted/30 text-xs text-muted-foreground">Verified source not installed</div>}
              </div>
              <CardHeader className="gap-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline" className="rounded-sm font-normal">{labName[id]}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{record?.source_case_id ?? "No case"}</span>
                </div>
                <CardTitle className="text-base">{module.name}</CardTitle>
                <CardDescription>{clinicalAudience[id]} · {module.source} · {module.subtitle}</CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto flex items-center justify-between gap-3 border-t border-border/70 bg-muted/15 px-4 py-3">
                <span className="grid gap-0.5"><span className="font-mono text-lg font-medium tabular-nums text-foreground">{count.toLocaleString()}</span><span className="text-xs text-muted-foreground">{measure}</span></span>
                <Button render={<Link to={unavailable ? "/studio/cases" : `/studio/${id}/cases/${encodeURIComponent(caseId)}`} />} nativeButton={false} variant="outline" size="sm" disabled={unavailable}>
                  Open lab <ArrowRight data-icon="inline-end" />
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export function Studio() {
  const cases = useApi(queryKeys.cases, api.cases, [] as CaseRecord[]),
    runs = useApi(queryKeys.runs, api.runs, [] as RunRecord[]),
    reports = useApi(queryKeys.reports, api.reports, [] as EvidenceReport[]);
  return (
    <>
      <header className="mb-7 grid min-w-0 gap-6 border-b border-border/70 pb-7 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.92fr)] lg:items-stretch lg:gap-8">
        <div className="grid min-w-0 content-center gap-4 py-1">
          <Badge variant="outline" className="w-fit gap-2 rounded-md px-2.5 py-1 font-medium text-foreground">
            <Stethoscope data-icon="inline-start" /> For clinical research teams
          </Badge>
          <div className="min-w-0">
            <h1 className="m-0 max-w-[18ch] text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">Built around the work clinicians actually do.</h1>
            <p className="mb-0 mt-3 max-w-[62ch] text-sm leading-6 text-muted-foreground">For surgeons and surgical educators, radiation oncologists and medical physicists, and nephrology and vascular-access teams. Each lab opens on its own real research evidence.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button render={<Link to="/studio/cases" />} nativeButton={false}>
              <Boxes data-icon="inline-start" /> Browse case registry
            </Button>
            <span className="text-xs text-muted-foreground">Research and education · no patient-care advice</span>
          </div>
        </div>
        <Card className="relative min-h-[250px] min-w-0 overflow-hidden rounded-lg border-sidebar-border bg-[#101624] p-0 sm:min-h-[300px] lg:min-h-0">
          <ResearchEvidenceMontage cases={cases.data} />
        </Card>
      </header>
      {cases.error && <Alert variant="destructive"><CircleAlert/><AlertTitle>Source registry unavailable</AlertTitle><AlertDescription>{cases.error}</AlertDescription></Alert>}
      <StudioDepartmentAtlas cases={cases.data} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border/70 py-3 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2"><ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-primary"/><span><strong className="font-medium text-foreground">Designed for clinician review.</strong> Source measurements are descriptive; predictions and diagnosis are not provided.</span></span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link className="hover:text-foreground" to="/studio/experiments">Experiments <ArrowRight className="ml-1 inline size-3"/></Link>
          <Link className="hover:text-foreground" to="/studio/reports">Evidence reports{!reports.loading ? ` · ${reports.data.length}` : ""}</Link>
          <Link className="hover:text-foreground" to="/studio/models">Model readiness</Link>
        </div>
      </div>
      <div className="flex flex-col gap-1 border-b border-border pb-3 pt-4">
        <p className="text-xs font-medium text-muted-foreground">Recent activity</p>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {runs.loading
              ? "Loading saved activity"
              : runs.data.length
                ? "Saved analysis runs"
                : "Nothing to resume yet"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Source-backed calculations appear here after an analysis has been
            saved.
          </p>
        </div>
      </div>
      {runs.data.length ? (
        <div className="border-t border-border">
          {runs.data.slice(0, 5).map((run) => (
            <Link className="flex min-h-[62px] items-center gap-3 border-b border-border px-3 hover:bg-accent/50 max-sm:gap-2 max-sm:px-1" key={run.id} to="/studio/experiments">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-primary">
                <FlaskConical size={17} />
              </span>
              <span className="grid min-w-0 flex-1 gap-1">
                <b className="truncate text-sm font-medium">{run.operation_id}</b>
                <small className="truncate text-xs text-muted-foreground">
                  {run.case_id} · {run.source_kind} · {run.status}
                </small>
              </span>
              <span className="max-w-[120px] truncate font-mono text-[11px] text-muted-foreground max-sm:max-w-[70px]">{run.id}</span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex min-h-12 flex-wrap items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground">
          <Clock3 className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {runs.loading
              ? "Checking saved runs…"
              : "There is no saved analysis activity. Start with an authorized case from the registry."}
          </span>
          {!runs.loading && (
            <Link className="flex items-center gap-1.5 text-primary hover:underline" to="/studio/cases">
              Browse cases <ArrowRight size={14} />
            </Link>
          )}
        </div>
      )}
    </>
  );
}

export function Cases() {
  const { data, loading, error } = useApi(queryKeys.cases, api.cases, [] as CaseRecord[]);
  const recentRuns = useApi(queryKeys.runs, api.runs, [] as RunRecord[]);
  const [filter, setFilter] = useState("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const searchText = searchParams.get("q") ?? "";
  const requestedSelection = searchParams.get("selected");
  const normalizedSearch = searchText.trim().toLocaleLowerCase();
  const rows = useMemo(
    () => data.filter((c) => {
      const matchesModule = filter === "all" || c.module === filter;
      const matchesSearch = !normalizedSearch || [c.id, c.label, c.dataset_id, c.source_case_id, c.reference_kind, c.module]
        .some((field) => field.toLocaleLowerCase().includes(normalizedSearch));
      return matchesModule && matchesSearch;
    }),
    [data, filter, normalizedSearch],
  );
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const requestedPage = Number(searchParams.get("page") ?? 1);
  const page = Math.min(pageCount, Math.max(1, Number.isInteger(requestedPage) ? requestedPage : 1));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const selectedCase = visibleRows.find((record) => record.id === requestedSelection) ?? visibleRows[0];
  useEffect(() => {
    if (!visibleRows.length || selectedCase?.id === requestedSelection) return;
    const params = new URLSearchParams(searchParams);
    params.set("selected", selectedCase.id);
    setSearchParams(params, { replace: true });
  }, [requestedSelection, searchParams, selectedCase?.id, setSearchParams, visibleRows.length]);
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams(searchParams);
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    const query = params.toString();
    return query ? `?${query}` : "?";
  };
  const changePage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams);
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    setSearchParams(params, { replace: true });
  };
  const updateSearch = (nextSearch: string) => {
    const params = new URLSearchParams(searchParams);
    const value = nextSearch.trimStart();
    if (value) params.set("q", value);
    else params.delete("q");
    params.delete("page");
    params.delete("selected");
    setSearchParams(params, { replace: true });
  };
  const clearFilters = () => {
    setFilter("all");
    updateSearch("");
  };
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1)
    .filter((number) => number === 1 || number === pageCount || Math.abs(number - page) <= 1);
  const paginationItems = pageNumbers.flatMap((number, index) => {
    const previous = pageNumbers[index - 1];
    return previous && number - previous > 1
      ? [{ kind: "ellipsis" as const, key: `ellipsis-${previous}` }, { kind: "page" as const, number }]
      : [{ kind: "page" as const, number }];
  });
  const selectionHref = (caseId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("selected", caseId);
    const query = params.toString();
    return query ? `?${query}` : "?";
  };
  const sourceKind = (record: CaseRecord) => record.module === "surgivision"
    ? "Frame"
    : record.module === "dosetwin" ? "Case" : "Recording";
  const moduleLabel = (record: CaseRecord) => specialtyData[record.module].name;
  const lastAction = (record: CaseRecord) => recentRuns.data.find((run) => run.case_id === record.id);
  const actionLabel = (run: RunRecord | undefined) => !run
    ? "No saved action"
    : `${run.operation_id === "openkbp.case_summary" ? "Dose summary" : "CVS model run"} · ${run.status}`;
  return (
    <>
      <Header
        eyebrow="Professional studio / Registry"
        title="Case registry"
        description="Source-identified research cases available on this machine."
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => location.reload()}
          >
            <Activity data-icon="inline-start" />
            Refresh registry
          </Button>
        }
      />
      <div className="mb-4 flex min-w-0 flex-col gap-3 border-b border-border pb-3 lg:flex-row lg:items-center lg:justify-between">
        <ToggleGroup
          className="flex max-w-full items-center gap-1 overflow-x-auto"
          aria-label="Filter cases by research domain"
          multiple={false}
          variant="outline"
          size="sm"
          spacing={1}
          value={[filter]}
          onValueChange={(value) => {
            if (!value[0]) return;
            setFilter(value[0]);
            changePage(1);
          }}
        >
          {[
            ["all", "All domains"],
            ["surgivision", "SurgiVision"],
            ["dosetwin", "DoseTwin"],
            ["fistulaguard", "FistulaGuard"],
          ].map(([id, label]) => (
            <ToggleGroupItem key={id} value={id}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          <InputGroup className="h-9 w-full sm:w-72">
            <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label="Search research cases by source, dataset, or case ID"
              placeholder="Source, dataset, or case ID"
              value={searchText}
              onChange={(event) => updateSearch(event.currentTarget.value)}
            />
            {searchText && <InputGroupAddon align="inline-end"><InputGroupButton aria-label="Clear case search" onClick={() => updateSearch("")}><X aria-hidden="true" /></InputGroupButton></InputGroupAddon>}
          </InputGroup>
          <div aria-live="polite" className="whitespace-nowrap text-xs text-muted-foreground">
          {loading
            ? "Checking local API"
            : rows.length
              ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, rows.length)} of ${rows.length.toLocaleString()} ${normalizedSearch ? "matches" : "cases"}`
              : normalizedSearch ? "No matching cases" : "0 cases"}
          </div>
        </div>
      </div>
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Local case service is unavailable</AlertTitle>
          <AlertDescription>{error}. Start the API and retry the registry.</AlertDescription>
          <AlertAction><Button variant="outline" size="sm" onClick={() => location.reload()}>Retry</Button></AlertAction>
        </Alert>
      ) : rows.length ? (
        <>
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] xl:items-start">
            <div className="order-2 min-w-0 overflow-hidden rounded-lg border border-border bg-card xl:order-1">
              <Table className="table-fixed">
                <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[60%] sm:w-[38%]">Research source</TableHead>
                    <TableHead className="w-[18%] sm:w-[14%]">Type</TableHead>
                    <TableHead className="w-[22%] sm:w-[16%]">Availability</TableHead>
                    <TableHead className="hidden sm:table-cell sm:w-[32%]">Last analysis action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((c) => {
                    const selected = selectedCase?.id === c.id;
                    return <TableRow key={c.id} data-state={selected ? "selected" : undefined} className={selected ? "bg-primary/5" : undefined}>
                      <TableCell className="max-w-0 overflow-hidden">
                        <Link
                          className="group grid min-w-0 gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          to={selectionHref(c.id)}
                          aria-current={selected ? "page" : undefined}
                          aria-label={`Inspect ${c.label}, ${sourceKind(c)} ${c.source_case_id}`}
                        >
                          <span className="truncate font-medium text-foreground group-hover:text-primary">{c.label}</span>
                          <span className="truncate text-xs text-muted-foreground">{c.dataset_id} · source {c.source_case_id}</span>
                          <small className="truncate text-xs text-muted-foreground sm:hidden">Last analysis: {actionLabel(lastAction(c))}</small>
                        </Link>
                      </TableCell>
                      <TableCell className="overflow-hidden"><Badge variant="outline" className="max-w-full rounded-sm font-normal">{sourceKind(c)}</Badge></TableCell>
                      <TableCell className="overflow-hidden"><Badge variant={c.status === "ready" ? "secondary" : "outline"} className="max-w-full font-normal">{c.status === "ready" ? "Ready" : "Blocked"}</Badge></TableCell>
                      <TableCell className="hidden max-w-0 overflow-hidden text-xs sm:table-cell">
                        <span className="block truncate text-muted-foreground" title={actionLabel(lastAction(c))}>{actionLabel(lastAction(c))}</span>
                      </TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </div>
            {selectedCase && <aside aria-label="Selected research source" className="order-1 min-w-0 xl:sticky xl:top-4 xl:order-2">
              <Card className="overflow-hidden">
                <div className="relative h-48 overflow-hidden border-b border-border bg-[#101624] sm:h-56">
                  {selectedCase.module === "surgivision" && <SurgicalAtlasView frameId={selectedCase.id} />}
                  {selectedCase.module === "dosetwin" && <DoseAtlasView caseId={selectedCase.id} />}
                  {selectedCase.module === "fistulaguard" && <SignalAtlasView recordId={selectedCase.source_case_id} />}
                </div>
                <CardHeader className="gap-2 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="outline" className="rounded-sm font-normal">{moduleLabel(selectedCase)}</Badge>
                    <Badge variant={selectedCase.status === "ready" ? "secondary" : "outline"} className="font-normal">{selectedCase.status === "ready" ? "Ready to inspect" : "Viewer only"}</Badge>
                  </div>
                  <CardTitle className="text-lg leading-snug">{selectedCase.label}</CardTitle>
                  <CardDescription>{selectedCase.dataset_id} · {selectedCase.reference_kind}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 pt-0">
                  <dl className="grid gap-2 border-y border-border py-3 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <div className="min-w-0"><dt className="text-xs text-muted-foreground">Source {sourceKind(selectedCase).toLowerCase()} ID</dt><dd className="truncate font-mono text-xs">{selectedCase.source_case_id}</dd></div>
                    <div className="min-w-0"><dt className="text-xs text-muted-foreground">Registry ID</dt><dd className="truncate font-mono text-xs">{selectedCase.id}</dd></div>
                    <div className="min-w-0"><dt className="text-xs text-muted-foreground">Last analysis action</dt><dd className="truncate text-xs text-muted-foreground">{actionLabel(lastAction(selectedCase))}</dd></div>
                  </dl>
                  {selectedCase.status === "blocked" && <p className="text-xs leading-relaxed text-muted-foreground">This source is registered, but its analysis operation is not available in the current setup.</p>}
                  <Button
                    render={<Link to={`/studio/${selectedCase.module}/cases/${encodeURIComponent(selectedCase.id)}`} />}
                    nativeButton={false}
                    className="w-full justify-between"
                    disabled={selectedCase.status === "blocked"}
                  >
                    Open analysis<ArrowRight data-icon="inline-end" />
                  </Button>
                </CardContent>
              </Card>
            </aside>}
          </div>
          {pageCount > 1 && <Pagination className="mt-4">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href={pageHref(page - 1)}
                  aria-disabled={page === 1}
                  tabIndex={page === 1 ? -1 : undefined}
                  className={page === 1 ? "pointer-events-none opacity-50" : undefined}
                  onClick={(event) => { event.preventDefault(); if (page > 1) changePage(page - 1); }}
                />
              </PaginationItem>
              {paginationItems.map((item) => item.kind === "ellipsis" ? (
                <PaginationItem key={item.key}><PaginationEllipsis /></PaginationItem>
              ) : (
                <PaginationItem key={item.number}>
                  <PaginationLink
                    href={pageHref(item.number)}
                    isActive={page === item.number}
                    aria-label={`Page ${item.number}`}
                    onClick={(event) => { event.preventDefault(); changePage(item.number); }}
                  >{item.number}</PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href={pageHref(page + 1)}
                  aria-disabled={page === pageCount}
                  tabIndex={page === pageCount ? -1 : undefined}
                  className={page === pageCount ? "pointer-events-none opacity-50" : undefined}
                  onClick={(event) => { event.preventDefault(); if (page < pageCount) changePage(page + 1); }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>}
        </>
      ) : data.length > 0 ? (
        <Empty className="mt-4 min-h-64 border border-border bg-card/40">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Search aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>No source cases match this search</EmptyTitle>
            <EmptyDescription>Try a dataset name, specialty, frame ID, recording ID, or benchmark case.</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" onClick={clearFilters}>Clear search and filters</Button>
        </Empty>
      ) : (
        <Empty className="mt-4 min-h-64 border border-border bg-card/40">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Database aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>No cases registered</EmptyTitle>
            <EmptyDescription>
              The local API only lists data after a source case is installed and
              configured. Nothing has been seeded as a sample patient.
            </EmptyDescription>
          </EmptyHeader>
          <div className="grid w-full max-w-2xl gap-2 text-left sm:grid-cols-3">
            {(Object.keys(specialtyData) as ModuleId[]).map((key) => {
              const m = specialtyData[key];
              return <Link className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-1 rounded-md border border-border bg-card p-3 hover:bg-accent" key={key} to={`/studio/${key}/cases/current`}>
                <span className="truncate text-sm font-medium">{m.name}</span>
                <small className="col-span-2 truncate text-xs text-muted-foreground">{m.source} · requirements</small>
                <ArrowRight className="col-start-2 row-start-1 size-4 self-center text-primary" />
              </Link>
            })}
          </div>
        </Empty>
      )}
    </>
  );
}

export function DomainWorkspace({ module }: { module: ModuleId }) {
  const m = specialtyData[module],
    Icon = m.icon,
    { caseId = "current" } = useParams();
  const navigate = useNavigate();
  const cases = useApi(queryKeys.cases, api.cases, [] as CaseRecord[]);
  const doseCases = module === "dosetwin" ? cases.data.filter((item) => item.module === "dosetwin") : [];
  const selectedDoseCase = caseId === "current"
    ? doseCases[0]
    : doseCases.find((item) => item.id === caseId);
  const doseCaseOptions = doseCases.map((item) => ({
    value: item.id,
    label: `${item.label} · ${item.status === "blocked" ? "viewer only" : "comparison available"}`,
  }));
  const artifactCaseId = module === "dosetwin" && selectedDoseCase?.status === "ready"
    ? selectedDoseCase.id
    : undefined;
  const doseArtifacts = useQuery({
    queryKey: ["doseArtifacts", artifactCaseId],
    queryFn: () => api.doseArtifacts(artifactCaseId!),
    enabled: Boolean(artifactCaseId),
  });
  const [directRecord,setDirectRecord]=useState<CaseRecord|null>(null)
  const [directRecordLoading,setDirectRecordLoading]=useState(false)
  const [surgicalClipIds,setSurgicalClipIds]=useState<string[]>([])
  useEffect(()=>{
    if(module!=="surgivision"){setSurgicalClipIds([]);return}
    let live=true
    api.surgicalClips().then(clips=>{if(live)setSurgicalClipIds(clips.map(clip=>clip.clip_id))}).catch(()=>{if(live)setSurgicalClipIds([])})
    return()=>{live=false}
  },[module])
  useEffect(()=>{
    if(caseId==="current"||cases.loading||cases.error||cases.data.some(item=>item.id===caseId)){
      setDirectRecordLoading(false)
      if(caseId==="current"||cases.data.some(item=>item.id===caseId))setDirectRecord(null)
      return
    }
    let live=true
    setDirectRecordLoading(true)
    api.caseDetails(caseId).then(record=>{if(live)setDirectRecord(record.module===module?record:null)}).catch(()=>{if(live)setDirectRecord(null)}).finally(()=>{if(live)setDirectRecordLoading(false)})
    return()=>{live=false}
  },[caseId,cases.data,cases.error,cases.loading,module])
  if (cases.loading||directRecordLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Checking the local case registry</span>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[360px] w-full" />
      </div>
    );
  }
  if (cases.error) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Local case registry unavailable</AlertTitle>
          <AlertDescription>{cases.error}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry case registry
        </Button>
      </div>
    );
  }
  const listedRecord = caseId === "current"
    ? cases.data.find((c) => c.module === module)
    : cases.data.find((c) => c.id === caseId)
  const record = listedRecord??(directRecord?.id===caseId?directRecord:undefined)
  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link to="/studio/cases">Case registry</Link>
        <span aria-hidden="true">/</span>
        <span>{m.name}</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="font-medium text-foreground">{record?.source_case_id ?? "No source case"}</span>
      </nav>
      <header className="mb-5 flex w-full min-w-0 flex-col gap-4 border-b border-border pb-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div className="grid w-full min-w-0 gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="grid size-8 place-items-center rounded-md bg-secondary text-primary"><Icon aria-hidden="true"/></span>
            <span>{m.name}</span><span aria-hidden="true">/</span><span>{m.short}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{module === "surgivision" ? "SurgiVision surgical media review" : record?.label ?? m.subtitle}</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {record
              ? module === "surgivision"
              ? `Choose a source-specific mode below: full-rate Cholec80 cholecystectomy video with frame-matched phase labels, the separate Appendix300 appendectomy event video, CholecT50 sampled frames with their matching labels, or Endoscapes annotated stills (${record.source_case_id}).`
                : `Source case ${record.source_case_id} · ${record.dataset_id} · ${record.reference_kind}`
              : "No source case has been selected for this workspace."}
          </p>
          {module === "dosetwin" && doseCases.length > 1 && (
            <Field className="mt-2 grid w-full max-w-xl gap-1.5">
              <FieldLabel htmlFor="dosetwin-case-picker">DoseTwin source case</FieldLabel>
              <Select
                items={doseCaseOptions}
                value={selectedDoseCase?.id ?? null}
                onValueChange={(next) => {
                  if (next) navigate(`/studio/dosetwin/cases/${encodeURIComponent(next)}`);
                }}
              >
                <SelectTrigger id="dosetwin-case-picker" className="w-full">
                  <SelectValue placeholder="Choose an installed DoseTwin case" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {doseCases.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label} · {item.status === "blocked" ? "viewer only" : "comparison available"}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <small className="text-xs leading-5 text-muted-foreground">
                Each case opens by its own ID and keeps its own saved viewer settings.
              </small>
            </Field>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 2xl:w-auto 2xl:justify-end">
          <SourceBadge kind={record?.status === "ready" ? "ready" : "blocked"}>
            {record?.status === "blocked" && module === "dosetwin"
              ? "Viewer only · analysis and imports disabled"
              : record ? "Source configured" : "Dataset required"}
          </SourceBadge>
          <span className="text-xs text-muted-foreground">For research and education</span>
        </div>
      </header>
      {record && module === "dosetwin" ? (
        <Suspense
          fallback={
            <div className="domain-view-loading">
              Loading DoseTwin volume tools…
            </div>
          }
        >
          <DoseViewer key={record.id} caseId={record.id} viewerOnly={record.status === "blocked"} />
        </Suspense>
      ) : record && module === "surgivision" ? (
        <Suspense
          fallback={
            <div className="domain-view-loading">
              Loading the Endoscapes image tools…
            </div>
          }
        >
          <SurgiViewer
            key={record.id}
            frameId={record.id}
            availableFrameIds={cases.data
              .filter((item) => item.module === "surgivision")
              .map((item) => item.id)}
          />
        </Suspense>
      ) : record && module === "fistulaguard" ? (
        <Suspense
          fallback={
            <div className="domain-view-loading">
              Loading FiSaV signal tools…
            </div>
          }
        >
          <FistulaViewer
            key={record.source_case_id}
            recordId={record.source_case_id}
            availableRecordIds={cases.data
              .filter((item) => item.module === "fistulaguard")
              .map((item) => item.source_case_id)}
          />
        </Suspense>
      ) : record ? (
        <div className="viewer-shell">
          <div className="viewer-topline">
            <div>
              <b>{m.name} research viewer</b>
              <span>Source identity: {record.id}</span>
            </div>
            <SourceBadge kind="blocked">
              Verified signal data not installed
            </SourceBadge>
          </div>
          <div className="viewer-unavailable">
            <span className={`large-module-icon ${m.color}`}>
              <Icon size={25} />
            </span>
            <h2>The source case metadata is available</h2>
            <p>
              The case record does not imply that signal files are present. This
              interface shows them only after a permitted local source is
              installed and parsed.
            </p>
            <ul>
              {m.blockers.map((b) => (
                <li key={b}>
                  <CircleAlert size={14} />
                  {b}
                </li>
              ))}
            </ul>
            <Button render={<a href={m.sourceUrl} target="_blank" rel="noreferrer" />} nativeButton={false} variant="ghost" size="sm">
              Review {m.source} source <ExternalLink data-icon="inline-end" />
            </Button>
          </div>
        </div>
      ) : (
        <EmptySource module={module} />
      )}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle className="text-base">Research methods in this workspace</CardTitle>
          <CardDescription>Each row names a viewer operation or a specific unmet execution gate.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Table className="table-fixed">
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="w-full whitespace-normal">Method or view</TableHead><TableHead className="w-28 text-right">Availability</TableHead></TableRow></TableHeader>
            <TableBody>
            {m.tasks.map((task, i) => {
              const doseViewerMethod = module === "dosetwin" && [
                "CT, reference dose and ROI masks",
                "Index-space linked slice views",
                "Dose statistics and DVH",
              ].includes(task);
              const viewerOnlyAvailable = module === "dosetwin" && record?.status === "blocked" && doseViewerMethod;
              const requiredClipAvailable=task==="Cholec80 full-rate video with frame-matched phase labels"
                ?surgicalClipIds.includes("cholect80-video01")
                :task==="Licensed Appendix300 video excerpt playback"
                  ?surgicalClipIds.some(id=>id.startsWith("appendix300-"))
                  :true;
              const available = Boolean(record && (record.status === "ready" || viewerOnlyAvailable) && requiredClipAvailable);
              return (
                <TableRow key={task}>
                  <TableCell className="whitespace-normal"><span className="mr-2 inline-block font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>{task}</TableCell>
                  <TableCell className="text-right"><Badge variant={available ? "secondary" : "outline"}>{viewerOnlyAvailable ? "Viewer-only" : available ? "Source-backed" : "Awaiting source"}</Badge></TableCell>
                </TableRow>
              );
            })}
            {m.unavailableMethods.map(({ task, reason }) => {
              const comparisonInstalled = module === "dosetwin" && task === "Reference-versus-prediction comparison" && (doseArtifacts.data?.length ?? 0) > 0;
              const currentReason = comparisonInstalled
                ? "An authentic same-case prediction is imported and validated on this case's grid. This is a reference comparison, not inference or clinical evaluation."
                : module === "dosetwin" && record?.status === "blocked"
                  ? "This installed source profile is viewer-only. Analysis, dose import, comparison, and report generation are disabled."
                  : reason;
              return (
                <TableRow key={task}>
                  <TableCell className="whitespace-normal"><span className="mr-2 inline-block font-mono text-xs text-muted-foreground">—</span>{task}<p className="mb-0 mt-1 text-xs leading-5 text-muted-foreground">{currentReason}</p></TableCell>
                  <TableCell className="text-right"><Badge variant={comparisonInstalled ? "secondary" : "outline"}>{comparisonInstalled ? "Locally imported" : "Blocked"}</Badge></TableCell>
                </TableRow>
              );
            })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Badge variant="outline" className="w-fit">Source record</Badge>
            <CardTitle className="text-base">{m.source}</CardTitle>
            <CardDescription>
            {module === "surgivision"
              ? "Official COCO boxes and image-level reference labels are served from a checksum-verified local source."
              : module === "dosetwin"
                ? "Benchmark arrays preserve index-space geometry and dose units."
                : module === "fistulaguard"
                  ? "All 59 source recordings are checksum-verified from the FiSaV dataset; units and diagnostic labels remain unspecified."
                  : "AVF recordings require channel, sensor and sample-rate metadata."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Dataset documentation</span>
              <Button render={<a href={m.sourceUrl} target="_blank" rel="noreferrer" />} nativeButton={false} variant="link" size="sm" className="h-auto p-0">
                Open source <ExternalLink data-icon="inline-end" />
              </Button>
            </div>
            <div className="flex items-start gap-2 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
              <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Source assets are loaded locally. Remote files do not enter the viewer automatically.
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function Models() {
  const { data, loading, error } = useApi(queryKeys.models, api.models, [] as ModelRecord[]);
  const [moduleFilter, setModuleFilter] = useState<"all" | ModelRecord["module"]>("all");
  const [readinessFilter, setReadinessFilter] = useState<ModelReadinessFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const visibleModels = useMemo(
    () => filterModelCatalog(data, { module: moduleFilter, readiness: readinessFilter, search: searchText }),
    [data, moduleFilter, readinessFilter, searchText],
  );
  const selectedModel = visibleModels.find((model) => model.id === selectedModelId) ?? visibleModels[0];
  const readyCount = data.filter((model) => model.readiness === "ready").length;
  const gatedCount = data.length - readyCount;
  const modelWorkspace = selectedModel ? `/studio/${selectedModel.module}/cases/current` : "/studio/cases";
  const moduleLabels: Record<ModelRecord["module"], string> = {
    surgivision: "SurgiVision",
    dosetwin: "DoseTwin",
    fistulaguard: "FistulaGuard",
  };
  return (
    <>
      <Header
        eyebrow="Professional studio / Registry"
        title="Model lab"
        description="Readiness is specific to each operation, checkpoint, runtime and compatible source dataset."
      />
      <Alert className="mb-4 border-primary/25 bg-primary/5 [&>svg]:mt-0.5">
        <Microscope />
        <AlertTitle>Model execution follows source and checkpoint gates</AlertTitle>
        <AlertDescription>CVS-AdaptNet completed a real split evaluation. Single-frame runs remain locked until its checkpoint identity and specific terms are independently confirmed.</AlertDescription>
      </Alert>
      {error ? (
        <Alert variant="destructive"><CircleAlert/><AlertTitle>Model registry is unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-y border-border py-2 text-sm">
            <span><strong className="tabular-nums">{loading ? "—" : data.length}</strong> registered methods</span>
            <span className="text-xs text-muted-foreground">{loading ? "Checking catalog status…" : `${readyCount} marked ready · ${gatedCount} gated or unverified`}</span>
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(16rem,1fr)_auto]">
            <InputGroup className="h-9 w-full">
              <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
              <InputGroupInput aria-label="Search model methods" placeholder="Search methods, operations, terms…" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
              {searchText && <InputGroupAddon align="inline-end"><InputGroupButton aria-label="Clear model search" onClick={() => setSearchText("")}><X aria-hidden="true" /></InputGroupButton></InputGroupAddon>}
            </InputGroup>
            <ToggleGroup multiple={false} value={[readinessFilter]} onValueChange={(value) => { if (value[0]) setReadinessFilter(value[0] as ModelReadinessFilter); }} aria-label="Filter methods by execution readiness" className="flex h-auto flex-wrap justify-start gap-1 rounded-lg border border-border bg-muted/35 p-1">
              <ToggleGroupItem value="all" aria-label="All readiness states" className="h-8 px-3">All</ToggleGroupItem>
              <ToggleGroupItem value="ready" aria-label="Ready methods" className="h-8 px-3">Ready</ToggleGroupItem>
              <ToggleGroupItem value="gated" aria-label="Gated methods" className="h-8 px-3">Gated</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <ToggleGroup multiple={false} value={[moduleFilter]} onValueChange={(value) => { if (value[0]) setModuleFilter(value[0] as typeof moduleFilter); }} aria-label="Filter model methods by research workspace" className="mb-4 flex h-auto flex-wrap justify-start gap-1 rounded-lg border border-border bg-muted/35 p-1">
            <ToggleGroupItem value="all" aria-label="All methods" className="h-8 px-3">All methods</ToggleGroupItem>
            <ToggleGroupItem value="surgivision" aria-label="SurgiVision methods" className="h-8 px-3">SurgiVision</ToggleGroupItem>
            <ToggleGroupItem value="dosetwin" aria-label="DoseTwin methods" className="h-8 px-3">DoseTwin</ToggleGroupItem>
            <ToggleGroupItem value="fistulaguard" aria-label="FistulaGuard methods" className="h-8 px-3">FistulaGuard</ToggleGroupItem>
          </ToggleGroup>
          <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,.85fr)]">
            <Card size="sm" className="min-w-0 overflow-hidden">
              <CardHeader className="border-b border-border px-4 py-3">
                <CardTitle className="text-base">{visibleModels.length} source-linked methods</CardTitle>
                <CardDescription>Choose a method to inspect its provenance and execution gate.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table className="table-fixed">
                  <TableHeader className="bg-muted/70">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[56%] sm:w-[46%] xl:w-[42%] 2xl:w-[34%]">Method</TableHead>
                      <TableHead className="hidden sm:table-cell sm:w-[22%] xl:w-[22%] 2xl:w-[16%]">Specialty</TableHead>
                      <TableHead className="w-[22%] sm:w-[16%] xl:w-[18%] 2xl:w-[20%]">Operation</TableHead>
                      <TableHead className="w-[22%] sm:w-[16%] xl:w-[18%] 2xl:w-[14%]">Status</TableHead>
                      <TableHead className="hidden 2xl:table-cell 2xl:w-[16%]">License</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleModels.map((model) => {
                      const selected = selectedModel?.id === model.id;
                      return <TableRow key={model.id} data-state={selected ? "selected" : undefined} className={selected ? "bg-primary/5" : undefined}>
                        <TableCell className="max-w-0 overflow-hidden">
                          <button type="button" aria-pressed={selected} onClick={() => setSelectedModelId(model.id)} className="grid w-full min-w-0 gap-0.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <span className="truncate font-medium text-foreground">{model.name}</span>
                            <span className="truncate font-mono text-[10px] text-muted-foreground">{model.id}</span>
                          </button>
                        </TableCell>
                        <TableCell className="hidden truncate text-xs text-muted-foreground sm:table-cell">{moduleLabels[model.module]}</TableCell>
                        <TableCell className="overflow-hidden">
                          <span className="block truncate font-mono text-[10px] text-muted-foreground" title={model.operation_ids.join(", ")}>{model.operation_ids.length === 1 ? model.operation_ids[0] : `${model.operation_ids[0] ?? "None"}${model.operation_ids.length > 1 ? ` +${model.operation_ids.length - 1}` : ""}`}</span>
                        </TableCell>
                        <TableCell className="overflow-hidden"><Badge variant={model.readiness === "ready" ? "secondary" : "outline"} className="max-w-full truncate font-normal">{model.readiness.replaceAll("-", " ")}</Badge></TableCell>
                        <TableCell className="hidden max-w-0 overflow-hidden 2xl:table-cell"><span className="block truncate text-xs text-muted-foreground" title={model.source_license}>{model.source_license}</span></TableCell>
                      </TableRow>;
                    })}
                    {loading && <TableRow><TableCell colSpan={5}><div className="grid gap-2 py-2"><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/></div></TableCell></TableRow>}
                    {!loading && visibleModels.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 whitespace-normal text-center text-sm text-muted-foreground">{searchText || readinessFilter !== "all" ? "No registered methods match this search and filter." : "No methods are registered for this workspace."}</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {selectedModel ? <aside aria-label="Selected method details" className="min-w-0 xl:sticky xl:top-4"><Card size="sm" className="min-w-0 overflow-hidden">
              <CardHeader className="gap-3 border-b border-border bg-muted/20 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium text-primary">{moduleLabels[selectedModel.module]} · method record</span><Badge variant="outline" className={selectedModel.readiness === "ready" ? "border-primary/40 bg-primary/5 text-primary" : "border-warning/40 bg-warning/10 text-warning"}>{selectedModel.readiness.replaceAll("-", " ")}</Badge></div>
                <div><CardTitle className="text-xl tracking-tight sm:text-2xl">{selectedModel.name}</CardTitle><CardDescription className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">{selectedModel.details}</CardDescription></div>
                <div className="flex flex-wrap items-center gap-2 pt-1"><Link to={modelWorkspace} className={buttonVariants({variant:"outline",size:"sm"})}><Microscope data-icon="inline-start"/>Inspect source workspace</Link><a className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary underline-offset-4 hover:underline" href={selectedModel.upstream_url} target="_blank" rel="noreferrer">Upstream method <ExternalLink size={13}/></a></div>
              </CardHeader>
              <CardContent className="grid gap-4 px-4 py-4 sm:px-5">
                <section aria-labelledby="method-provenance-title"><h2 id="method-provenance-title" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Provenance and terms</h2><dl className="grid gap-2 sm:grid-cols-2"><div className="min-w-0 rounded-md border border-border px-3 py-2"><dt className="text-[11px] text-muted-foreground">Pinned source revision</dt><dd className="mt-1 break-all font-mono text-xs text-foreground">{selectedModel.source_revision}</dd></div><div className="min-w-0 rounded-md border border-border px-3 py-2"><dt className="text-[11px] text-muted-foreground">License / use terms</dt><dd className="mt-1 text-xs leading-5 text-foreground">{selectedModel.source_license}</dd></div></dl></section>
                <section aria-labelledby="method-operations-title"><h2 id="method-operations-title" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registered operations</h2><div className="flex flex-wrap gap-1.5">{selectedModel.operation_ids.map((operation) => <Badge variant="secondary" key={operation}>{operation}</Badge>)}</div></section>
                <ModelValidationPanel key={selectedModel.id} model={selectedModel}/>
              </CardContent>
            </Card></aside> : <Card size="sm" className="min-h-64"><CardContent className="grid min-h-64 place-content-center text-center text-sm text-muted-foreground">{loading ? "Loading model registry…" : "No method is available for this filter."}</CardContent></Card>}
          </div>
        </>
      )}
    </>
  );
}

function ModelValidationPanel({model}:{model:ModelRecord}){
  const caseQuery=useQuery({queryKey:queryKeys.cases,queryFn:api.cases})
  const compatibleCases=useMemo(()=>caseQuery.data?.filter(item=>item.module===model.module&&item.status==='ready')??[],[caseQuery.data,model.module])
  const [selectedCaseId,setSelectedCaseId]=useState('')
  const [operationId,setOperationId]=useState('')
  const [validation,setValidation]=useState<ModelValidation|null>(null)
  const [validationLoading,setValidationLoading]=useState(false)
  const [validationError,setValidationError]=useState('')
  const caseId=compatibleCases.some(item=>item.id===selectedCaseId)
    ?selectedCaseId
    :(compatibleCases.find(item=>model.id==='cvs-adaptnet'&&item.dataset_id==='Endoscapes-BBox201')??compatibleCases[0])?.id??''
  const selectedOperationId=model.operation_ids.includes(operationId)?operationId:model.operation_ids[0]??''
  useEffect(()=>{
    setValidation(null)
    setValidationError('')
    setValidationLoading(false)
  },[model.id,caseId,selectedOperationId])
  const checkExecutionGate=async()=>{
    if(!caseId||!selectedOperationId||validationLoading)return
    setValidationLoading(true);setValidationError('')
    try{setValidation(await api.validateModel(model.id,caseId,selectedOperationId))}
    catch(error){setValidationError(error instanceof Error?error.message:'The source-specific execution gate could not be checked')}
    finally{setValidationLoading(false)}
  }
  const validationCase=compatibleCases.find(item=>item.id===caseId)
  return <section aria-labelledby="model-source-validation-title" className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
    <div><h2 id="model-source-validation-title" className="m-0 text-sm font-semibold">Validate this operation on a source case</h2><p className="mb-0 mt-1 text-xs leading-5 text-muted-foreground">The catalog describes the method generally. This check asks the API about the selected case, operation, installed adapter and current execution gates.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <ResearchCasePicker id="model-validation-case" label="Installed source case" cases={compatibleCases} value={caseId} onValueChange={setSelectedCaseId} loading={caseQuery.isLoading} error={caseQuery.error instanceof Error?caseQuery.error.message:''} placeholder="Choose a compatible source case"/>
      {model.operation_ids.length>1?<Field className="grid min-w-0 gap-1.5"><FieldLabel htmlFor="model-validation-operation">Registered operation</FieldLabel><Select items={model.operation_ids.map(operation=>({label:operation,value:operation}))} value={selectedOperationId||null} onValueChange={next=>{if(typeof next==='string')setOperationId(next)}}><SelectTrigger id="model-validation-operation" className="w-full"><SelectValue placeholder="Choose an operation"/></SelectTrigger><SelectContent><SelectGroup>{model.operation_ids.map(operation=><SelectItem key={operation} value={operation}>{operation}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>:<div className="grid content-start gap-1.5"><span className="text-sm font-medium">Registered operation</span><Badge variant="secondary" className="w-fit font-mono">{selectedOperationId}</Badge></div>}
    </div>
    <Button variant="outline" size="sm" className="w-fit" disabled={!caseId||!selectedOperationId||validationLoading} onClick={()=>void checkExecutionGate()}>{validationLoading?<><LoaderCircle data-icon="inline-start" className="animate-spin"/>Checking gate…</>:'Check source-specific gate'}</Button>
    {validationLoading&&<div className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle className="size-4 animate-spin"/>Checking the selected case with the execution gate…</div>}
    {validationError&&<Alert variant="destructive"><CircleAlert/><AlertTitle>Case-specific validation failed</AlertTitle><AlertDescription>{validationError}</AlertDescription></Alert>}
    {validation&&<Alert className={validation.executable?'border-primary/30 bg-primary/5':'border-warning/35 bg-warning/5'} role={validation.executable?'status':'alert'}><LockKeyhole/><AlertTitle>{validation.executable?'Operation gate passed for this case':'Operation is blocked for this case'}</AlertTitle><AlertDescription><span className="block">{validationCase?`${validationCase.label} · ${validationCase.dataset_id}`:'Selected installed source'} · {selectedOperationId}</span>{validation.blockers.length>0?<ul className="mt-2 grid gap-1 pl-4">{validation.blockers.map((blocker,index)=><li key={`${index}:${blocker}`}>{blocker}</li>)}</ul>:<p className="mb-0 mt-2">The API reports no current execution blockers for this source and operation.</p>}</AlertDescription></Alert>}
    {!caseQuery.isLoading&&!caseQuery.error&&compatibleCases.length===0&&<p className="m-0 text-xs leading-5 text-muted-foreground">No ready {model.module} source case is installed. Install and verify a compatible source before checking this method.</p>}
  </section>
}

function EmptyWork({
  icon: Icon,
  title,
  body,
  link,
  linkText,
}: {
  icon: typeof FileText;
  title: string;
  body: string;
  link: string;
  linkText: string;
}) {
  return (
    <Empty className="mt-5 min-h-64 border border-dashed border-border bg-card/40">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon aria-hidden="true" /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{body}</EmptyDescription>
      </EmptyHeader>
      <Button render={<Link to={link} />} nativeButton={false} variant="outline">
        {linkText}<ArrowRight data-icon="inline-end" />
      </Button>
    </Empty>
  );
}
export function Experiments() {
  const [searchParams] = useSearchParams();
  const requestedRunId = searchParams.get("runId") ?? "";
  const [cases, setCases] = useState<CaseRecord[]>([]),
    [runs, setRuns] = useState<DoseTwinRunRecord[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [selectedCase, setSelectedCase] = useState(""),
    [selectedRun, setSelectedRun] = useState<DoseTwinRunRecord | null>(null),
    [report, setReport] = useState<EvidenceReport | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([api.cases(), api.runs()])
      .then(([available, records]) => {
        if (live) {
          setCases(available.filter((item) => item.module === "dosetwin"));
          const doseRuns = records.filter(
            (item): item is DoseTwinRunRecord =>
              item.operation_id === "openkbp.case_summary",
          );
          setRuns(doseRuns);
          setSelectedRun(doseRuns.find((item) => item.id === requestedRunId) ?? doseRuns[0] ?? null);
        }
      })
      .catch((e: unknown) => {
        if (live)
          setError(
            e instanceof Error
              ? e.message
              : "The local research API is unavailable",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [requestedRunId]);
  const caseId = selectedCase || cases[0]?.id || "";
  const startRun = async () => {
    if (!caseId) return;
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const record = await api.createRun(caseId);
      setSelectedRun(record);
      setRuns((current) => [
        record,
        ...current.filter((item) => item.id !== record.id),
      ]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The analysis could not be saved",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveReport = async (runId: string) => {
    setBusy(true);
    setError("");
    try {
      const viewer = selectedRun
        ? savedViewerState(selectedRun.case_id)
        : undefined;
      const saved = await api.createReport(runId, viewer);
      setReport(saved);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The evidence report could not be saved",
      );
    } finally {
      setBusy(false);
    }
  };
  const metrics = selectedRun?.results?.available_rois;
  return (
    <>
      <Header
        eyebrow="Professional studio / Research"
        title="Experiments"
        description="Run a reproducible, source-derived OpenKBP case summary. This operation calculates benchmark dose statistics; it does not run a prediction model."
        action={
          <Button render={<Link to="/studio/cases" />} nativeButton={false} variant="ghost" size="sm">
            <Database data-icon="inline-start" />
            Case registry
          </Button>
        }
      />
      <Alert className="mb-4 border-primary/25 bg-primary/5 [&>svg]:mt-0.5">
        <Workflow />
        <AlertTitle>Enabled operation · OpenKBP reference summary</AlertTitle>
        <AlertDescription>
            Validates the installed sparse arrays, computes per-ROI benchmark
            metrics, records source hashes and reuses an identical saved run for
            the same input.
        </AlertDescription>
      </Alert>
      {loading ? (
        <div role="status" className="mt-4 grid min-h-64 place-items-center rounded-lg border border-border bg-card px-6 py-5 text-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />
          <span>Loading local cases and saved runs…</span>
          </div>
        </div>
      ) : cases.length === 0 ? (
        <EmptyWork
          icon={FlaskConical}
          title="No authorized case is installed"
          body="An analysis run requires an installed OpenKBP case. No sample patient or dose map is seeded."
          link="/studio/cases"
          linkText="Review the case registry"
        />
      ) : (
        <>
          <Card className="my-3">
            <CardContent className="flex flex-col items-stretch justify-between gap-4 pt-4 sm:flex-row sm:items-end">
            <div>
              <div className="eyebrow">Source case</div>
              <ResearchCasePicker id="run-case-select" label="Select source case" cases={cases} value={caseId} onValueChange={setSelectedCase} placeholder="Choose an installed case" />
            </div>
            <Button
              type="button"
              onClick={startRun}
              disabled={busy}
            >
              {busy ? <LoaderCircle data-icon="inline-start" /> : <FlaskConical data-icon="inline-start" />}
              Run case summary
            </Button>
            </CardContent>
          </Card>
          {error && (
            <Alert variant="destructive"><CircleAlert/><AlertTitle>Research operation unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
          )}
          {selectedRun?.results && (
            <Card className="my-3">
              <CardHeader className="px-4 pt-4 sm:px-5">
                <CardTitle>
                  <h2 className="m-0 text-sm font-semibold">OpenKBP case summary</h2>
                </CardTitle>
                <CardDescription>
                  {selectedRun.case_id} · run {selectedRun.id} ·{" "}
                  {selectedRun.source_kind} reference data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-3 mt-1 text-xs text-muted-foreground">
                  Grid {selectedRun.results.grid_shape.join(" × ")} · voxel
                  spacing {selectedRun.results.voxel_dimensions_mm.join(" × ")}{" "}
                  mm · source revision{" "}
                  {String(
                    selectedRun.provenance.source_revision ?? "unrecorded",
                  ).slice(0, 12)}
                </p>
                <Table className="min-w-[650px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col" className="text-left">Structure</TableHead>
                        <TableHead scope="col" className="text-right">Voxels</TableHead>
                        <TableHead scope="col" className="text-right">Mean (Gy)</TableHead>
                        <TableHead scope="col" className="text-right">D0.1cc (Gy)</TableHead>
                        <TableHead scope="col" className="text-right">D95 (Gy)</TableHead>
                        <TableHead scope="col" className="text-right">V20Gy (%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(metrics ?? {}).map(([name, value]) => (
                        <TableRow key={name}>
                          <TableHead scope="row" className="text-left">{name}</TableHead>
                          <TableCell className="text-right tabular-nums">{value.voxels.toLocaleString()}</TableCell>
                          <TableCell className="text-right tabular-nums">{value.dmean_gy?.toFixed(2) ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{value.d0_1cc_gy_openkbp?.toFixed(2) ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {value.d95_gy_interpolated?.toFixed(2) ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{value.v20gy_percent?.toFixed(1) ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => saveReport(selectedRun.id)}
                    disabled={busy}
                  >
                    <FileText data-icon="inline-start" />
                    Save evidence report
                  </Button>
                  {report && (
                    <Link className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline" to="/studio/reports">
                      Report {report.id.slice(0, 16)} saved{" "}
                      <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Per-ROI metrics follow the pinned OpenKBP evaluator's
                  percentile convention. Reference dose is not a delivered
                  clinical plan; this summary does not establish model or
                  clinical validity.
                </p>
              </CardContent>
            </Card>
          )}
          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Saved operations</div>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                {runs.length
                  ? `${runs.length} saved run${runs.length === 1 ? "" : "s"}`
                  : "No analysis runs yet"}
              </h2>
            </div>
          </div>
          {runs.length ? (
            <div className="border-t border-border">
              {runs.map((run) => (
                <Button
                  type="button"
                  variant="ghost"
                  key={run.id}
                  className="h-auto min-h-[62px] w-full justify-start gap-3 rounded-none border-b border-border px-3 py-3 text-left whitespace-normal hover:bg-accent/50 aria-pressed:bg-accent max-sm:gap-2 max-sm:px-1"
                  aria-pressed={selectedRun?.id === run.id}
                  onClick={() => {
                    setSelectedRun(run);
                    setReport(null);
                  }}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-primary">
                    <FlaskConical size={17} />
                  </span>
                  <span className="grid min-w-0 flex-1 gap-1">
                    <b className="truncate text-sm font-medium">{run.operation_id}</b>
                    <small className="truncate text-xs text-muted-foreground">
                      {run.case_id} · {run.source_kind} · {run.status}
                    </small>
                  </span>
                  <span className="max-w-[120px] truncate font-mono text-[11px] text-muted-foreground max-sm:max-w-[70px]">{run.id}</span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </Button>
              ))}
            </div>
          ) : (
            <Empty className="mt-4 min-h-56 border border-dashed border-border bg-card/40">
              <EmptyHeader>
                <EmptyMedia variant="icon"><FlaskConical aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>No saved analysis runs yet</EmptyTitle>
                <EmptyDescription>
                Run the enabled OpenKBP summary to save an idempotent result
                with source provenance.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </>
      )}
    </>
  );
}
type ReportFeedItem =
  | { kind: "openkbp-run"; id: string; created_at: string; report: EvidenceReport }
  | { kind: "dosetwin-comparison"; id: string; created_at: string; report: EvidenceReport }
  | { kind: "surgivision-frame"; id: string; created_at: string; report: EvidenceReport }
  | { kind: "fisav-comparison"; id: string; created_at: string; comparison: SignalWindowComparison };

const comparisonPageSize = 25;

export function Reports() {
  const { data, reloading, error, hasMoreComparisons, loadingMoreComparisons, moreError, loadMoreComparisons } = useReportList();
  const download = (report: EvidenceReport) => {
    const blob = new Blob([JSON.stringify(report.document, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `medforge-${report.document.case?.source_case_id ?? report.case_id}-${report.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const downloadComparison = (comparison: SignalWindowComparison) => {
    const evidenceDocument = buildSignalComparisonReport(comparison),
      blob = new Blob([JSON.stringify(evidenceDocument, null, 2)], { type: "application/json" }),
      url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `medforge-${comparison.case_id.replaceAll(":", "-")}-${comparison.id}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <Header
        eyebrow="Professional studio / Evidence"
        title="Evidence reports"
        description="DoseTwin runs, SurgiVision frame reviews and FiSaV comparisons share one source-grounded evidence index."
      />
      <Alert className="mb-4 border-primary/25 bg-primary/5 [&>svg]:mt-0.5">
        <FileText />
        <AlertTitle>Research evidence with its source and method attached</AlertTitle>
        <AlertDescription>
            Each export preserves the original case or recording, source hashes,
            calculated values and limitations. These are research records, not
            clinical recommendations or model predictions.
        </AlertDescription>
      </Alert>
      {error ? (
        <Alert variant="destructive"><CircleAlert/><AlertTitle>Saved reports could not be loaded</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      ) : reloading ? (
        <div role="status" className="mt-4 grid min-h-64 place-items-center rounded-lg border border-border bg-card px-6 py-5 text-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />
          <span>Loading saved reports…</span>
          </div>
        </div>
      ) : data.length ? (
        <div className="grid gap-3">
          {data.map((entry) => {
            if (entry.kind === "fisav-comparison") return (
            <Card className="m-0" key={entry.id}>
              <CardHeader className="px-4 pt-4 sm:px-5">
                <CardTitle><h2 className="m-0 text-sm font-semibold">FiSaV measured-window comparison</h2></CardTitle>
                <CardDescription>
                  FiSaV · {entry.comparison.case_id.split(":").at(-1)} · {new Date(entry.created_at).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 items-center gap-2 border-y py-2.5 text-[11px] tabular-nums text-muted-foreground sm:grid-cols-[minmax(180px,1fr)_minmax(130px,.6fr)_auto_auto]">
                  <span>Channel {entry.comparison.channel}</span>
                  <span>{entry.comparison.selected_window.source_sample_rate_hz.toLocaleString()} Hz · {entry.comparison.duration_sec} s per window</span>
                  <span>Source hash {entry.comparison.source_sha256.slice(0, 16)}…</span>
                  <Badge variant="outline" className="source-badge ready">saved comparison</Badge>
                </div>
                <p className="mt-3 border-l-2 border-primary/60 bg-muted/50 px-2.5 py-2 text-[11px] tabular-nums text-muted-foreground">
                  Selected {entry.comparison.selected_window.start_sec.toFixed(4)}–{(entry.comparison.selected_window.start_sec + entry.comparison.duration_sec).toFixed(4)} s · {entry.comparison.selected_window.sample_count.toLocaleString()} samples; reference {entry.comparison.reference_window.start_sec.toFixed(4)}–{(entry.comparison.reference_window.start_sec + entry.comparison.duration_sec).toFixed(4)} s · {entry.comparison.reference_window.sample_count.toLocaleString()} samples.
                </p>
                <div className="mt-3 border-b">
                  <Table className="min-w-[600px]">
                    <TableHeader><TableRow><TableHead scope="col" className="text-left">Measured feature</TableHead><TableHead scope="col" className="text-right">Selected</TableHead><TableHead scope="col" className="text-right">Reference</TableHead><TableHead scope="col" className="text-right">Selected − reference</TableHead></TableRow></TableHeader>
                    <TableBody>{entry.comparison.feature_differences.map((feature) => {
                      const isFraction=feature.name.endsWith("_fraction");
                      const selected=isFraction?`${(feature.selected*100).toFixed(2)}%`:feature.selected.toPrecision(6);
                      const reference=isFraction?`${(feature.reference*100).toFixed(2)}%`:feature.reference.toPrecision(6);
                      const delta=isFraction?(feature.selected-feature.reference)*100:feature.selected-feature.reference;
                      const difference=isFraction?`${delta>=0?"+":""}${delta.toFixed(2)} percentage points`:`${delta>=0?"+":""}${delta.toPrecision(6)} ${feature.unit}`;
                      return <TableRow key={feature.name}><TableHead scope="row" className="text-left">{feature.name.replaceAll("_"," ")}</TableHead><TableCell className="text-right tabular-nums">{selected}</TableCell><TableCell className="text-right tabular-nums">{reference}</TableCell><TableCell className="text-right tabular-nums">{difference}</TableCell></TableRow>
                    })}</TableBody>
                  </Table>
                </div>
                <ul className="my-3 grid gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">{entry.comparison.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
                <Button render={<Link to={`/studio/fistulaguard/cases/${encodeURIComponent(entry.comparison.case_id)}?comparison=${encodeURIComponent(entry.comparison.id)}`} />} nativeButton={false} variant="outline" size="sm" className="mr-2"><ExternalLink data-icon="inline-start"/>Open reviewed FiSaV windows</Button>
                <Button variant="ghost" size="sm" onClick={() => downloadComparison(entry.comparison)}><FileText data-icon="inline-start"/>Download JSON evidence</Button>
              </CardContent>
            </Card>
            );
            const report=entry.report;
            if(entry.kind==="surgivision-frame"){
              const frame=report.document.case;
              const annotations=report.document.evidence?.reference_annotations??[];
              const cvs=report.document.evidence?.cvs_source_values??[];
              return <Card className="overflow-hidden" key={report.id}>
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="outline" className="text-primary">SurgiVision · source review</Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">{new Date(report.created_at+"Z").toLocaleString()}</span>
                  </div>
                  <CardTitle>{report.document.title??"Endoscapes source frame evidence"}</CardTitle>
                  <CardDescription>Endoscapes-BBox201 · {frame?.split??"split unavailable"} split · video {frame?.video_id??"—"} · frame {frame?.frame_number??"—"} · {frame?.width_px??"—"} × {frame?.height_px??"—"} px</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-3 border-y py-3 text-sm sm:grid-cols-2">
                    <div className="grid gap-1"><span className="text-xs text-muted-foreground">Source annotation record</span><span>{annotations.length} annotations · {report.document.display_state?.show_annotations?"overlays shown":"overlays hidden"}{report.document.display_state?.selected_annotation_id!==null&&report.document.display_state?.selected_annotation_id!==undefined?` · selected #${report.document.display_state.selected_annotation_id}`:""}</span></div>
                    <div className="grid gap-1"><span className="text-xs text-muted-foreground">Image-level CVS source values</span><span className="tabular-nums">{cvs.map(value=>value===null?"—":value.toFixed(3)).join(" · ")||"Not recorded"}</span></div>
                    <div className="grid gap-1"><span className="text-xs text-muted-foreground">Image SHA-256</span><code className="break-all text-xs">{report.document.source?.image_sha256??"Not recorded"}</code></div>
                    <div className="grid gap-1"><span className="text-xs text-muted-foreground">Annotation SHA-256</span><code className="break-all text-xs">{report.document.source?.annotation_sha256??"Not recorded"}</code></div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{report.document.source?.citation??"Endoscapes source citation not recorded."} · {report.document.source?.license??"Source license not recorded."}</p>
                  {(report.document.limitations?.length??0)>0&&<ul className="grid gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">{report.document.limitations!.map(item=><li key={item}>{item}</li>)}</ul>}
                  {frame?.id&&<Button render={<Link to={`/studio/surgivision/cases/${encodeURIComponent(frame.id)}?report=${encodeURIComponent(report.id)}`} />} nativeButton={false} variant="outline" size="sm" className="w-fit"><ExternalLink data-icon="inline-start"/>Open reviewed frame</Button>}
                  <Button variant="outline" size="sm" className="w-fit" onClick={()=>download(report)}><FileText data-icon="inline-start"/>Download JSON evidence</Button>
                </CardContent>
              </Card>;
            }
            if(entry.kind==="dosetwin-comparison"){
              const comparison=report.document.comparison;
              const hashes=report.document.source?.files_sha256??{};
              return <Card className="overflow-hidden" key={report.id}>
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="outline" className="text-primary">DoseTwin · same-grid comparison</Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">{new Date(report.created_at+"Z").toLocaleString()}</span>
                  </div>
                  <CardTitle>{report.document.title??"DoseTwin prediction comparison"}</CardTitle>
                  <CardDescription>OpenKBP · {report.document.case?.source_case_id??report.case_id} · archived output compared with its matching benchmark reference</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-3 border-y py-3 text-sm sm:grid-cols-2">
                    <div className="grid gap-1"><span className="text-xs text-muted-foreground">Selected view</span><span>{report.document.selection?.roi??"—"} · {report.document.selection?.axis===0?"X":report.document.selection?.axis===1?"Y":"Z"} index {report.document.selection?.index??"—"} · processed-grid coordinates</span></div>
                    <div className="grid gap-1"><span className="text-xs text-muted-foreground">Prediction source</span><span>{report.document.source?.model_revision??"Model revision unavailable"} · {report.document.source?.prediction_source_revision??"source revision unavailable"}</span></div>
                    {Object.entries(hashes).map(([name,hash])=><div key={name} className="grid min-w-0 gap-1"><span className="text-xs text-muted-foreground">SHA-256 · {name}</span><code className="break-all text-[11px]">{hash}</code></div>)}
                    <div className="grid gap-1"><span className="text-xs text-muted-foreground">Checkpoint SHA-256</span><code className="break-all text-[11px]">{report.document.source?.checkpoint_sha256??"Not published by source"}</code></div>
                    <div className="grid gap-1 sm:col-span-2"><span className="text-xs text-muted-foreground">Declared local-use basis</span><span className="text-xs leading-relaxed">{report.document.source?.rights_basis??"Not recorded"}</span></div>
                  </div>
                  {comparison&&<div className="overflow-x-auto rounded-md border border-border"><Table><caption className="p-2 text-left text-xs text-muted-foreground">Saved ROI measurements · archived prediction versus reference · Gy</caption><TableHeader><TableRow><TableHead>Structure</TableHead><TableHead>Voxels</TableHead><TableHead>Reference mean</TableHead><TableHead>Prediction mean</TableHead><TableHead>Mean |Δ|</TableHead><TableHead>Max |Δ|</TableHead></TableRow></TableHeader><TableBody>{comparison.roi_comparisons.map(item=><TableRow key={item.roi}><TableCell className="font-medium">{item.roi}</TableCell><TableCell className="font-mono tabular-nums">{item.voxel_count.toLocaleString()}</TableCell><TableCell className="font-mono tabular-nums">{item.reference_mean_gy.toFixed(2)} Gy</TableCell><TableCell className="font-mono tabular-nums">{item.prediction_mean_gy.toFixed(2)} Gy</TableCell><TableCell className="font-mono tabular-nums">{item.mean_absolute_delta_gy.toFixed(2)} Gy</TableCell><TableCell className="font-mono tabular-nums">{item.maximum_absolute_delta_gy.toFixed(2)} Gy</TableCell></TableRow>)}</TableBody></Table></div>}
                  {(report.document.limitations?.length??0)>0&&<ul className="grid gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">{report.document.limitations!.map(item=><li key={item}>{item}</li>)}</ul>}
                  <div className="flex flex-wrap gap-2"><Button render={<Link to={`/studio/dosetwin/cases/${encodeURIComponent(report.case_id)}`} />} nativeButton={false} variant="outline" size="sm"><ExternalLink data-icon="inline-start"/>Open source case</Button><Button variant="outline" size="sm" onClick={()=>download(report)}><FileText data-icon="inline-start"/>Download JSON evidence</Button></div>
                </CardContent>
              </Card>;
            }
            return (
            <Card className="m-0" key={report.id}>
              <CardHeader className="px-4 pt-4 sm:px-5">
                <CardTitle>
                  <h2 className="m-0 text-sm font-semibold">
                    {report.document.title ??
                      `Evidence report · ${report.case_id}`}
                  </h2>
                </CardTitle>
                <CardDescription>
                  {report.document.case?.dataset_id ?? "Research dataset"} ·
                  case {report.document.case?.source_case_id ?? report.case_id}{" "}
                  · {new Date(report.created_at + "Z").toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 items-center gap-2 border-y py-2.5 text-[11px] tabular-nums text-muted-foreground sm:grid-cols-[minmax(180px,1fr)_minmax(130px,.6fr)_auto_auto]">
                  <span>Run {report.run_id}</span>
                  <span>
                    Source{" "}
                    {report.document.source?.revision?.slice(0, 12) ??
                      "revision not recorded"}
                  </span>
                  <span>
                    {
                      Object.keys(report.document.source?.files_sha256 ?? {})
                        .length
                    }{" "}
                    source hashes
                  </span>
                  <Badge variant="outline" className="source-badge ready">
                    {report.status}
                  </Badge>
                </div>
                {report.document.viewer_state && (
                  <p className="mt-3 border-l-2 border-primary/60 bg-muted/50 px-2.5 py-2 text-[11px] tabular-nums text-muted-foreground">
                    Reviewed voxel x {report.document.viewer_state.voxel[0]} / y{" "}
                    {report.document.viewer_state.voxel[1]} / z{" "}
                    {report.document.viewer_state.voxel[2]} · {['X', 'Y', 'Z'][report.document.viewer_state.axis ?? 2]} plane ·{" "}
                    {report.document.viewer_state.roi} · dose overlay{" "}
                    {report.document.viewer_state.dose_overlay ? "on" : "off"} ·
                    ROI boundary{" "}
                    {report.document.viewer_state.roi_overlay ? "on" : "off"} ·
                    opacity{" "}
                    {Math.round(
                      report.document.viewer_state.dose_opacity * 100,
                    )}
                    %
                  </p>
                )}
                {report.document.viewer_state && <Link to={`/studio/dosetwin/cases/${encodeURIComponent(report.case_id)}?report=${encodeURIComponent(report.id)}`} className="mt-3 inline-flex h-9 w-fit items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"><ExternalLink className="size-4"/>Open reviewed DoseTwin view</Link>}
                {report.document.results && (
                  <div className="mt-3 border-b">
                    <Table className="min-w-[650px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead scope="col" className="text-left">Structure</TableHead>
                          <TableHead scope="col" className="text-right">Voxels</TableHead>
                          <TableHead scope="col" className="text-right">Mean (Gy)</TableHead>
                          <TableHead scope="col" className="text-right">D0.1cc (Gy)</TableHead>
                          <TableHead scope="col" className="text-right">D95 (Gy)</TableHead>
                          <TableHead scope="col" className="text-right">V20Gy (%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(
                          report.document.results.available_rois,
                        ).map(([name, value]) => (
                          <TableRow key={name}>
                            <TableHead scope="row" className="text-left">{name}</TableHead>
                            <TableCell className="text-right tabular-nums">{value.voxels.toLocaleString()}</TableCell>
                            <TableCell className="text-right tabular-nums">{value.dmean_gy?.toFixed(2) ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {value.d0_1cc_gy_openkbp?.toFixed(2) ?? "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {value.d95_gy_interpolated?.toFixed(2) ?? "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{value.v20gy_percent?.toFixed(1) ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {report.document.comparison && (
                  <div className="mt-3 grid gap-3 border-b pb-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-primary">DoseTwin · imported prediction</Badge>
                      <span>{report.document.selection?.roi ?? "ROI"} · {report.document.selection?.coordinate_frame ?? "processed grid"}</span>
                      <span>Model {report.document.source?.model_revision ?? "revision not recorded"}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <Table className="min-w-[720px]">
                        <TableHeader><TableRow><TableHead scope="col">Structure</TableHead><TableHead scope="col" className="text-right">Reference mean</TableHead><TableHead scope="col" className="text-right">Prediction mean</TableHead><TableHead scope="col" className="text-right">Mean Δ</TableHead><TableHead scope="col" className="text-right">Mean |Δ|</TableHead><TableHead scope="col" className="text-right">Max |Δ|</TableHead></TableRow></TableHeader>
                        <TableBody>{report.document.comparison.roi_comparisons.map(item=><TableRow key={item.roi}><TableHead scope="row">{item.roi}</TableHead><TableCell className="text-right tabular-nums">{item.reference_mean_gy.toFixed(2)} Gy</TableCell><TableCell className="text-right tabular-nums">{item.prediction_mean_gy.toFixed(2)} Gy</TableCell><TableCell className="text-right tabular-nums">{item.mean_delta_gy.toFixed(2)} Gy</TableCell><TableCell className="text-right tabular-nums">{item.mean_absolute_delta_gy.toFixed(2)} Gy</TableCell><TableCell className="text-right tabular-nums">{item.maximum_absolute_delta_gy.toFixed(2)} Gy</TableCell></TableRow>)}</TableBody>
                      </Table>
                    </div>
                    <p className="m-0 text-xs text-muted-foreground">Reference dose SHA-256 · <code className="break-all">{report.document.comparison.reference_dose_sha256}</code></p>
                  </div>
                )}
                <ul className="my-3 grid gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                  {(report.document.limitations ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => download(report)}
                >
                  <FileText data-icon="inline-start" />
                  Download JSON evidence
                </Button>
              </CardContent>
            </Card>
            );
          })}
        </div>
      ) : null}
      {!reloading && !error && hasMoreComparisons && (
        <div className="mt-4 grid justify-items-center gap-2">
          {moreError && <Alert variant="destructive"><CircleAlert/><AlertTitle>Older comparisons could not be loaded</AlertTitle><AlertDescription>{moreError}</AlertDescription></Alert>}
          <Button variant="outline" onClick={() => void loadMoreComparisons()} disabled={loadingMoreComparisons}>
            {loadingMoreComparisons ? <LoaderCircle data-icon="inline-start" className="animate-spin"/> : null}
            {loadingMoreComparisons ? "Loading older comparisons…" : "Load older FiSaV comparisons"}
          </Button>
        </div>
      )}
      {!reloading && !error && !data.length ? (
        <EmptyWork
          icon={ClipboardCheck}
          title="No saved evidence reports"
          body="Save evidence from a SurgiVision frame review, a completed DoseTwin run, or a FiSaV source-window comparison."
          link="/studio/experiments"
          linkText="Open experiments"
        />
      ) : null}
    </>
  );
}
function useReportList() {
  const [data, setData] = useState<ReportFeedItem[]>([]),
    [reloading, setReloading] = useState(true),
    [error, setError] = useState(""),
    [nextComparisonOffset, setNextComparisonOffset] = useState(0),
    [hasMoreComparisons, setHasMoreComparisons] = useState(false),
    [loadingMoreComparisons, setLoadingMoreComparisons] = useState(false),
    [moreError, setMoreError] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([api.reports(),api.allSignalComparisons(comparisonPageSize,0)])
      .then(([reports,comparisons]) => {
        if (!live) return;
        const combined:ReportFeedItem[]=[
          ...reports.map(report=>({kind:(report.document.schema==='medforge.surgivision-source-frame-evidence/v1'?"surgivision-frame":report.document.schema==='medforge.dosetwin-dose-comparison/v1'?"dosetwin-comparison":"openkbp-run") as "surgivision-frame"|"dosetwin-comparison"|"openkbp-run",id:report.id,created_at:report.created_at,report})),
          ...comparisons.map(comparison=>({kind:"fisav-comparison" as const,id:comparison.id,created_at:comparison.created_at,comparison})),
        ];
        combined.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
        setData(combined);
        setNextComparisonOffset(comparisons.length);
        setHasMoreComparisons(comparisons.length===comparisonPageSize);
      })
      .catch((e: unknown) => {
        if (live)
          setError(
            e instanceof Error
              ? e.message
              : "The local research API is unavailable",
          );
      })
      .finally(() => {
        if (live) setReloading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  const loadMoreComparisons=async()=>{
    if(loadingMoreComparisons||!hasMoreComparisons)return;
    setLoadingMoreComparisons(true);setMoreError("");
    try{
      const page=await api.allSignalComparisons(comparisonPageSize,nextComparisonOffset);
      setData(current=>{
        const combined=[...current,...page.map(comparison=>({kind:"fisav-comparison" as const,id:comparison.id,created_at:comparison.created_at,comparison}))];
        return combined.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
      });
      setNextComparisonOffset(value=>value+page.length);
      setHasMoreComparisons(page.length===comparisonPageSize);
    }catch(e){setMoreError(e instanceof Error?e.message:"Unable to load older signal comparisons")}
    finally{setLoadingMoreComparisons(false)}
  };
  return { data, reloading, error, hasMoreComparisons, loadingMoreComparisons, moreError, loadMoreComparisons };
}

const inMemoryAwardAnnouncements = new Map<string, Set<string>>();

function AcademyAchievementAnnouncement({
  studentId,
  enabled,
  achievements,
}: {
  studentId?: string;
  enabled: boolean;
  achievements: StudentProgress["achievements"];
}) {
  const [queue, setQueue] = useState<StudentProgress["achievements"]>([]);

  useEffect(() => {
    if (!studentId || !enabled || !achievements.length) {
      if (!enabled || !studentId) setQueue([]);
      return;
    }
    const storageKey = `medforge:academy:announced-awards:${studentId}`;
    const seen = inMemoryAwardAnnouncements.get(studentId) ?? new Set<string>();
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved)) for (const value of saved) if (typeof value === "string") seen.add(value);
    } catch {
      // Keep an in-memory ledger if browser storage is unavailable.
    }
    const fresh = unannouncedActivityAchievements(achievements, seen);
    if (!fresh.length) return;
    for (const achievement of fresh) seen.add(activityAchievementKey(achievement));
    inMemoryAwardAnnouncements.set(studentId, seen);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...seen]));
    } catch {
      // The module-scoped ledger still prevents duplicate notices in this app session.
    }
    setQueue(current => {
      const queued = new Set(current.map(activityAchievementKey));
      return [...current, ...fresh.filter(achievement => !queued.has(activityAchievementKey(achievement)))];
    });
  }, [studentId, enabled, achievements]);

  const achievement = queue[0];
  if (!achievement) return null;
  return <div role="status" aria-live="polite" aria-atomic="true" className="relative my-4 flex flex-col items-start gap-3 rounded-xl border border-[#e8bf64] bg-[#fff3cf] p-4 pr-12 text-[#302814] shadow-sm sm:flex-row sm:items-center sm:pr-4">
    <div className="flex w-full min-w-0 items-start gap-3 sm:items-center">
      <AchievementBadge role="presentation" badgeSize="sm" achievement={{id:achievement.key,name:achievement.title,trigger:"api",achievedAt:achievement.earned_at}} className="!h-14 !w-14 shrink-0 !gap-0 !p-0 border-[#e8bf64] bg-[#ffefbd] [&>span]:sr-only"/>
      <div className="min-w-0 flex-1"><p className="m-0 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"><Trophy aria-hidden="true" className="size-4 shrink-0"/>Achievement Unlocked</p><h2 className="mb-0 mt-1 text-base font-semibold">{achievement.title}</h2><p className="mb-0 mt-1 text-sm leading-relaxed">{achievement.description} Private activity recognition; it does not represent clinical skill.</p></div>
    </div>
    <Button type="button" variant="ghost" size="icon-sm" className="absolute right-2 top-2 shrink-0 text-[#302814] sm:static" aria-label={`Dismiss ${achievement.title} announcement`} onClick={()=>setQueue(current=>current.slice(1))}><X/></Button>
  </div>;
}

export function Academy() {
  const { user } = useSession();
  const challenges = useApi(queryKeys.studentChallenges, api.studentChallenges, [] as StudentChallenge[]);
  const paths = useApi(queryKeys.studentLearningPaths, api.studentLearningPaths, [] as StudentLearningPath[]);
  const progress = useApi(queryKeys.studentProgress, api.studentProgress, { xp: 0, xp_enabled: false, achievements_enabled: false, graded_attempts: 0, average_score: null, assigned_activities: 0, next_activity: null, rubric_dimensions: [], rubric_history: [], achievements: [] } as StudentProgress);
  const pathDetails = {
    surgivision: { label: "Surgical teams", source: "Endoscapes frame evidence", tone: "border-l-sky-700" },
    dosetwin: { label: "Radiation oncology", source: "OpenKBP dose benchmark", tone: "border-l-indigo-700" },
    fistulaguard: { label: "Nephrology and access care", source: "FiSaV measured signals", tone: "border-l-teal-700" },
  } as const;
  const nextActivity = progress.data.next_activity;
  const firstAssigned = challenges.data.find((challenge) => challenge.state !== "reviewed") ?? challenges.data[0];
  const academyAction = nextActivity
    ? { to: `/academy/missions/${encodeURIComponent(nextActivity.assignment_id)}`, label: nextActivity.state === "resume" ? "Continue investigation" : nextActivity.state === "awaiting_review" ? "View educator feedback" : "Begin investigation" }
    : firstAssigned
      ? { to: `/academy/missions/${encodeURIComponent(firstAssigned.assignment_id)}`, label: firstAssigned.state === "in_progress" ? "Continue investigation" : firstAssigned.state === "submitted" || firstAssigned.state === "reviewed" ? "View educator feedback" : "Begin investigation" }
      : paths.data.find((path) => path.lessons.length > 0)
        ? { to: `/academy/paths/${encodeURIComponent(paths.data.find((path) => path.lessons.length > 0)!.path_id)}`, label: "Explore your learning paths" }
        : { to: "#academy-pathways", label: "Explore learning paths" };
  const featuredPath = paths.data.find((path) => path.lessons.some((lesson) => lesson.state === "in_progress"))
    ?? paths.data.find((path) => path.lessons.length > 0)
    ?? paths.data[0];
  return (
      <main className="academy-home">
      <section className="academy-welcome" aria-labelledby="academy-title">
        <div className="academy-welcome-copy">
          <p className="academy-kicker"><GraduationCap aria-hidden="true"/> Student Academy</p>
          <h1 id="academy-title">Learn to read the evidence.</h1>
          <p className="academy-intro">Follow a real research source, notice what it can show, and explain what remains uncertain. Your educator reviews every investigation.</p>
          <div className="academy-welcome-actions">
            <Button render={<Link to={academyAction.to}/>} nativeButton={false} size="lg">{academyAction.label}<ArrowRight data-icon="inline-end"/></Button>
            <span className="academy-assignment-note">{challenges.loading ? "Checking cohort assignments…" : challenges.data.length ? `${challenges.data.length} released ${challenges.data.length === 1 ? "investigation" : "investigations"}` : "No investigation has been assigned yet"}</span>
          </div>
          {!challenges.loading && !challenges.error && challenges.data.length === 0 && <p className="academy-welcome-empty">Your pathways explain what each source contains. Lessons appear here only after your educator assigns them.</p>}
        </div>
        {featuredPath?.lessons[0]?.case_id ? <div className="academy-feature-evidence">
          <div className="academy-feature-image"><AcademyPathPreview path={featuredPath}/></div>
          <div className="academy-feature-caption"><span>Source in focus</span><strong>{pathDetails[featuredPath.module].label}</strong><small>{pathDetails[featuredPath.module].source}</small></div>
          <span className="academy-feature-mark" aria-hidden="true"><Microscope/></span>
        </div> : <figure className="academy-welcome-illustration"><img src={clinicalTeamImage} alt="Illustrative portrait of a medical research team; not scientific evidence"/><figcaption><strong>Illustration</strong> · Team image is illustrative and is not source research data.</figcaption></figure>}
      </section>
      <AcademyAchievementAnnouncement studentId={user?.id} enabled={progress.data.achievements_enabled} achievements={progress.data.achievements}/>
      <div className="academy-guidance-line"><ShieldCheck aria-hidden="true"/><p><strong>Evidence first, answers after.</strong> Reference material stays private until your educator reviews your work. A reviewed lesson records feedback; it does not certify clinical skill.</p></div>
      <section id="academy-pathways" className="academy-journey" aria-labelledby="academy-pathways-title">
        <header className="academy-section-heading">
          <div><p className="academy-kicker">Choose a source</p><h2 id="academy-pathways-title">Your learning paths</h2><p>Each path follows one research collection and its own evidence limits.</p></div>
          <span className="academy-path-count">{paths.loading ? "Loading paths" : `${paths.data.length} ${paths.data.length === 1 ? "path" : "paths"}`}</span>
        </header>
        {paths.error ? (
          <Alert variant="destructive"><CircleAlert/><AlertTitle>Learning pathways could not load</AlertTitle><AlertDescription>{paths.error}</AlertDescription></Alert>
        ) : (
          <div className="academy-journey-branches">
            {paths.loading ? (
              <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-72"/>)}</div>
            ) : (
              <div className="academy-journey-branch-grid">
                {(["surgivision", "dosetwin", "fistulaguard"] as const).map((module, index) => (
                  <AcademyJourneyBranch key={module} module={module} index={index} path={paths.data.find((path) => path.module === module)}/>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
      <div className="academy-lower-grid">
        <Card className="academy-assigned min-w-0">
          <CardHeader className="flex items-end justify-between gap-3">
            <div>
              <div className="eyebrow">Released coursework</div>
              <CardTitle>
                <h2>Assigned lessons</h2>
              </CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">{challenges.loading ? "Loading" : `${challenges.data.length} assigned`}</span>
          </CardHeader>
          <CardContent>
            {challenges.error ? <Alert variant="destructive"><CircleAlert/><AlertTitle>Assignments could not load</AlertTitle><AlertDescription>{challenges.error}</AlertDescription></Alert> : challenges.data.length ? <div className="mt-4 divide-y border-t">{challenges.data.map((challenge) => {
              const state = challengeStatePresentation[challenge.state];
              const area = specialtyData[challenge.module as ModuleId];
              return <Link to={`/academy/missions/${encodeURIComponent(challenge.assignment_id)}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 border-b py-3 last:border-b-0 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center" key={challenge.assignment_id}><Badge className="col-start-2 row-start-1 w-fit justify-self-end sm:col-start-1 sm:justify-self-start" variant={state.variant}>{state.label}</Badge><span className="col-start-1 row-start-1 min-w-0 sm:col-start-2"><b className="break-words leading-5">{challenge.title}</b><small className="mt-1 block break-words leading-5">{area.name} / {challenge.case_label} / version {challenge.version}{challenge.due_at ? ` / due ${new Date(challenge.due_at).toLocaleDateString()}` : ""}</small></span><span className="col-span-2 inline-flex items-center justify-self-end gap-2 text-sm font-medium text-primary sm:col-span-1"><ArrowRight aria-hidden="true"/>Open lesson</span></Link>;
            })}</div> : <Empty className="min-h-52 rounded-lg border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><BookOpenCheck/></EmptyMedia><EmptyTitle>{challenges.loading ? "Loading assigned lessons" : "No lessons assigned yet"}</EmptyTitle><EmptyDescription>{challenges.loading ? "Checking your cohort assignments." : "Your educator’s published lessons will appear here when they assign them to your cohort."}</EmptyDescription></EmptyHeader></Empty>}
          </CardContent>
        </Card>
        <Card className="academy-recognition min-w-0">
          <CardHeader>
            <div className="eyebrow">Your progress</div>
            <CardTitle>
              <h3>A record grounded in reviewed work.</h3>
            </CardTitle>
            <CardDescription>
              Submitted work appears after an educator reviews it. No practice scores or streaks are invented.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {progress.error ? <Alert variant="destructive"><CircleAlert/><AlertTitle>Progress could not load</AlertTitle><AlertDescription>{progress.error}</AlertDescription></Alert> : <>
            {progress.loading ? <Skeleton className="h-12"/> : progress.data.xp_enabled ? <PointsBadge size="sm" icon={Sparkles} name="Experience points" total={progress.data.xp} className="my-3 w-full justify-between border-0 bg-transparent px-0 py-1 shadow-none"/> : <div className="my-2 flex items-center justify-between gap-3 border-y border-border py-3"><span className="inline-flex items-center gap-2 text-sm text-foreground"><Sparkles className="size-4 text-muted-foreground"/>Experience points</span><b className="text-lg font-medium text-muted-foreground">Off</b></div>}
            <div className="my-2 flex items-center justify-between gap-3 border-y border-border py-3"><span className="inline-flex items-center gap-2 text-sm text-foreground"><ClipboardCheck className="size-4 text-muted-foreground"/>Reviewed submissions</span><b className="text-lg font-medium tabular-nums text-foreground">{progress.loading ? "—" : progress.data.graded_attempts}</b></div>
            {progress.data.average_score !== null && <p className="text-muted-foreground">Average reviewed score: {progress.data.average_score.toFixed(1)}%</p>}
            <div className="mt-3 grid gap-2 border-t pt-3">
              <div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">Activity awards</span><span className="text-muted-foreground">{progress.loading ? "Loading" : progress.data.achievements_enabled ? "Opted in" : "Off"}</span></div>
              {progress.data.achievements_enabled && progress.data.achievements.length > 0 ? (
                <div role="list" aria-label="Earned activity awards" className="grid gap-2">
                  {progress.data.achievements.map((achievement) => <div role="listitem" key={achievement.key} className="grid gap-1">
                    <AchievementBadge badgeSize="sm" role="presentation" achievement={{id: achievement.key, name: achievement.title, trigger: "api", achievedAt: achievement.earned_at}} className="academy-earned-badge"/>
                    <p className="text-xs leading-5 text-muted-foreground">{achievement.description} Recorded {new Date(achievement.earned_at).toLocaleDateString()}.</p>
                  </div>)}
                </div>
              ) : progress.data.achievements_enabled ? <p className="text-xs leading-5 text-muted-foreground">No award yet. Recognition follows an educator-reviewed investigation.</p> : <p className="text-xs leading-5 text-muted-foreground">Private recognition stays off unless you opt in.</p>}
            </div>
            </>}
            <Link to="/academy/progress" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">
              {progress.data.xp_enabled && !progress.error ? "View progress record" : "Progress and privacy settings"} <ArrowRight size={14} />
            </Link>
          </CardContent>
        </Card>
      </div>
      </main>
  );
}
export function Mission() {
  const { user } = useSession();
  const { missionId } = useParams();
  const progress = useApi(queryKeys.studentProgress, api.studentProgress, { xp: 0, xp_enabled: false, achievements_enabled: false, graded_attempts: 0, average_score: null, assigned_activities: 0, next_activity: null, rubric_dimensions: [], rubric_history: [], achievements: [] } as StudentProgress);
  const [attempt, setAttempt] = useState<StudentAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [viewerEvidence, setViewerEvidence] = useState<StudentViewerEvidence | null>(null);
  const [committedSelfChecks, setCommittedSelfChecks] = useState<Record<string, boolean>>({});
  const markSelfCheckCommitted = useCallback((blockId: string) => setCommittedSelfChecks(current => current[blockId] ? current : { ...current, [blockId]: true }), []);
  const [debrief, setDebrief] = useState<StudentDebrief | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [offlineNotice, setOfflineNotice] = useState("");
  useEffect(() => {
    if (!attempt || attempt.state !== "started") return;
    const timer = window.setTimeout(() => { void saveDraft(offlineStore(), attempt.attempt_id, answers).catch(() => undefined); }, 600);
    return () => window.clearTimeout(timer);
  }, [attempt, answers]);
  useEffect(() => {
    if (!missionId) return;
    let live = true;
    setBusy(true);
    setAttempt(null);
    setAnswers({});
    setViewerEvidence(null);
    setCommittedSelfChecks({});
    setDebrief(null);
    setError("");
    api.studentStartAttempt(missionId).then(value => {
      if (!live) return;
      setAttempt(value);
      const serverAnswers = Object.fromEntries(value.observations.map(item => [item.block_id, item.response]));
      setAnswers(serverAnswers);
      // Degraded mode: restore answers typed on this device that never reached the server.
      if (value.state === "started") void loadDraft(offlineStore(), value.attempt_id).then(draft => {
        if (live && draft) { setAnswers({ ...serverAnswers, ...Object.fromEntries(Object.entries(draft.answers).filter(([, text]) => text.trim())) }); setOfflineNotice("Restored unsaved answers from this device."); }
      }).catch(() => undefined);
      setViewerEvidence(value.viewer_evidence);
    }).catch(e => { if (live) setError(e instanceof Error ? e.message : "The assigned lesson could not be opened"); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [missionId]);
  useEffect(() => {
    if (!attempt || attempt.state !== "graded") return;
    let live = true;
    api.studentDebrief(attempt.attempt_id).then(value => { if (live) setDebrief(value); }).catch(e => { if (live) setError(e instanceof Error ? e.message : "The reviewed debrief is unavailable"); });
    return () => { live = false; };
  }, [attempt]);
  const save = async () => {
    if (!attempt) return null;
    setSaving(true); setError("");
    try {
      const updated = await api.saveStudentAttempt(attempt.attempt_id, attempt.revision, Object.entries(answers).map(([block_id, response]) => ({ block_id, response })), viewerEvidence);
      setAttempt(updated);
      setViewerEvidence(updated.viewer_evidence);
      return updated;
    } catch (e) { setError(e instanceof Error ? e.message : "Answers could not be saved"); return null; }
    finally { setSaving(false); }
  };
  const submit = async () => {
    if (!attempt) return;
    const idempotencyKey = crypto.randomUUID();
    const queue = async () => {
      // Offline: keep the submit with its key; it is replayed automatically when the connection returns.
      await enqueueSubmit(offlineStore(), { attemptId: attempt.attempt_id, revision: attempt.revision, idempotencyKey, answers, viewerEvidence });
      setError(""); setOfflineNotice("You are offline. Your submission is queued on this device and will be sent automatically.");
    };
    if (!navigator.onLine) { await queue(); return; }
    setSaving(true); setError("");
    try {
      const updated = await api.saveStudentAttempt(attempt.attempt_id, attempt.revision, Object.entries(answers).map(([block_id, response]) => ({ block_id, response })), viewerEvidence);
      setAttempt(updated);
      await api.submitStudentAttempt(updated.attempt_id, updated.revision, idempotencyKey);
      await clearDraft(offlineStore(), updated.attempt_id).catch(() => undefined);
      setOfflineNotice("");
      setAttempt(await api.studentAttempt(updated.attempt_id));
    } catch (e) {
      if (isNetworkError(e)) await queue();
      else setError(e instanceof Error ? e.message : "Submission could not be sent");
    }
    finally { setSaving(false); }
  };
  if (busy) return <Card><CardHeader><CardTitle>Opening your assignment…</CardTitle><CardDescription>Loading the student-safe lesson version.</CardDescription></CardHeader><CardContent><Skeleton className="h-24"/></CardContent></Card>;
  if (!attempt) return <><Header eyebrow="Student academy / Assignment" title="Assignment unavailable" description={error || "This assignment is not available to your account."}/><EmptyWork icon={LockKeyhole} title="No student lesson is available" body={error || "Ask your educator to check the cohort assignment."} link="/academy" linkText="Back to Academy"/></>;
  const locked = attempt.state !== "started";
  const sourceId = attempt.challenge.case_id.split(":").at(-1) ?? attempt.challenge.case_id;
  const questionBlocks = attempt.challenge.blocks.filter(block => block.type === "Question");
  const selfCheckIds = attempt.challenge.blocks.filter(block => block.type === "CVS self-check").map(block => block.id);
  const missionProgress = getMissionProgress(attempt.state, Boolean(viewerEvidence), questionBlocks.map(block => block.id), answers, selfCheckIds, committedSelfChecks);
  const evidenceSummary = viewerEvidence?.kind === "dosetwin"
    ? `OpenKBP voxel x ${viewerEvidence.voxel[0]} · y ${viewerEvidence.voxel[1]} · z ${viewerEvidence.voxel[2]} · ${viewerEvidence.roi}`
    : viewerEvidence?.kind === "surgivision"
      ? `Endoscapes frame ${viewerEvidence.frame_id} · source pixel x ${viewerEvidence.selection_x_px}, y ${viewerEvidence.selection_y_px}`
      : viewerEvidence?.kind === "fistulaguard"
        ? `FiSaV ${viewerEvidence.record_id} · ${viewerEvidence.channel} · ${viewerEvidence.start_sec.toFixed(1)}–${(viewerEvidence.start_sec + viewerEvidence.duration_sec).toFixed(1)} s`
        : "No source selection yet";
  return (
    <>
      <div id="mission-brief"><Header
        eyebrow={`Student academy / ${attempt.challenge.module} / Assignment`}
        title={attempt.challenge.title}
        description={`${attempt.challenge.case_label} · versioned source lesson · ${attempt.challenge.source_license}`}
      /></div>
      <AcademyAchievementAnnouncement studentId={user?.id} enabled={progress.data.achievements_enabled} achievements={progress.data.achievements}/>
      <StudentMissionStepper progress={missionProgress}/>
      {error && <Alert variant="destructive"><CircleAlert/><AlertTitle>Action could not be completed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {offlineNotice && <Alert role="status"><CircleAlert/><AlertTitle>Saved on this device</AlertTitle><AlertDescription>{offlineNotice}</AlertDescription></Alert>}
      <Card id="mission-explore" className="mb-4"><CardHeader><div className="eyebrow">Explore evidence</div><CardTitle>{attempt.challenge.case_label}</CardTitle><CardDescription>The scientific viewer is limited to the case attached to this assignment. Reference labels {debrief?.reference_evidence ? "are now available after educator review." : "remain hidden until educator review."}</CardDescription></CardHeader><CardContent><Suspense fallback={<Skeleton className="h-72"/>}>{attempt.challenge.module === "dosetwin" ? <DoseViewer key={attempt.challenge.case_id} caseId={attempt.challenge.case_id} guided onEvidenceChange={setViewerEvidence} viewerEvidence={viewerEvidence?.kind === "dosetwin" ? viewerEvidence : null} locked={locked}/> : attempt.challenge.module === "surgivision" ? <SurgiViewer key={attempt.challenge.case_id} frameId={attempt.challenge.case_id} availableFrameIds={[attempt.challenge.case_id]} guided releasedReference={debrief?.reference_evidence} viewerEvidence={viewerEvidence} onEvidenceChange={setViewerEvidence} locked={locked}/> : <FistulaViewer key={sourceId} recordId={sourceId} availableRecordIds={[sourceId]} guided viewerEvidence={viewerEvidence?.kind === "fistulaguard" ? viewerEvidence : null} onEvidenceChange={setViewerEvidence} locked={locked}/>}</Suspense><div id="mission-observe" className="mt-4 rounded-lg border bg-muted/20 px-3 py-2 text-sm"><b>{viewerEvidence ? "Evidence selected" : "Select evidence to submit"}</b><span className="ml-2 text-muted-foreground">{evidenceSummary}</span></div></CardContent></Card>
      <div id="mission-explain" className="flex flex-col gap-4">{attempt.challenge.blocks.map((block, index) => <Card key={block.id}><CardHeader><div className="eyebrow">{block.type} · {String(index+1).padStart(2,"0")}</div><CardTitle>{block.title}</CardTitle><CardDescription>{block.content}</CardDescription></CardHeader>{block.type === "Question" && <CardContent><FieldGroup><Field><FieldLabel htmlFor={`answer-${block.id}`}>Your observation</FieldLabel><Textarea id={`answer-${block.id}`} value={answers[block.id] ?? ""} disabled={locked} onChange={event => setAnswers(previous => ({...previous, [block.id]: event.target.value}))} placeholder="Describe what the evidence supports and what remains uncertain." rows={5}/></Field></FieldGroup></CardContent>}{block.type === "CVS self-check" && <CardContent><CvsSelfCheck attemptId={attempt.attempt_id} blockId={block.id} locked={locked} onCommitted={markSelfCheckCommitted}/></CardContent>}</Card>)}</div>
      <div id="mission-submit" className="mt-4 flex flex-col gap-4">
        {attempt.state === "review_required" && <Card><CardHeader><CardTitle>Submission received</CardTitle><CardDescription>Your educator will review your observations before releasing feedback and reference material.</CardDescription></CardHeader></Card>}
        {debrief && <Card><CardHeader><CardTitle>Educator debrief</CardTitle><CardDescription>{debrief.score}/{debrief.max_score} · {debrief.xp_awarded} XP</CardDescription></CardHeader><CardContent><p>{debrief.feedback}</p><div className="mt-4 border-t pt-4"><b>Scored criteria</b><div className="mt-3 flex flex-col gap-3">{debrief.criterion_scores.map(criterion => <div className="rounded-lg border bg-muted/20 p-3" key={criterion.id}><div className="flex flex-wrap justify-between gap-2"><b>{criterion.title}</b><b>{criterion.earned_points}/{criterion.max_points}</b></div><p className="text-sm text-muted-foreground">{criterion.description}</p>{criterion.note && <p className="mt-2 whitespace-pre-wrap">{criterion.note}</p>}</div>)}</div><b className="mt-4 block">Rubric notes</b><p>{debrief.rubric}</p></div>{debrief.reveal_blocks.length > 0 && <div className="mt-4 flex flex-col gap-3 border-t pt-4"><b>Educator reference</b>{debrief.reveal_blocks.map(block => <section key={block.id}><h3 className="font-medium">{block.title}</h3><p className="whitespace-pre-wrap text-muted-foreground">{block.content}</p></section>)}</div>}</CardContent></Card>}
        {!locked && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save draft"}</Button><Button disabled={saving || !canSubmitMission(missionProgress, Boolean(viewerEvidence))} onClick={() => void submit()}>{saving ? "Submitting…" : "Submit for educator review"}</Button></div>}
        {!locked && !missionProgress.questionsComplete && questionBlocks.length > 0 && <p className="text-sm text-muted-foreground">Answer all {questionBlocks.length} lesson {questionBlocks.length === 1 ? "question" : "questions"} and select evidence before submitting.</p>}
        {!locked && selfCheckIds.some(id => !committedSelfChecks[id]) && <p className="text-sm text-muted-foreground">Commit your CVS self-check before submitting.</p>}
      </div>
    </>
  );
}
export function Progress() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const progress = useApi(queryKeys.studentProgress, api.studentProgress, { xp: 0, xp_enabled: false, achievements_enabled: false, graded_attempts: 0, average_score: null, assigned_activities: 0, next_activity: null, rubric_dimensions: [], rubric_history: [], achievements: [] } as StudentProgress);
  const [xpEnabled, setXpEnabled] = useState<boolean | null>(null);
  const [achievementsEnabled, setAchievementsEnabled] = useState<boolean | null>(null);
  const [achievements, setAchievements] = useState<StudentProgress["achievements"]>([]);
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [preferenceError, setPreferenceError] = useState("");
  const [recordExporting, setRecordExporting] = useState(false);
  const [recordExportError, setRecordExportError] = useState("");
  useEffect(() => {
    if (xpEnabled === null && !progress.loading && !progress.error) setXpEnabled(progress.data.xp_enabled);
  }, [xpEnabled, progress.loading, progress.error, progress.data.xp_enabled]);
  useEffect(() => {
    if (achievementsEnabled === null && !progress.loading && !progress.error) {
      setAchievementsEnabled(progress.data.achievements_enabled);
      setAchievements(progress.data.achievements);
    }
  }, [achievementsEnabled, progress.loading, progress.error, progress.data.achievements_enabled, progress.data.achievements]);
  const changeXpPreference = async () => {
    if (xpEnabled === null || preferenceSaving) return;
    setPreferenceSaving(true);
    setPreferenceError("");
    try {
      const updated = await api.updateStudentLearningPreferences(!xpEnabled);
      setXpEnabled(updated.xp_enabled);
      await queryClient.invalidateQueries({ queryKey: queryKeys.studentProgress });
    } catch (error) {
      setPreferenceError(error instanceof Error ? error.message : "Your preference could not be saved.");
    } finally {
      setPreferenceSaving(false);
    }
  };
  const changeAchievementPreference = async () => {
    if (achievementsEnabled === null || preferenceSaving) return;
    setPreferenceSaving(true);
    setPreferenceError("");
    try {
      const updated = await api.updateStudentAchievementPreferences(!achievementsEnabled);
      setAchievementsEnabled(updated.achievements_enabled);
      const refreshed = await api.studentProgress();
      queryClient.setQueryData(queryKeys.studentProgress, refreshed);
      setAchievements(refreshed.achievements);
    } catch (error) {
      setPreferenceError(error instanceof Error ? error.message : "Your preference could not be saved.");
    } finally {
      setPreferenceSaving(false);
    }
  };
  const exportParticipationRecord = async () => {
    setRecordExporting(true);
    setRecordExportError("");
    try {
      const record = await api.studentProgressExport();
      const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "medforge-education-participation.json";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (error) {
      setRecordExportError(error instanceof Error ? error.message : "Your participation record could not be exported.");
    } finally {
      setRecordExporting(false);
    }
  };
  return (
    <>
      <Header
        eyebrow="Student academy / Progress"
        title="Your learning record"
        description="This private learning record is based on educator-reviewed work. Rubric results describe this coursework, not clinical competence."
      />
      <AcademyAchievementAnnouncement studentId={user?.id} enabled={progress.data.achievements_enabled} achievements={progress.data.achievements}/>
      {progress.error ? <Alert variant="destructive"><CircleAlert/><AlertTitle>Progress could not load</AlertTitle><AlertDescription>{progress.error}</AlertDescription></Alert> : <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card><CardHeader><CardDescription>Optional experience points</CardDescription></CardHeader><CardContent>{progress.loading || xpEnabled === null ? <Skeleton className="h-12"/> : xpEnabled ? <PointsBadge size="sm" icon={Sparkles} name="Experience points" total={progress.data.xp} className="border-0 bg-transparent p-0 shadow-none"/> : <div className="text-lg font-medium">Off</div>}<p className="mt-3 text-sm text-muted-foreground">Cosmetic points come only from educator-reviewed submissions.</p></CardContent></Card>
          <Card><CardHeader><CardDescription>Reviewed submissions</CardDescription><CardTitle>{progress.loading ? "—" : progress.data.graded_attempts}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Average reviewed score</CardDescription><CardTitle>{progress.loading ? "—" : progress.data.average_score === null ? "—" : `${progress.data.average_score.toFixed(1)}%`}</CardTitle></CardHeader></Card>
        </div>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Next activity</CardTitle>
            <CardDescription>Choose the next step from your assigned lessons and saved work.</CardDescription>
          </CardHeader>
          <CardContent>
            {progress.loading ? <Skeleton className="h-16"/> : progress.data.next_activity ? (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/20 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{progress.data.next_activity.module}</Badge>
                    <span className="text-sm text-muted-foreground">{progress.data.next_activity.case_label}</span>
                  </div>
                  <h2 className="mt-2 font-medium">{progress.data.next_activity.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {progress.data.next_activity.state === "resume" ? "Continue your saved investigation." : progress.data.next_activity.state === "awaiting_review" ? "Your educator is reviewing this submission." : "Start this educator-assigned investigation."}
                    {progress.data.next_activity.due_at ? ` Due ${new Date(progress.data.next_activity.due_at).toLocaleDateString()}.` : ""}
                  </p>
                </div>
                <Button
                  render={<Link to={`/academy/missions/${encodeURIComponent(progress.data.next_activity.assignment_id)}`}/>}
                  nativeButton={false}
                  variant={progress.data.next_activity.state === "awaiting_review" ? "outline" : "default"}
                >
                  {progress.data.next_activity.state === "resume" ? "Resume lesson" : progress.data.next_activity.state === "awaiting_review" ? "View submission" : "Start lesson"}
                  <ArrowRight data-icon="inline-end"/>
                </Button>
              </div>
            ) : (
              <Empty className="min-h-24 rounded-lg border border-dashed">
                <EmptyHeader>
                  <EmptyTitle>{progress.data.assigned_activities === 0 ? "No lessons assigned yet" : progress.data.graded_attempts >= progress.data.assigned_activities ? "You’re caught up" : "No open lesson to start"}</EmptyTitle>
                  <EmptyDescription>{progress.data.assigned_activities === 0 ? "Your educator’s published lessons will appear here when they assign them to your cohort." : progress.data.graded_attempts >= progress.data.assigned_activities ? "Your assigned work has been reviewed." : "Ask your educator whether a closed lesson can be reopened."}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
        <Card className="mt-4"><CardHeader><CardTitle>Private learning preferences</CardTitle><CardDescription>Optional points and activity awards are private and do not change grades or lesson access. Each can be turned off at any time.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Button variant="outline" disabled={progress.loading || xpEnabled === null || preferenceSaving} aria-pressed={xpEnabled ?? false} onClick={() => void changeXpPreference()}>{preferenceSaving ? "Saving preference…" : xpEnabled ? "Turn experience points off" : "Opt in to experience points"}</Button><Button variant="outline" disabled={progress.loading || achievementsEnabled === null || preferenceSaving} aria-pressed={achievementsEnabled ?? false} onClick={() => void changeAchievementPreference()}>{preferenceSaving ? "Saving preference…" : achievementsEnabled ? "Turn activity achievements off" : "Opt in to activity achievements"}</Button>{preferenceError && <p role="alert" className="basis-full text-sm text-destructive">{preferenceError}</p>}</CardContent></Card>
        <Card className="mt-4"><CardHeader><CardTitle>Educator-reviewed rubric dimensions</CardTitle><CardDescription>Repeated results are grouped within each lesson and use the latest educator review of each submission. They show progress on authored coursework and do not establish professional or clinical mastery.</CardDescription></CardHeader><CardContent>{progress.loading ? <Skeleton className="h-24"/> : progress.data.rubric_dimensions.length ? <div className="flex flex-col gap-3">{progress.data.rubric_dimensions.map(dimension => <div key={dimension.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><b>{dimension.title}</b>{dimension.description && <p className="text-sm text-muted-foreground">{dimension.description}</p>}</div><span className="text-sm tabular-nums">{dimension.average_percent === null ? "—" : `${dimension.average_percent}%`} · {dimension.attempts} reviewed</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${dimension.average_percent ?? 0}%` }}/></div></div>)}</div> : <Empty className="min-h-32 rounded-lg border border-dashed"><EmptyHeader><EmptyTitle>No reviewed rubric dimensions yet</EmptyTitle><EmptyDescription>After an educator reviews a submission, its rubric criteria will appear here.</EmptyDescription></EmptyHeader></Empty>}</CardContent></Card>
        <Suspense fallback={<Skeleton className="mt-4 h-72"/>}><StudentProgressChart history={progress.data.rubric_history}/></Suspense>
        <Card className="mt-4"><CardHeader><CardTitle>Activity achievements</CardTitle><CardDescription>Private, optional recognition for completed learning activity. These awards do not represent professional or clinical skill.</CardDescription></CardHeader><CardContent>{progress.loading || achievementsEnabled === null ? <Skeleton className="h-20"/> : !achievementsEnabled ? <p className="text-sm text-muted-foreground">Off. Opt in above to earn activity awards from future educator-reviewed submissions.</p> : achievements.length ? <div className="grid gap-4"><AchievementGrid
          achievements={achievements.map(achievement => ({id:achievement.key,name:achievement.title,trigger:"api",achievedAt:achievement.earned_at}))}
          columns="auto"
          gap="sm"
          badgeSize="sm"
          className="academy-achievement-grid"
        /><ul className="grid gap-2 sm:grid-cols-2" aria-label="Earned activity award details">{achievements.map(achievement => <li key={achievement.key} className="rounded-lg border p-3"><p className="text-sm">{achievement.description}</p><p className="mt-1 text-xs text-muted-foreground">Earned {new Date(achievement.earned_at).toLocaleDateString()}</p></li>)}</ul></div> : <Empty className="min-h-28 rounded-lg border border-dashed"><EmptyHeader><EmptyTitle>No activity award yet</EmptyTitle><EmptyDescription>Complete a source-backed investigation and wait for an educator-reviewed submission before an award can be recorded.</EmptyDescription></EmptyHeader></Empty>}</CardContent></Card>
        <Card className="mt-4"><CardHeader><CardTitle>Participation record</CardTitle><CardDescription>Download a local summary of started and submitted lessons, including educator-reviewed scores. Free-text answers are not included.</CardDescription></CardHeader><CardContent className="flex flex-col items-start gap-3"><Button variant="outline" onClick={() => void exportParticipationRecord()} disabled={progress.loading || recordExporting}><Download data-icon="inline-start"/>{recordExporting ? "Preparing record…" : "Download participation record"}</Button>{recordExportError && <p role="alert" className="text-sm text-destructive">{recordExportError}</p>}</CardContent></Card>
      </>}
      <div className="mt-4"><Link to="/academy" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">Return to assignments <ArrowRight size={14}/></Link></div>
    </>
  );
}

export function Educator() {
  const drafts = useApi(queryKeys.educatorDrafts, api.educatorDrafts, [] as EducatorDraftSummary[]);
  const assignments = useApi(queryKeys.educatorAssignments, api.educatorAssignments, [] as EducatorAssignment[]);
  const cohorts = useApi(queryKeys.educatorCohorts, api.educatorCohorts, [] as EducatorCohort[]);
  const reviewQueries = useQueries({
    queries: assignments.data.map((assignment) => ({
      queryKey: queryKeys.educatorAssignmentAttempts(assignment.id),
      queryFn: () => api.educatorAssignmentAttempts(assignment.id),
      enabled: !assignments.loading && !assignments.error,
    })),
  });
  const reviewError = assignments.error || reviewQueries.find((query) => query.isError)?.error?.message || "";
  const reviewLoading = assignments.loading || reviewQueries.some((query) => query.isPending);
  const reviewQueue = assignments.data.flatMap((assignment, index) =>
    (reviewQueries[index]?.data ?? [])
      .filter((attempt) => attempt.state === "review_required")
      .map((attempt) => ({ assignment, attempt })),
  ).sort((left, right) => Date.parse(right.attempt.submitted_at ?? "") - Date.parse(left.attempt.submitted_at ?? ""));
  return (
    <>
      <Header
        eyebrow="Educator studio"
        title="Teaching desk"
        description="Review learner evidence, manage your cohorts, and shape the next source-grounded lesson."
        action={
          <Button render={<Link to="/educator/cases/new/edit" />} nativeButton={false}>
            <Microscope data-icon="inline-start" />
            Create case lesson
          </Button>
        }
      />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(17rem,0.8fr)]">
        <section aria-label="Teaching work" className="grid min-w-0 gap-5">
          <Card className="min-w-0">
            <CardHeader className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <CardTitle className="flex items-center gap-2"><h2><ClipboardCheck data-icon="inline-start"/>Submissions awaiting review</h2></CardTitle>
                <CardDescription>New learner work, linked to the assignment and its published rubric.</CardDescription>
              </div>
              <Button render={<Link to="/educator/submissions"/>} nativeButton={false} variant="outline" size="sm">All submissions<ArrowRight data-icon="inline-end"/></Button>
            </CardHeader>
            <CardContent>
              {reviewLoading ? <div className="grid gap-3"><Skeleton className="h-16"/><Skeleton className="h-16"/></div>
                : reviewError ? <Alert variant="destructive"><CircleAlert/><AlertTitle>Review queue could not load</AlertTitle><AlertDescription>{reviewError}</AlertDescription></Alert>
                  : reviewQueue.length ? <div className="grid">
                    {reviewQueue.slice(0, 6).map(({ assignment, attempt }, index) => <div key={attempt.attempt_id}>
                      {index > 0 && <Separator/>}
                      <Link
                        to={`/educator/submissions?assignmentId=${encodeURIComponent(assignment.id)}`}
                        aria-label={`Review ${attempt.student_name} submission for ${assignment.lesson_title}`}
                        className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-sm py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                      >
                        <span className="min-w-0 truncate font-medium">{attempt.student_name}</span>
                        <Badge variant="secondary" className="col-start-2 row-start-1">Awaiting review</Badge>
                        <span className="col-span-2 min-w-0 truncate text-sm text-muted-foreground sm:col-span-1 sm:col-start-1 sm:row-start-2">{assignment.lesson_title}</span>
                        <span className="col-span-2 text-xs text-muted-foreground sm:col-span-1 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:text-right">{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "Submitted"}</span>
                      </Link>
                    </div>)}
                    {reviewQueue.length > 6 && <><Separator/><Link to="/educator/submissions" className="py-3 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">View {reviewQueue.length - 6} more pending reviews<ArrowRight data-icon="inline-end"/></Link></>}
                  </div>
                    : <Empty className="min-h-40 rounded-lg border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><ClipboardCheck/></EmptyMedia><EmptyTitle>No submissions are waiting</EmptyTitle><EmptyDescription>Submitted learner evidence will appear here for criterion-based review.</EmptyDescription></EmptyHeader><Button render={<Link to="/educator/assignments"/>} nativeButton={false} variant="outline" size="sm">Manage assignments</Button></Empty>}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid gap-1"><CardTitle><h2>Lesson drafts</h2></CardTitle><CardDescription>Return to your source-grounded lesson work.</CardDescription></div>
              {!drafts.loading && !drafts.error && drafts.data.length > 0 && <Badge variant="outline">{drafts.data.length} saved</Badge>}
            </CardHeader>
            <CardContent>
              {drafts.loading ? <div className="grid gap-3"><Skeleton className="h-14"/><Skeleton className="h-14"/></div>
                : drafts.error ? <Alert variant="destructive"><CircleAlert/><AlertTitle>Saved lessons could not load</AlertTitle><AlertDescription>{drafts.error}</AlertDescription></Alert>
                  : drafts.data.length ? <div className="grid">
                    {drafts.data.slice(0, 5).map((draft, index) => <div key={draft.id}>
                      {index > 0 && <Separator/>}
                      <Link to={`/educator/cases/${draft.id}/edit`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <span className="grid min-w-0 gap-1"><b className="truncate font-medium">{draft.title}</b><small className="truncate text-muted-foreground">{draft.module} · {draft.case_id} · revision {draft.revision}</small></span>
                        <span className="text-xs text-muted-foreground">{new Date(`${draft.updated_at.replace(" ", "T")}Z`).toLocaleDateString()}</span>
                        <ArrowRight aria-hidden="true" className="hidden size-4 text-muted-foreground sm:block"/>
                      </Link>
                    </div>)}
                    {drafts.data.length > 5 && <><Separator/><Link to="/educator/cases/new/edit" className="py-3 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Create another lesson<ArrowRight data-icon="inline-end"/></Link></>}
                  </div>
                    : <Empty className="min-h-36 rounded-lg border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><ClipboardList/></EmptyMedia><EmptyTitle>No lesson drafts yet</EmptyTitle><EmptyDescription>Choose a verified research source and shape it into a learner-safe investigation.</EmptyDescription></EmptyHeader><Button render={<Link to="/educator/cases/new/edit"/>} nativeButton={false} size="sm">Create your first lesson</Button></Empty>}
            </CardContent>
          </Card>
        </section>

        <aside aria-label="Teaching groups and assignment tools" className="grid min-w-0 gap-5">
          <Card className="min-w-0">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid gap-1"><CardTitle><h2>Learning groups</h2></CardTitle><CardDescription>Cohorts you own and the learners assigned to each.</CardDescription></div>
              <Button render={<Link to="/educator/assignments"/>} nativeButton={false} variant="ghost" size="sm">Manage</Button>
            </CardHeader>
            <CardContent>
              {cohorts.loading ? <div className="grid gap-3"><Skeleton className="h-12"/><Skeleton className="h-12"/></div>
                : cohorts.error ? <Alert variant="destructive"><CircleAlert/><AlertTitle>Cohorts could not load</AlertTitle><AlertDescription>{cohorts.error}</AlertDescription></Alert>
                  : cohorts.data.length ? <div className="grid">
                    {cohorts.data.map((cohort, index) => <div key={cohort.id}>
                      {index > 0 && <Separator/>}
                      <div className="flex min-w-0 items-center justify-between gap-3 py-3"><b className="min-w-0 truncate font-medium">{cohort.name}</b><Badge variant={cohort.student_count ? "secondary" : "outline"}>{cohort.student_count} {cohort.student_count === 1 ? "learner" : "learners"}</Badge></div>
                    </div>)}
                  </div>
                    : <Empty className="min-h-36 rounded-lg border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><GraduationCap/></EmptyMedia><EmptyTitle>No learning groups yet</EmptyTitle><EmptyDescription>Create a cohort and add provisioned student accounts before assigning lessons.</EmptyDescription></EmptyHeader><Button render={<Link to="/educator/assignments"/>} nativeButton={false} variant="outline" size="sm">Set up a group</Button></Empty>}
            </CardContent>
          </Card>

          <Alert className="items-start">
            <ShieldCheck/>
            <div><AlertTitle>Source review stays with the lesson</AlertTitle><AlertDescription>Publication checks the selected dataset terms and creates a versioned learner view. Rubrics and reveal content remain private until you review a submission.</AlertDescription></div>
          </Alert>
        </aside>
      </div>
    </>
  );
}
export function Assignments() {
  const [versions, setVersions] = useState<PublishedLessonVersion[]>([]);
  const [cohorts, setCohorts] = useState<EducatorCohort[]>([]);
  const [students, setStudents] = useState<EducatorStudent[]>([]);
  const [assignments, setAssignments] = useState<EducatorAssignment[]>([]);
  const [versionId, setVersionId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [cohortName, setCohortName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentCohortFilter, setAssignmentCohortFilter] = useState("all");
  const [assignmentDueFilter, setAssignmentDueFilter] = useState<"all" | "dated" | "undated">("all");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const refresh = async () => {
    const [v, c, s, a] = await Promise.all([api.educatorVersions(), api.educatorCohorts(), api.educatorStudents(), api.educatorAssignments()]);
    setVersions(v); setCohorts(c); setStudents(s); setAssignments(a);
    setVersionId(current => v.some(item => item.version_id === current) ? current : v[0]?.version_id ?? "");
    setCohortId(current => c.some(item => item.id === current) ? current : c[0]?.id ?? "");
    setStudentId(current => s.some(item => item.id === current) ? current : s[0]?.id ?? "");
  };
  useEffect(() => { let live = true; refresh().catch(e => { if (live) setError(e instanceof Error ? e.message : "Educator delivery data could not load"); }).finally(() => { if (live) setBusy(false); }); return () => { live = false; }; }, []);
  const visibleAssignments = useMemo(() => {
    const query = assignmentSearch.trim().toLocaleLowerCase();
    return assignments.filter((assignment) => {
      const cohortName = cohorts.find((cohort) => cohort.id === assignment.cohort_id)?.name ?? "Cohort";
      const matchesSearch = !query || `${assignment.lesson_title} ${cohortName}`.toLocaleLowerCase().includes(query);
      const matchesCohort = assignmentCohortFilter === "all" || assignment.cohort_id === assignmentCohortFilter;
      const matchesDue = assignmentDueFilter === "all" || (assignmentDueFilter === "dated" ? Boolean(assignment.due_at) : !assignment.due_at);
      return matchesSearch && matchesCohort && matchesDue;
    });
  }, [assignments, cohorts, assignmentSearch, assignmentCohortFilter, assignmentDueFilter]);
  const run = async (action: () => Promise<unknown>) => { setSaving(true); setError(""); try { await action(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "The change could not be saved"); } finally { setSaving(false); } };
  return (
    <>
      <Header
        eyebrow="Educator studio / Delivery"
        title="Assignments"
        description="Published lesson versions and student access policies."
      />
      {error && <Alert variant="destructive"><CircleAlert/><AlertTitle>Delivery action needs attention</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Prepare a cohort</CardTitle><CardDescription>Create a local group and add provisioned student accounts.</CardDescription></CardHeader><CardContent><FieldGroup><Field><FieldLabel htmlFor="cohort-name">Cohort name</FieldLabel><Input id="cohort-name" value={cohortName} onChange={e => setCohortName(e.target.value)} placeholder="Spring evidence seminar"/></Field><Button disabled={saving || cohortName.trim().length < 2} onClick={() => void run(async () => { await api.createEducatorCohort(cohortName.trim()); setCohortName(""); })}>Create cohort</Button></FieldGroup><div className="mt-5 border-t pt-4"><FieldGroup><Field><FieldLabel htmlFor="cohort-select">Cohort</FieldLabel><Select items={cohorts.length ? cohorts.map(c => ({ label: `${c.name} · ${c.student_count} learners`, value: c.id })) : [{ label: "No cohorts available", value: "empty" }]} value={cohortId || null} onValueChange={value => setCohortId(value ?? "")}><SelectTrigger id="cohort-select"><SelectValue placeholder="Choose a cohort"/></SelectTrigger><SelectContent><SelectGroup>{cohorts.length ? cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name} · {c.student_count} learners</SelectItem>) : <SelectItem value="empty" disabled>No cohorts available</SelectItem>}</SelectGroup></SelectContent></Select></Field><Field><FieldLabel htmlFor="student-select">Provisioned student account</FieldLabel><Select items={students.length ? students.map(s => ({ label: s.display_name, value: s.id })) : [{ label: "No student accounts available", value: "empty" }]} value={studentId || null} onValueChange={value => setStudentId(value ?? "")}><SelectTrigger id="student-select"><SelectValue placeholder="Choose a learner"/></SelectTrigger><SelectContent><SelectGroup>{students.length ? students.map(s => <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>) : <SelectItem value="empty" disabled>No student accounts available</SelectItem>}</SelectGroup></SelectContent></Select></Field><Button variant="outline" disabled={saving || !cohortId || !studentId} onClick={() => void run(() => api.addStudentToCohort(cohortId, studentId))}>Add learner to cohort</Button></FieldGroup></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Assign a published lesson</CardTitle><CardDescription>Students receive only the immutable learner version attached to this assignment.</CardDescription></CardHeader><CardContent><FieldGroup><Field><FieldLabel htmlFor="version-select">Published lesson version</FieldLabel><Select items={versions.length ? versions.map(v => ({ label: `${v.title} · v${v.version}`, value: v.version_id })) : [{ label: "No published lessons available", value: "empty" }]} value={versionId || null} onValueChange={value => setVersionId(value ?? "")}><SelectTrigger id="version-select"><SelectValue placeholder="Choose a published lesson"/></SelectTrigger><SelectContent><SelectGroup>{versions.length ? versions.map(v => <SelectItem key={v.version_id} value={v.version_id}>{v.title} · v{v.version}</SelectItem>) : <SelectItem value="empty" disabled>No published lessons available</SelectItem>}</SelectGroup></SelectContent></Select></Field><Field><FieldLabel htmlFor="assignment-cohort">Cohort</FieldLabel><Select items={cohorts.length ? cohorts.map(c => ({ label: `${c.name} · ${c.student_count} learners`, value: c.id })) : [{ label: "No cohorts available", value: "empty" }]} value={cohortId || null} onValueChange={value => setCohortId(value ?? "")}><SelectTrigger id="assignment-cohort"><SelectValue placeholder="Choose a cohort"/></SelectTrigger><SelectContent><SelectGroup>{cohorts.length ? cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name} · {c.student_count} learners</SelectItem>) : <SelectItem value="empty" disabled>No cohorts available</SelectItem>}</SelectGroup></SelectContent></Select></Field><Field><FieldLabel htmlFor="due-at">Due date (optional)</FieldLabel><Input id="due-at" type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)}/></Field><Button disabled={saving || !versionId || !cohortId} onClick={() => void run(() => api.createEducatorAssignment(versionId, cohortId, dueAt ? new Date(dueAt).toISOString() : null))}>Create assignment</Button></FieldGroup></CardContent></Card>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle>Assignments</CardTitle><CardDescription>Search deliveries, narrow by cohort or due date, then open the matching learner reviews.</CardDescription></CardHeader>
        <CardContent>
          {busy ? <Skeleton className="h-20"/> : assignments.length ? <>
            <div className="grid gap-2 border-b border-border pb-4 sm:grid-cols-3">
              <InputGroup className="h-10 w-full sm:col-span-1"><InputGroupAddon><Search aria-hidden="true"/></InputGroupAddon><InputGroupInput aria-label="Search assignments" placeholder="Search lesson or cohort" value={assignmentSearch} onChange={event => setAssignmentSearch(event.target.value)}/></InputGroup>
              <Select items={[{ label: "All cohorts", value: "all" }, ...cohorts.map(cohort => ({ label: cohort.name, value: cohort.id }))]} value={assignmentCohortFilter} onValueChange={value => setAssignmentCohortFilter(value ?? "all")}><SelectTrigger aria-label="Filter assignments by cohort" className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">All cohorts</SelectItem>{cohorts.map(cohort => <SelectItem key={cohort.id} value={cohort.id}>{cohort.name}</SelectItem>)}</SelectGroup></SelectContent></Select>
              <Select items={[{ label: "All due dates", value: "all" }, { label: "Due date set", value: "dated" }, { label: "No due date", value: "undated" }]} value={assignmentDueFilter} onValueChange={value => { if (value === "all" || value === "dated" || value === "undated") setAssignmentDueFilter(value); }}><SelectTrigger aria-label="Filter assignments by due date" className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">All due dates</SelectItem><SelectItem value="dated">Due date set</SelectItem><SelectItem value="undated">No due date</SelectItem></SelectGroup></SelectContent></Select>
            </div>
            {visibleAssignments.length ? <><Table className="hidden sm:table"><TableHeader><TableRow><TableHead>Lesson</TableHead><TableHead>Cohort</TableHead><TableHead>Learners</TableHead><TableHead>Due</TableHead><TableHead><span className="sr-only">Review</span></TableHead></TableRow></TableHeader><TableBody>{visibleAssignments.map(assignment => <TableRow key={assignment.id}><TableCell className="font-medium">{assignment.lesson_title}</TableCell><TableCell>{cohorts.find(cohort => cohort.id === assignment.cohort_id)?.name ?? "Cohort"}</TableCell><TableCell>{assignment.student_count}</TableCell><TableCell>{assignment.due_at ? new Date(assignment.due_at).toLocaleString() : "No due date"}</TableCell><TableCell><Link className={buttonVariants({ variant: "outline", size: "sm" })} to={`/educator/submissions?assignmentId=${encodeURIComponent(assignment.id)}`}>Review</Link></TableCell></TableRow>)}</TableBody></Table><div className="grid gap-2 sm:hidden">{visibleAssignments.map(assignment => <article className="grid gap-2 rounded-lg border border-border p-3" key={assignment.id}><h3 className="m-0 text-sm font-semibold leading-5">{assignment.lesson_title}</h3><p className="m-0 text-xs text-muted-foreground">{cohorts.find(cohort => cohort.id === assignment.cohort_id)?.name ?? "Cohort"} · {assignment.student_count} learners</p><p className="m-0 text-xs text-muted-foreground">{assignment.due_at ? `Due ${new Date(assignment.due_at).toLocaleString()}` : "No due date"}</p><Link className={buttonVariants({ variant: "outline", size: "sm" })} to={`/educator/submissions?assignmentId=${encodeURIComponent(assignment.id)}`}>Review</Link></article>)}</div></> : <Empty className="min-h-36"><EmptyHeader><EmptyMedia variant="icon"><Search/></EmptyMedia><EmptyTitle>No assignments match</EmptyTitle><EmptyDescription>Change the search or clear one of the filters.</EmptyDescription></EmptyHeader></Empty>}
          </> : <Empty className="min-h-40 rounded-lg border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><ClipboardList/></EmptyMedia><EmptyTitle>{versions.length ? "No assignments yet" : "Publish a lesson to begin"}</EmptyTitle><EmptyDescription>{versions.length ? "Choose a lesson version and cohort above to create the first assignment." : "Save a lesson draft with a learner question, review its source terms and publish it before assigning."}</EmptyDescription></EmptyHeader></Empty>}
        </CardContent>
      </Card>
    </>
  );
}
export function Submissions() {
  const [searchParams] = useSearchParams();
  const requestedAssignmentId = searchParams.get("assignmentId") ?? "";
  const [assignments, setAssignments] = useState<EducatorAssignment[]>([]);
  const [assignmentId, setAssignmentId] = useState("");
  const [attempts, setAttempts] = useState<EducatorAttemptReview[]>([]);
  const [criterionPoints, setCriterionPoints] = useState<Record<string, Record<string, string>>>({});
  const [criterionNotes, setCriterionNotes] = useState<Record<string, Record<string, string>>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [attemptSearch, setAttemptSearch] = useState("");
  const [attemptStatusFilter, setAttemptStatusFilter] = useState<"all" | "review_required" | "graded" | "started">("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState("");
  const gradeRequestKeys = useRef<Record<string, { payload: string; key: string }>>({});
  useEffect(() => { let live = true; api.educatorAssignments().then(items => { if (live) { setAssignments(items); setAssignmentId(items.find(item => item.id === requestedAssignmentId)?.id ?? items[0]?.id ?? ""); } }).catch(e => { if (live) setError(e instanceof Error ? e.message : "Assignments could not load"); }).finally(() => { if (live) setBusy(false); }); return () => { live = false; }; }, [requestedAssignmentId]);
  useEffect(() => { if (!assignmentId) { setAttempts([]); return; } let live = true; api.educatorAssignmentAttempts(assignmentId).then(items => { if (!live) return; setAttempts(items); setCriterionPoints(current => Object.fromEntries(items.map(item => [item.attempt_id, current[item.attempt_id] ?? Object.fromEntries(item.rubric_criteria.map(criterion => [criterion.id, String(item.criterion_scores.find(score => score.id === criterion.id)?.earned_points ?? "")]))]))); setCriterionNotes(current => Object.fromEntries(items.map(item => [item.attempt_id, current[item.attempt_id] ?? Object.fromEntries(item.criterion_scores.map(score => [score.id, score.note]))]))); }).catch(e => { if (live) setError(e instanceof Error ? e.message : "Submissions could not load"); }); return () => { live = false; }; }, [assignmentId]);
  const visibleAttempts = useMemo(() => {
    const query = attemptSearch.trim().toLocaleLowerCase();
    return attempts.filter(attempt => {
      const matchesSearch = !query || attempt.student_name.toLocaleLowerCase().includes(query);
      const matchesStatus = attemptStatusFilter === "all"
        || (attemptStatusFilter === "review_required" && attempt.state === "review_required")
        || (attemptStatusFilter === "graded" && (attempt.state === "graded" || attempt.state === "revealed"))
        || (attemptStatusFilter === "started" && (attempt.state === "started" || attempt.state === "submitted"));
      return matchesSearch && matchesStatus;
    });
  }, [attempts, attemptSearch, attemptStatusFilter]);
  const grade = async (attempt: EducatorAttemptReview) => {
    const criterion_scores = attempt.rubric_criteria.map(criterion => {
      const saved = attempt.criterion_scores.find(score => score.id === criterion.id)?.earned_points;
      const raw = criterionPoints[attempt.attempt_id]?.[criterion.id] ?? (saved === undefined ? "" : String(saved));
      return { criterion_id: criterion.id, earned_points: raw.trim() === "" ? Number.NaN : Number(raw), note: criterionNotes[attempt.attempt_id]?.[criterion.id] ?? "" };
    });
    const valid = criterion_scores.length === attempt.rubric_criteria.length && criterion_scores.every((score, index) => Number.isInteger(score.earned_points) && score.earned_points >= 0 && score.earned_points <= attempt.rubric_criteria[index].max_points);
    if (!valid) { setError("Enter an integer score within every criterion’s point limit."); return; }
    const reviewPayload = { criterion_scores, feedback: (feedback[attempt.attempt_id] ?? "").trim(), reason: (reasons[attempt.attempt_id] ?? "").trim() };
    const serializedPayload = JSON.stringify(reviewPayload);
    const previousRequest = gradeRequestKeys.current[attempt.attempt_id];
    const idempotencyKey = previousRequest?.payload === serializedPayload ? previousRequest.key : crypto.randomUUID();
    gradeRequestKeys.current[attempt.attempt_id] = { payload: serializedPayload, key: idempotencyKey };
    setSaving(attempt.attempt_id); setError("");
    try {
      await api.gradeEducatorAttempt(attempt.attempt_id, criterion_scores, reviewPayload.feedback, reviewPayload.reason, idempotencyKey);
      delete gradeRequestKeys.current[attempt.attempt_id];
      setCriterionPoints(current => ({ ...current, [attempt.attempt_id]: Object.fromEntries(criterion_scores.map(item => [item.criterion_id, String(item.earned_points)])) }));
      setAttempts(await api.educatorAssignmentAttempts(assignmentId));
    } catch (e) { setError(e instanceof Error ? e.message : "The review could not be saved"); }
    finally { setSaving(""); }
  };
  return (
    <>
      <Header
        eyebrow="Educator studio / Review"
        title="Submissions"
        description="Review learner evidence against the versioned rubric."
      />
      {error && <Alert variant="destructive"><CircleAlert/><AlertTitle>Submission review needs attention</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <Card><CardHeader><CardTitle>Choose an assignment</CardTitle><CardDescription>Review submitted observations from learners in the assignment cohort.</CardDescription></CardHeader><CardContent><Field><FieldLabel htmlFor="review-assignment">Assignment</FieldLabel><Select items={assignments.length ? assignments.map(a => ({ label: a.lesson_title, value: a.id })) : [{ label: "No assignments available", value: "empty" }]} value={assignmentId || null} onValueChange={value => setAssignmentId(value ?? "")}><SelectTrigger id="review-assignment" className="w-full"><SelectValue placeholder="Choose an assignment"/></SelectTrigger><SelectContent><SelectGroup>{assignments.length ? assignments.map(a => <SelectItem key={a.id} value={a.id}>{a.lesson_title}</SelectItem>) : <SelectItem value="empty" disabled>No assignments available</SelectItem>}</SelectGroup></SelectContent></Select></Field></CardContent></Card>
      <div className="mt-4 flex flex-col gap-4">
        {busy ? <Skeleton className="h-28"/> : !assignmentId ? <Empty className="min-h-48 rounded-lg border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><FileLock2/></EmptyMedia><EmptyTitle>No assignment is ready for review</EmptyTitle><EmptyDescription>Publish a lesson, assign it to a cohort, and learner submissions will appear here.</EmptyDescription></EmptyHeader></Empty> : attempts.length ? <>
          <Card><CardHeader><CardTitle>Learner attempts</CardTitle><CardDescription>Filter by review state or search for a learner before reviewing their evidence and rubric.</CardDescription></CardHeader><CardContent>
            <div className="grid gap-2 pb-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
              <InputGroup className="h-10 w-full"><InputGroupAddon><Search aria-hidden="true"/></InputGroupAddon><InputGroupInput aria-label="Search learner attempts" placeholder="Search learner name" value={attemptSearch} onChange={event => setAttemptSearch(event.target.value)}/></InputGroup>
              <Select items={[{ label: "All review states", value: "all" }, { label: "Awaiting review", value: "review_required" }, { label: "Reviewed", value: "graded" }, { label: "In progress", value: "started" }]} value={attemptStatusFilter} onValueChange={value => { if (value === "all" || value === "review_required" || value === "graded" || value === "started") setAttemptStatusFilter(value); }}><SelectTrigger aria-label="Filter learner attempts by status" className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">All review states</SelectItem><SelectItem value="review_required">Awaiting review</SelectItem><SelectItem value="graded">Reviewed</SelectItem><SelectItem value="started">In progress</SelectItem></SelectGroup></SelectContent></Select>
            </div>
            {visibleAttempts.length ? <><Table className="hidden sm:table"><TableHeader><TableRow><TableHead>Learner</TableHead><TableHead>Status</TableHead><TableHead>Submitted</TableHead><TableHead>Score</TableHead></TableRow></TableHeader><TableBody>{visibleAttempts.map(attempt => <TableRow key={attempt.attempt_id}><TableCell className="font-medium">{attempt.student_name}</TableCell><TableCell>{attempt.state === "review_required" ? "Awaiting review" : attempt.state === "graded" || attempt.state === "revealed" ? "Reviewed" : "In progress"}</TableCell><TableCell>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "Not submitted"}</TableCell><TableCell>{attempt.score === null ? "—" : `${attempt.score}/100`}</TableCell></TableRow>)}</TableBody></Table><div className="grid gap-2 sm:hidden">{visibleAttempts.map(attempt => <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-border p-3" key={attempt.attempt_id}><strong className="col-span-2 text-sm">{attempt.student_name}</strong><span className="text-xs text-muted-foreground">{attempt.state === "review_required" ? "Awaiting review" : attempt.state === "graded" || attempt.state === "revealed" ? "Reviewed" : "In progress"}</span><span className="text-right text-xs text-muted-foreground">{attempt.score === null ? "Not graded" : `${attempt.score}/100`}</span><span className="col-span-2 text-xs text-muted-foreground">{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "Not submitted"}</span></div>)}</div></> : <Empty className="min-h-32"><EmptyHeader><EmptyMedia variant="icon"><Search/></EmptyMedia><EmptyTitle>No learner attempts match</EmptyTitle><EmptyDescription>Change the learner search or choose another review state.</EmptyDescription></EmptyHeader></Empty>}
          </CardContent></Card>
          {visibleAttempts.map(attempt => (
          <Card key={attempt.attempt_id}>
            <CardHeader><div className="eyebrow">{attempt.state === "graded" ? "Reviewed" : "Awaiting review"}</div><CardTitle>{attempt.student_name}</CardTitle><CardDescription>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "Not submitted"}{attempt.score !== null ? ` · current score ${attempt.score}/100` : ""}</CardDescription></CardHeader>
            <CardContent>
              <div className="grid min-w-0 gap-4 xl:grid-cols-2 xl:items-start">
                <div className="grid min-w-0 gap-4">
                  {attempt.observations.map(observation => <div className="rounded-lg border bg-muted/30 p-3" key={observation.block_id}><div className="eyebrow">Learner response</div><p className="whitespace-pre-wrap">{observation.response || "No response provided."}</p></div>)}
                  {attempt.cvs_self_checks?.map(result => <CvsSelfCheckSummary key={result.block_id} result={result}/>)}
                  <EducatorEvidencePreview attempt={attempt}/>
                </div>
                <div className="grid min-w-0 gap-4">
                  {attempt.state === "review_required" || attempt.state === "graded" ? <>
                    <FieldGroup>
                      <div className="eyebrow">Published rubric · {attempt.rubric_criteria.reduce((sum, criterion) => sum + criterion.max_points, 0)} points</div>
                      {attempt.rubric_criteria.map(criterion => <div className="rounded-lg border bg-muted/20 p-3" key={criterion.id}><div className="mb-2"><b>{criterion.title} · up to {criterion.max_points} points</b><p className="text-sm text-muted-foreground">{criterion.description}</p></div><Field><FieldLabel htmlFor={`criterion-score-${attempt.attempt_id}-${criterion.id}`}>Points earned</FieldLabel><Input id={`criterion-score-${attempt.attempt_id}-${criterion.id}`} type="number" min="0" max={criterion.max_points} step="1" value={criterionPoints[attempt.attempt_id]?.[criterion.id] ?? ""} onChange={event => setCriterionPoints(current => ({...current,[attempt.attempt_id]:{...current[attempt.attempt_id],[criterion.id]:event.target.value}}))}/></Field><Field className="mt-2"><FieldLabel htmlFor={`criterion-note-${attempt.attempt_id}-${criterion.id}`}>Criterion feedback (optional)</FieldLabel><Textarea id={`criterion-note-${attempt.attempt_id}-${criterion.id}`} rows={2} value={criterionNotes[attempt.attempt_id]?.[criterion.id] ?? ""} onChange={event => setCriterionNotes(current => ({...current,[attempt.attempt_id]:{...current[attempt.attempt_id],[criterion.id]:event.target.value}}))}/></Field></div>)}
                      <div className="text-sm font-medium">Calculated score: {attempt.rubric_criteria.some(criterion => { const saved = attempt.criterion_scores.find(score => score.id === criterion.id)?.earned_points; const raw = criterionPoints[attempt.attempt_id]?.[criterion.id] ?? (saved === undefined ? "" : String(saved)); return raw.trim() === ""; }) ? "—" : attempt.rubric_criteria.reduce((sum, criterion) => sum + Number(criterionPoints[attempt.attempt_id]?.[criterion.id] ?? attempt.criterion_scores.find(score => score.id === criterion.id)?.earned_points ?? 0), 0)}/100</div>
                      <Field><FieldLabel htmlFor={`feedback-${attempt.attempt_id}`}>Feedback for learner</FieldLabel><Textarea id={`feedback-${attempt.attempt_id}`} minLength={10} rows={3} value={feedback[attempt.attempt_id] ?? ""} onChange={e => setFeedback(previous => ({...previous, [attempt.attempt_id]: e.target.value}))}/></Field>
                      <Field><FieldLabel htmlFor={`reason-${attempt.attempt_id}`}>Review note (recorded with this grade)</FieldLabel><Textarea id={`reason-${attempt.attempt_id}`} minLength={10} rows={2} value={reasons[attempt.attempt_id] ?? ""} onChange={e => setReasons(previous => ({...previous, [attempt.attempt_id]: e.target.value}))}/></Field>
                    </FieldGroup>
                    <Button disabled={saving === attempt.attempt_id || !attempt.rubric_criteria.length || attempt.rubric_criteria.some(criterion => { const saved = attempt.criterion_scores.find(score => score.id === criterion.id)?.earned_points; const raw = criterionPoints[attempt.attempt_id]?.[criterion.id] ?? (saved === undefined ? "" : String(saved)); const value = Number(raw); return raw.trim() === "" || !Number.isInteger(value) || value < 0 || value > criterion.max_points; }) || (feedback[attempt.attempt_id] ?? "").trim().length < 10 || (reasons[attempt.attempt_id] ?? "").trim().length < 10} onClick={() => void grade(attempt)}>{saving === attempt.attempt_id ? "Saving review…" : attempt.state === "graded" ? "Save revised grade" : "Release review"}</Button>
                  </> : <Badge variant="secondary">{attempt.state}</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>
          ))}
        </> : <Empty className="min-h-48 rounded-lg border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><FileLock2/></EmptyMedia><EmptyTitle>No submissions yet</EmptyTitle><EmptyDescription>Learner attempts appear here after they submit an assignment.</EmptyDescription></EmptyHeader></Empty>}
      </div>
    </>
  );
}
