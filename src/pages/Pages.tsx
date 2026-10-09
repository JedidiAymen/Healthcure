import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { LazyMotion, MotionConfig } from "motion/react";
import * as m from "motion/react-m";
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
  type DoseTwinRunRecord,
  type RunRecord,
  type ViewerEvidenceState,
} from "../lib/api";
import { buildSignalComparisonReport } from "../lib/signal-evidence";
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
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AchievementBadge } from "@/components/ui/achievement-badge";
import { PointsBadge } from "@/components/ui/points-badge";
import { queryKeys } from "@/lib/query-client";
import { renderDoseSlicePixels } from "@/lib/dose-visualization";
import clinicalTeamImage from "../assets/clinical-team.jpg";
import radiologyReviewImage from "../assets/radiology-team.jpg";

const loadAcademyMotionFeatures = () =>
  import("@/lib/academy-motion").then((featureModule) => featureModule.default);

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
    ],
    blockers: [
      "Continuous video and unlabeled intermediate frames are not installed",
      "CVS-AdaptNet remains gated on independent checkpoint hash and terms",
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
    ],
    blockers: [
      "No prediction checkpoint is installed",
      "Clinical-treatment workflows remain disabled",
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
  },
} as const;
type ModuleId = keyof typeof specialtyData;
const challengeStatePresentation = {
  not_started: { label: "Not started", variant: "outline" as const },
  in_progress: { label: "In progress", variant: "secondary" as const },
  submitted: { label: "Awaiting review", variant: "secondary" as const },
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
  const sourceInventory = [
    { id: "surgivision", measure: "annotated frames" },
    { id: "dosetwin", measure: "benchmark cases" },
    { id: "fistulaguard", measure: "signal recordings" },
  ] as const;
  return (
    <main className="grid gap-10 pb-8">
      <section className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="flex flex-col justify-center gap-5 py-2 lg:py-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" />
            MEDFORGE · clinical research workspace
          </div>
          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-[-0.045em] text-foreground sm:text-5xl">
              Evidence review for clinicians and medical researchers.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              Inspect surgical frames, radiotherapy benchmark volumes, and measured vascular-access signals with their sources and limits in view.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button render={<Link to="/studio" />} nativeButton={false} size="lg">
              Enter Professional Studio <ArrowRight data-icon="inline-end" />
            </Button>
            <span className="text-sm text-muted-foreground">Research and education use</span>
          </div>
        </div>

        <Card className="self-stretch border-sidebar-border bg-sidebar/60">
          <CardHeader className="border-b border-border/70">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-base">Verified source inventory</CardTitle>
                <CardDescription>Local research material available in this workspace</CardDescription>
              </div>
              <Badge variant="outline" className="shrink-0">3 separate datasets</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Research area</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceInventory.map(({ id, measure }) => {
                  const moduleId = id as ModuleId;
                  const m = specialtyData[moduleId];
                  const count = cases.data.filter((item) => item.module === id).length;
                  return (
                    <TableRow key={id}>
                      <TableCell>
                        <Link className="font-medium text-foreground hover:text-primary focus-visible:rounded-sm" to={`/studio/${id}/cases/current`}>
                          {m.name}
                        </Link>
                        <div className="mt-1 text-xs text-muted-foreground">{m.source} · {measure}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {cases.loading ? "—" : count.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {cases.error ? (
              <p role="status" className="mt-3 text-sm text-destructive">Local case registry is unavailable: {cases.error}</p>
            ) : (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Each specialty keeps its own source, units, and evidence boundaries.
              </p>
            )}
          </CardContent>
          <CardFooter className="border-t border-border/70">
            <Button render={<Link to="/studio/cases" />} nativeButton={false} variant="ghost" size="sm" className="px-0 text-primary">
              Browse the case registry <ArrowRight data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-col gap-1 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Choose your workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">The same verified evidence, shaped for different responsibilities.</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
          <Card className="border-primary/40 bg-primary/[0.035]">
            <CardHeader className="gap-3">
              <Badge variant="outline" className="w-fit border-primary/40 text-primary">For clinicians &amp; researchers</Badge>
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Microscope aria-hidden="true" /></span>
                <div className="space-y-1">
                  <CardTitle>Professional Studio</CardTitle>
                  <CardDescription>Open source cases, inspect measurements, compare compatible evidence, and prepare provenance reports.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <div className="border-t border-border/70 pt-2">Frame and annotation review</div>
              <div className="border-t border-border/70 pt-2">Dose and structure analysis</div>
              <div className="border-t border-border/70 pt-2">Measured signal comparison</div>
            </CardContent>
            <CardFooter>
              <Button render={<Link to="/studio" />} nativeButton={false}>
                Open Professional Studio <ArrowRight data-icon="inline-end" />
              </Button>
            </CardFooter>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Card className="h-full">
              <CardHeader className="gap-3">
                <Badge variant="secondary" className="w-fit">For medical educators</Badge>
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground"><BookOpenCheck aria-hidden="true" /></span>
                  <div className="space-y-1">
                    <CardTitle className="text-base">Educator Studio</CardTitle>
                    <CardDescription>Build source-backed lessons and review learner evidence with a manual rubric.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto">
                <Button render={<Link to="/educator" />} nativeButton={false} variant="outline" size="sm">
                  Open educator tools <ArrowRight data-icon="inline-end" />
                </Button>
              </CardFooter>
            </Card>
            <Card className="h-full">
              <CardHeader className="gap-3">
                <Badge variant="secondary" className="w-fit">For students &amp; trainees</Badge>
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground"><GraduationCap aria-hidden="true" /></span>
                  <div className="space-y-1">
                    <CardTitle className="text-base">Student Academy</CardTitle>
                    <CardDescription>Investigate assigned research cases and receive educator-reviewed feedback.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto">
                <Button render={<Link to="/academy" />} nativeButton={false} variant="outline" size="sm">
                  Open Student Academy <ArrowRight data-icon="inline-end" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
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
  return (
    <div className="relative grid h-full place-items-center overflow-hidden bg-[#0b1420]">
      {data ? <svg viewBox="0 0 128 128" role="img" aria-label="OpenKBP pt_201 axial index slice z54; source CT, reference dose and PTV70 boundary" className="size-32 sm:size-36 [image-rendering:pixelated]">{cells.map((cell) => <rect key={`${cell.x}-${cell.y}`} x={cell.x} y={cell.y} width="4" height="4" fill={cell.fill} />)}</svg> : <div className="grid size-20 place-items-center rounded-full border border-sky-300/20 text-sky-100"><Activity aria-hidden="true" className="size-7" /></div>}
      <span className="absolute bottom-2 left-2 rounded-sm bg-black/65 px-2 py-1 font-mono text-[10px] text-white">{data ? "pt_201 · axial z54 · PTV70 boundary" : "Reading verified OpenKBP arrays…"}</span>
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
        <Card className="relative min-h-[250px] min-w-0 overflow-hidden rounded-lg border-sidebar-border bg-muted p-0 sm:min-h-[300px] lg:min-h-0">
          <div className="absolute inset-0 grid grid-cols-[1.2fr_0.8fr]">
            <img src={radiologyReviewImage} alt="A clinician discussing medical images with a care team" className="size-full object-cover object-center" />
            <img src={clinicalTeamImage} alt="A surgical team working together in an operating room" className="size-full object-cover object-[45%_center]" />
          </div>
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/25 to-slate-950/10" />
          <div className="relative flex h-full min-h-[250px] flex-col justify-end p-5 text-white sm:min-h-[300px] sm:p-6">
            <div className="mb-auto flex items-start justify-between gap-3">
              <Badge variant="outline" className="border-white/45 bg-slate-950/35 text-white backdrop-blur-sm">Clinical teams</Badge>
              <Stethoscope aria-hidden="true" className="size-5 text-white/85" />
            </div>
            <p className="mb-1 text-xl font-medium tracking-tight sm:text-2xl">For people doing the review.</p>
            <p className="max-w-md text-sm leading-5 text-white/80">Surgical educators · radiation oncology · medical physics · nephrology</p>
            <p className="mt-3 text-[11px] leading-4 text-white/65">Representative clinical imagery; not MEDFORGE staff or dataset participants.</p>
          </div>
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
        <div className="case-list">
          {runs.data.slice(0, 5).map((run) => (
            <Link className="case-row" key={run.id} to="/studio/experiments">
              <span className="case-module-icon">
                <FlaskConical size={17} />
              </span>
              <span className="case-primary">
                <b>{run.operation_id}</b>
                <small>
                  {run.case_id} · {run.source_kind} · {run.status}
                </small>
              </span>
              <span className="case-id">{run.id}</span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-slate">
          <Clock3 size={18} />
          <span>
            {runs.loading
              ? "Checking saved runs…"
              : "There is no saved analysis activity. Start with an authorized case from the registry."}
          </span>
          {!runs.loading && (
            <Link to="/studio/cases">
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
  const [filter, setFilter] = useState("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const searchText = searchParams.get("q") ?? "";
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
          className="filter-tabs max-w-full overflow-x-auto"
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
          <div aria-live="polite" className="registry-count whitespace-nowrap">
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
          <div className="case-list">
          {visibleRows.map((c) => (
            <Link
              className="case-row"
              key={c.id}
              to={`/studio/${c.module}/cases/${encodeURIComponent(c.id)}`}
            >
              <span className="case-module-icon">
                <Database size={17} />
              </span>
              <span className="case-primary">
                <b>{c.label}</b>
                <small>
                  {c.dataset_id} · source case {c.source_case_id}
                </small>
              </span>
              <span className="case-origin">
                <span className="state-mark ready" />
                {c.reference_kind}
              </span>
              <span className="case-id">{c.id}</span>
              <ArrowRight size={16} />
            </Link>
          ))}
          </div>
          {pageCount > 1 && <Pagination className="registry-pagination">
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
        <div className="registry-empty">
          <div className="registry-empty-symbol">
            <Database size={22} />
          </div>
          <h2>No cases registered</h2>
          <p>
            The local API only lists data after a source case is installed and
            configured. Nothing has been seeded as a sample patient.
          </p>
          <div className="registry-empty-links">
            {(Object.keys(specialtyData) as ModuleId[]).map((key) => {
              const m = specialtyData[key];
              return (
                <Link key={key} to={`/studio/${key}/cases/current`}>
                  <span>{m.name}</span>
                  <small>{m.source} · requirements</small>
                  <ArrowRight size={14} />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export function DomainWorkspace({ module }: { module: ModuleId }) {
  const m = specialtyData[module],
    Icon = m.icon,
    { caseId = "current" } = useParams();
  const cases = useApi(queryKeys.cases, api.cases, [] as CaseRecord[]);
  if (cases.loading) {
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
  const record =
    caseId === "current"
      ? cases.data.find((c) => c.module === module)
      : cases.data.find((c) => c.id === caseId);
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{record?.label ?? m.subtitle}</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {record
              ? `Source case ${record.source_case_id} · ${record.dataset_id} · ${record.reference_kind}`
              : "No source case has been selected for this workspace."}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 2xl:w-auto 2xl:justify-end">
          <SourceBadge kind={record ? "ready" : "blocked"}>
            {record ? "Source configured" : "Dataset required"}
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
          <DoseViewer key={record.id} caseId={record.id} />
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
            <CardDescription>Availability follows the selected source record.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Table className="table-fixed">
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="w-full whitespace-normal">Method or view</TableHead><TableHead className="w-28 text-right">Availability</TableHead></TableRow></TableHeader>
              <TableBody>
            {m.tasks.map((task, i) => {
              const available =
                Boolean(record) &&
                (module === "dosetwin" ||
                  module === "surgivision" ||
                  module === "fistulaguard");
              return (
                <TableRow key={task}>
                  <TableCell className="whitespace-normal"><span className="mr-2 inline-block font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>{task}</TableCell>
                  <TableCell className="text-right"><Badge variant={available ? "secondary" : "outline"}>{available ? "Available" : "Awaiting source"}</Badge></TableCell>
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
  return (
    <>
      <Header
        eyebrow="Professional studio / Registry"
        title="Model lab"
        description="Readiness is specific to each operation, checkpoint, runtime and compatible source dataset."
      />
      <div className="status-banner subdued">
        <div className="banner-mark">
          <Microscope size={18} />
        </div>
        <div>
          <strong>Model execution follows its source and checkpoint gates</strong>
          <p>
            CVS-AdaptNet has completed a real split evaluation. Single-frame
            runs remain locked until independent checkpoint identity and terms
            are confirmed.
          </p>
        </div>
      </div>
      {error ? (
        <Alert variant="destructive"><CircleAlert/><AlertTitle>Model registry is unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      ) : (
        <div className="model-list">
          {data.map((model) => (
            <Card className="model-card" size="sm" key={model.id}>
              <CardHeader className="model-card-header">
                <CardTitle className="model-card-title">
                  <span className="model-symbol" aria-hidden="true"><FlaskConical size={18} /></span>
                  {model.name}
                </CardTitle>
                <CardAction>
                  <Badge
                    variant="outline"
                    className={`model-readiness ${model.readiness === "ready" ? "is-ready" : "is-blocked"}`}
                  >
                    {model.readiness.replaceAll("-", " ")}
                  </Badge>
                </CardAction>
                <CardDescription>{model.details}</CardDescription>
              </CardHeader>
              <CardContent className="model-card-content">
                <dl className="model-provenance">
                  <div><dt>Source revision</dt><dd><code>{model.source_revision}</code></dd></div>
                  <div><dt>License</dt><dd>{model.source_license}</dd></div>
                </dl>
                <div className="model-ops" aria-label="Supported operations">
                  {model.operation_ids.map((op) => (
                    <Badge variant="secondary" key={op}>{op}</Badge>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="model-card-footer">
                <a href={model.upstream_url} target="_blank" rel="noreferrer">
                  Upstream repository or paper <ExternalLink size={12} />
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={model.id !== "cvs-adaptnet" || model.readiness !== "ready"}
                  title={model.id === "cvs-adaptnet" ? model.details : "Requires a verified local adapter and checkpoint"}
                  render={model.id === "cvs-adaptnet" && model.readiness === "ready" ? <Link to="/studio/surgivision/cases/current" /> : undefined}
                >
                  {model.readiness === "ready" ? <FlaskConical data-icon="inline-start" /> : <LockKeyhole data-icon="inline-start" />}
                  {model.readiness === "ready" ? "Open frame and run" : "Execution blocked"}
                </Button>
              </CardFooter>
            </Card>
          ))}
          {loading && <Skeleton className="h-28 w-full" />}
        </div>
      )}
    </>
  );
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
    <div className="empty-slate roomy">
      <span className="empty-large-icon">
        <Icon size={22} />
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
      <Link to={link}>
        {linkText}
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}
export function Experiments() {
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
          setSelectedRun(doseRuns[0] ?? null);
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
  }, []);
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
        <div className="empty-slate roomy">
          <LoaderCircle size={18} />
          <span>Loading local cases and saved runs…</span>
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
              <Field className="mt-2 grid gap-1.5">
                <FieldLabel htmlFor="run-case-select">Select source case</FieldLabel>
                <Select items={cases.map(c => ({ label: `${c.label} · ${c.reference_kind}`, value: c.id }))} value={caseId || null} onValueChange={(value) => setSelectedCase(value ?? "")}>
                  <SelectTrigger id="run-case-select" className="w-full sm:min-w-72">
                    <SelectValue placeholder="Choose an installed case" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {cases.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label} · {c.reference_kind}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
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
                    <Link className="text-link" to="/studio/reports">
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
          <div className="section-heading section-spaced">
            <div>
              <div className="eyebrow">Saved operations</div>
              <h2>
                {runs.length
                  ? `${runs.length} saved run${runs.length === 1 ? "" : "s"}`
                  : "No analysis runs yet"}
              </h2>
            </div>
          </div>
          {runs.length ? (
            <div className="case-list">
              {runs.map((run) => (
                <Button
                  type="button"
                  variant="ghost"
                  key={run.id}
                  className={`case-row saved-run-row h-auto w-full justify-start whitespace-normal text-left${selectedRun?.id === run.id ? " bg-muted" : ""}`}
                  aria-pressed={selectedRun?.id === run.id}
                  onClick={() => {
                    setSelectedRun(run);
                    setReport(null);
                  }}
                >
                  <span className="case-module-icon">
                    <FlaskConical size={17} />
                  </span>
                  <span className="case-primary">
                    <b>{run.operation_id}</b>
                    <small>
                      {run.case_id} · {run.source_kind} · {run.status}
                    </small>
                  </span>
                  <span className="case-id">{run.id}</span>
                  <ArrowRight size={16} />
                </Button>
              ))}
            </div>
          ) : (
            <div className="empty-slate">
              <span>
                Run the enabled OpenKBP summary to save an idempotent result
                with source provenance.
              </span>
            </div>
          )}
        </>
      )}
    </>
  );
}
type ReportFeedItem =
  | { kind: "openkbp-run"; id: string; created_at: string; report: EvidenceReport }
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
        <div className="empty-slate roomy">
          <LoaderCircle size={18} />
          <span>Loading saved reports…</span>
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
                  <Button variant="outline" size="sm" className="w-fit" onClick={()=>download(report)}><FileText data-icon="inline-start"/>Download JSON evidence</Button>
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
                    {report.document.viewer_state.voxel[2]} ·{" "}
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
          ...reports.map(report=>({kind:(report.document.schema==='medforge.surgivision-source-frame-evidence/v1'?"surgivision-frame":"openkbp-run") as "surgivision-frame"|"openkbp-run",id:report.id,created_at:report.created_at,report})),
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

export function Academy() {
  const challenges = useApi(queryKeys.studentChallenges, api.studentChallenges, [] as StudentChallenge[]);
  const paths = useApi(queryKeys.studentLearningPaths, api.studentLearningPaths, [] as StudentLearningPath[]);
  const progress = useApi(queryKeys.studentProgress, api.studentProgress, { xp: 0, xp_enabled: false, achievements_enabled: false, graded_attempts: 0, average_score: null, assigned_activities: 0, next_activity: null, rubric_dimensions: [], rubric_history: [], achievements: [] } as StudentProgress);
  const pathDetails = {
    surgivision: { label: "Surgical teams", source: "Endoscapes frame evidence", tone: "border-l-sky-700" },
    dosetwin: { label: "Radiation oncology", source: "OpenKBP dose benchmark", tone: "border-l-indigo-700" },
    fistulaguard: { label: "Nephrology and access care", source: "FiSaV measured signals", tone: "border-l-teal-700" },
  } as const;
  const nextActivity = progress.data.next_activity;
  const academyAction = nextActivity
    ? { to: `/academy/missions/${encodeURIComponent(nextActivity.assignment_id)}`, label: nextActivity.state === "resume" ? "Continue lesson" : nextActivity.state === "awaiting_review" ? "Check submitted work" : "Start assigned lesson" }
    : { to: "/academy/paths/surgical-evidence", label: "Explore learning paths" };
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadAcademyMotionFeatures}>
      <Header
        eyebrow="Student academy"
        title="Learn to read the evidence"
        description="Guided investigation rewards careful observation and justified uncertainty, never a medical diagnosis."
        action={<Button render={<Link to={academyAction.to}/>} nativeButton={false}>{academyAction.label}<ArrowRight data-icon="inline-end"/></Button>}
      />
      <m.div
        className="academy-banner"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        <div className="academy-symbol">
          <GraduationCap size={22} />
        </div>
        <div><strong>Evidence first, answers after</strong><p>Only lessons assigned to your cohort appear here. Educator reference material stays private until review.</p></div>
        <SourceBadge kind={challenges.data.length ? "ready" : "planned"}>{challenges.data.length ? `${challenges.data.length} assigned` : "No assignments yet"}</SourceBadge>
      </m.div>
      <section id="academy-pathways" aria-label="Learning pathways">
        {paths.error ? (
          <Alert variant="destructive"><CircleAlert/><AlertTitle>Learning pathways could not load</AlertTitle><AlertDescription>{paths.error}</AlertDescription></Alert>
        ) : (
          <Card className="overflow-hidden py-0">
            <CardHeader className="px-4 pt-4 sm:px-5">
              <CardTitle>Learning pathways</CardTitle>
              <CardDescription>Study by evidence domain. Each path stays with its own source, units and limits; only cohort assignments open as lessons.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {paths.loading ? (
                <div className="grid gap-2 p-4"><Skeleton className="h-16"/><Skeleton className="h-16"/><Skeleton className="h-16"/></div>
              ) : paths.data.length === 0 ? (
                <Empty className="min-h-40 rounded-none border-0"><EmptyHeader><EmptyMedia variant="icon"><BookOpenCheck/></EmptyMedia><EmptyTitle>No learning pathways available</EmptyTitle><EmptyDescription>Published pathways will appear here when they are available.</EmptyDescription></EmptyHeader></Empty>
              ) : paths.data.map((path) => {
                const detail = pathDetails[path.module];
                const waiting = path.submitted_count;
                const reviewed = path.reviewed_count;
                return (
                  <Link
                    key={path.path_id}
                    to={`/academy/paths/${encodeURIComponent(path.path_id)}`}
                    className={`group grid gap-3 border-l-4 border-b px-4 py-4 last:border-b-0 hover:bg-muted/40 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring lg:grid-cols-[minmax(0,1.2fr)_minmax(180px,1fr)_auto] lg:items-center sm:px-5 ${detail.tone}`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <AcademyPathPreview path={path}/>
                      <span className="grid min-w-0 gap-1"><span className="font-medium text-foreground group-hover:text-primary">{detail.label}</span><span className="break-words text-sm text-muted-foreground">{path.title} / {detail.source}</span></span>
                    </div>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="font-medium tabular-nums text-foreground">{path.assigned_count}</span>{path.assigned_count === 1 ? "assigned lesson" : "assigned lessons"}
                      <span aria-hidden="true" className="text-border">|</span><span>{reviewed} reviewed</span>
                      {waiting > 0 && <><span aria-hidden="true" className="text-border">|</span><span>{waiting} awaiting review</span></>}
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">Open path <ArrowRight aria-hidden="true"/></span>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        )}
      </section>
      <div className="academy-columns">
        <Card className="learning-panel">
          <CardHeader className="panel-section-head">
            <div>
              <div className="eyebrow">Released coursework</div>
              <CardTitle>
                <h2>Assigned lessons</h2>
              </CardTitle>
            </div>
            <span className="progress-label">{challenges.loading ? "Loading" : `${challenges.data.length} assigned`}</span>
          </CardHeader>
          <CardContent>
            {challenges.error ? <Alert variant="destructive"><CircleAlert/><AlertTitle>Assignments could not load</AlertTitle><AlertDescription>{challenges.error}</AlertDescription></Alert> : challenges.data.length ? <div className="mt-4 divide-y border-t">{challenges.data.map((challenge) => {
              const state = challengeStatePresentation[challenge.state];
              const area = specialtyData[challenge.module as ModuleId];
              return <Link to={`/academy/missions/${encodeURIComponent(challenge.assignment_id)}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 border-b py-3 last:border-b-0 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center" key={challenge.assignment_id}><Badge className="col-start-2 row-start-1 w-fit justify-self-end sm:col-start-1 sm:justify-self-start" variant={state.variant}>{state.label}</Badge><span className="col-start-1 row-start-1 min-w-0 sm:col-start-2"><b className="break-words leading-5">{challenge.title}</b><small className="mt-1 block break-words leading-5">{area.name} / {challenge.case_label} / version {challenge.version}{challenge.due_at ? ` / due ${new Date(challenge.due_at).toLocaleDateString()}` : ""}</small></span><span className="col-span-2 inline-flex items-center justify-self-end gap-2 text-sm font-medium text-primary sm:col-span-1"><ArrowRight aria-hidden="true"/>Open lesson</span></Link>;
            })}</div> : <Empty className="min-h-52 rounded-lg border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><BookOpenCheck/></EmptyMedia><EmptyTitle>{challenges.loading ? "Loading assigned lessons" : "No lessons assigned yet"}</EmptyTitle><EmptyDescription>{challenges.loading ? "Checking your cohort assignments." : "Your educator’s published lessons will appear here when they assign them to your cohort."}</EmptyDescription></EmptyHeader></Empty>}
          </CardContent>
        </Card>
        <Card className="learning-aside">
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
            {progress.loading ? <Skeleton className="h-12"/> : progress.data.xp_enabled ? <PointsBadge size="sm" icon={Sparkles} name="Experience points" total={progress.data.xp} className="my-3 w-full justify-between border-0 bg-transparent px-0 py-1 shadow-none"/> : <div className="aside-stat"><span><Sparkles size={16}/>Experience points</span><b>Off</b></div>}
            <div className="aside-stat"><span><ClipboardCheck size={16}/>Reviewed submissions</span><b>{progress.loading ? "—" : progress.data.graded_attempts}</b></div>
            {progress.data.average_score !== null && <p className="text-muted-foreground">Average reviewed score: {progress.data.average_score.toFixed(1)}%</p>}
            <div className="mt-3 grid gap-2 border-t pt-3">
              <div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">Activity awards</span><span className="text-muted-foreground">{progress.loading ? "Loading" : progress.data.achievements_enabled ? "Opted in" : "Off"}</span></div>
              {progress.data.achievements_enabled && progress.data.achievements.length > 0 ? (
                <div role="list" aria-label="Earned activity awards" className="grid gap-2">
                  {progress.data.achievements.map((achievement) => <div role="listitem" key={achievement.key} className="grid gap-1">
                    <Badge variant="secondary" className="w-fit"><Trophy data-icon="inline-start"/>{achievement.title}</Badge>
                    <p className="text-xs leading-5 text-muted-foreground">{achievement.description} Earned {new Date(achievement.earned_at).toLocaleDateString()}.</p>
                  </div>)}
                </div>
              ) : progress.data.achievements_enabled ? <p className="text-xs leading-5 text-muted-foreground">No award yet. Recognition follows an educator-reviewed investigation.</p> : <p className="text-xs leading-5 text-muted-foreground">Private recognition stays off unless you opt in.</p>}
            </div>
            </>}
            <Link to="/academy/progress" className="text-link">
              {progress.data.xp_enabled && !progress.error ? "View progress record" : "Progress and privacy settings"} <ArrowRight size={14} />
            </Link>
          </CardContent>
        </Card>
      </div>
      </LazyMotion>
    </MotionConfig>
  );
}
export function Mission() {
  const { missionId } = useParams();
  const [attempt, setAttempt] = useState<StudentAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [viewerEvidence, setViewerEvidence] = useState<StudentViewerEvidence | null>(null);
  const [debrief, setDebrief] = useState<StudentDebrief | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!missionId) return;
    let live = true;
    setBusy(true);
    setAttempt(null);
    setAnswers({});
    setViewerEvidence(null);
    setDebrief(null);
    setError("");
    api.studentStartAttempt(missionId).then(value => {
      if (!live) return;
      setAttempt(value);
      setAnswers(Object.fromEntries(value.observations.map(item => [item.block_id, item.response])));
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
    const updated = await save();
    if (!updated) return;
    setSaving(true);
    try {
      await api.submitStudentAttempt(updated.attempt_id, updated.revision, crypto.randomUUID());
      setAttempt(await api.studentAttempt(updated.attempt_id));
    } catch (e) { setError(e instanceof Error ? e.message : "Submission could not be sent"); }
    finally { setSaving(false); }
  };
  if (busy) return <Card><CardHeader><CardTitle>Opening your assignment…</CardTitle><CardDescription>Loading the student-safe lesson version.</CardDescription></CardHeader><CardContent><Skeleton className="h-24"/></CardContent></Card>;
  if (!attempt) return <><Header eyebrow="Student academy / Assignment" title="Assignment unavailable" description={error || "This assignment is not available to your account."}/><EmptyWork icon={LockKeyhole} title="No student lesson is available" body={error || "Ask your educator to check the cohort assignment."} link="/academy" linkText="Back to Academy"/></>;
  const locked = attempt.state !== "started";
  const sourceId = attempt.challenge.case_id.split(":").at(-1) ?? attempt.challenge.case_id;
  const evidenceSummary = viewerEvidence?.kind === "dosetwin"
    ? `OpenKBP voxel x ${viewerEvidence.voxel[0]} · y ${viewerEvidence.voxel[1]} · z ${viewerEvidence.voxel[2]} · ${viewerEvidence.roi}`
    : viewerEvidence?.kind === "surgivision"
      ? `Endoscapes frame ${viewerEvidence.frame_id} · source pixel x ${viewerEvidence.selection_x_px}, y ${viewerEvidence.selection_y_px}`
      : viewerEvidence?.kind === "fistulaguard"
        ? `FiSaV ${viewerEvidence.record_id} · ${viewerEvidence.channel} · ${viewerEvidence.start_sec.toFixed(1)}–${(viewerEvidence.start_sec + viewerEvidence.duration_sec).toFixed(1)} s`
        : "No source selection yet";
  return (
    <>
      <Header
        eyebrow={`Student academy / ${attempt.challenge.module} / Assignment`}
        title={attempt.challenge.title}
        description={`${attempt.challenge.case_label} · versioned source lesson · ${attempt.challenge.source_license}`}
      />
      {error && <Alert variant="destructive"><CircleAlert/><AlertTitle>Action could not be completed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <Card className="mb-4"><CardHeader><div className="eyebrow">Assigned evidence</div><CardTitle>{attempt.challenge.case_label}</CardTitle><CardDescription>The scientific viewer is limited to the case attached to this assignment. Reference labels {debrief?.reference_evidence ? "are now available after educator review." : "remain hidden until educator review."}</CardDescription></CardHeader><CardContent><Suspense fallback={<Skeleton className="h-72"/>}>{attempt.challenge.module === "dosetwin" ? <DoseViewer key={attempt.challenge.case_id} caseId={attempt.challenge.case_id} guided onEvidenceChange={setViewerEvidence} viewerEvidence={viewerEvidence?.kind === "dosetwin" ? viewerEvidence : null} locked={locked}/> : attempt.challenge.module === "surgivision" ? <SurgiViewer key={attempt.challenge.case_id} frameId={attempt.challenge.case_id} availableFrameIds={[attempt.challenge.case_id]} guided releasedReference={debrief?.reference_evidence} viewerEvidence={viewerEvidence} onEvidenceChange={setViewerEvidence} locked={locked}/> : <FistulaViewer key={sourceId} recordId={sourceId} availableRecordIds={[sourceId]} guided viewerEvidence={viewerEvidence?.kind === "fistulaguard" ? viewerEvidence : null} onEvidenceChange={setViewerEvidence} locked={locked}/>}</Suspense><div className="mt-4 rounded-lg border bg-muted/20 px-3 py-2 text-sm"><b>{viewerEvidence ? "Evidence selected" : "Select evidence to submit"}</b><span className="ml-2 text-muted-foreground">{evidenceSummary}</span></div></CardContent></Card>
      {attempt.state === "review_required" && <Card><CardHeader><CardTitle>Submission received</CardTitle><CardDescription>Your educator will review your observations before releasing feedback and reference material.</CardDescription></CardHeader></Card>}
      {debrief && <Card><CardHeader><CardTitle>Educator debrief</CardTitle><CardDescription>{debrief.score}/{debrief.max_score} · {debrief.xp_awarded} XP</CardDescription></CardHeader><CardContent><p>{debrief.feedback}</p><div className="mt-4 border-t pt-4"><b>Scored criteria</b><div className="mt-3 flex flex-col gap-3">{debrief.criterion_scores.map(criterion => <div className="rounded-lg border bg-muted/20 p-3" key={criterion.id}><div className="flex flex-wrap justify-between gap-2"><b>{criterion.title}</b><b>{criterion.earned_points}/{criterion.max_points}</b></div><p className="text-sm text-muted-foreground">{criterion.description}</p>{criterion.note && <p className="mt-2 whitespace-pre-wrap">{criterion.note}</p>}</div>)}</div><b className="mt-4 block">Rubric notes</b><p>{debrief.rubric}</p></div>{debrief.reveal_blocks.length > 0 && <div className="mt-4 flex flex-col gap-3 border-t pt-4"><b>Educator reference</b>{debrief.reveal_blocks.map(block => <section key={block.id}><h3 className="font-medium">{block.title}</h3><p className="whitespace-pre-wrap text-muted-foreground">{block.content}</p></section>)}</div>}</CardContent></Card>}
      <div className="flex flex-col gap-4">{attempt.challenge.blocks.map((block, index) => <Card key={block.id}><CardHeader><div className="eyebrow">{block.type} · {String(index+1).padStart(2,"0")}</div><CardTitle>{block.title}</CardTitle><CardDescription>{block.content}</CardDescription></CardHeader>{block.type === "Question" && <CardContent><FieldGroup><Field><FieldLabel htmlFor={`answer-${block.id}`}>Your observation</FieldLabel><Textarea id={`answer-${block.id}`} value={answers[block.id] ?? ""} disabled={locked} onChange={event => setAnswers(previous => ({...previous, [block.id]: event.target.value}))} placeholder="Describe what the evidence supports and what remains uncertain." rows={5}/></Field></FieldGroup></CardContent>}</Card>)}</div>
      {!locked && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save draft"}</Button><Button disabled={saving || !viewerEvidence || !attempt.challenge.blocks.some(block => block.type === "Question" && (answers[block.id] ?? "").trim())} onClick={() => void submit()}>{saving ? "Submitting…" : "Submit for educator review"}</Button></div>}
    </>
  );
}
export function Progress() {
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
        <Card className="mt-4"><CardHeader><CardTitle>Activity achievements</CardTitle><CardDescription>Private, optional recognition for completed learning activity. These awards do not represent professional or clinical skill.</CardDescription></CardHeader><CardContent>{progress.loading || achievementsEnabled === null ? <Skeleton className="h-20"/> : !achievementsEnabled ? <p className="text-sm text-muted-foreground">Off. Opt in above to earn activity awards from future educator-reviewed submissions.</p> : achievements.length ? <div className="grid gap-3 sm:grid-cols-2">{achievements.map(achievement => <div key={achievement.key} className="flex items-center gap-3 rounded-lg border p-3"><AchievementBadge badgeSize="sm" achievement={{id:achievement.key,name:achievement.title,trigger:"api",achievedAt:achievement.earned_at}} className="shrink-0 border-0 bg-transparent p-0 shadow-none"/><div className="min-w-0"><p className="text-sm">{achievement.description}</p><p className="mt-1 text-xs text-muted-foreground">Earned {new Date(achievement.earned_at).toLocaleDateString()}</p></div></div>)}</div> : <Empty className="min-h-28 rounded-lg border border-dashed"><EmptyHeader><EmptyTitle>No activity award yet</EmptyTitle><EmptyDescription>Complete a source-backed investigation and wait for an educator-reviewed submission before an award can be recorded.</EmptyDescription></EmptyHeader></Empty>}</CardContent></Card>
        <Card className="mt-4"><CardHeader><CardTitle>Participation record</CardTitle><CardDescription>Download a local summary of started and submitted lessons, including educator-reviewed scores. Free-text answers are not included.</CardDescription></CardHeader><CardContent className="flex flex-col items-start gap-3"><Button variant="outline" onClick={() => void exportParticipationRecord()} disabled={progress.loading || recordExporting}><Download data-icon="inline-start"/>{recordExporting ? "Preparing record…" : "Download participation record"}</Button>{recordExportError && <p role="alert" className="text-sm text-destructive">{recordExportError}</p>}</CardContent></Card>
      </>}
      <div className="mt-4"><Link to="/academy" className="text-link">Return to assignments <ArrowRight size={14}/></Link></div>
    </>
  );
}

export const LessonEditor = lazy(() =>
  import("./LessonEditor").then((module) => ({
    default: module.LessonEditorPage,
  })),
);
export function Educator() {
  const drafts = useApi(queryKeys.educatorDrafts, api.educatorDrafts, [] as EducatorDraftSummary[]);
  return (
    <>
      <Header
        eyebrow="Educator studio"
        title="Build evidence lessons"
        description="Compose source-grounded learning activities. Drafts are saved under your local educator account; publication remains gated until rights review and immutable learner-safe versions are enforced."
        action={
          <Button render={<Link to="/educator/cases/new/edit" />} nativeButton={false}>
            <Microscope data-icon="inline-start" />
            Create lesson draft
          </Button>
        }
      />
      <div className="academy-banner">
        <div className="academy-symbol">
          <ShieldCheck size={22} />
        </div>
        <div>
          <strong>Server-owned drafts, controlled learner access</strong>
          <p>
            Lesson prompts and rubrics stay in educator-only records.
            Assignments and answer reveal require immutable versions and
            reviewed source permissions.
          </p>
        </div>
        <SourceBadge kind="blocked">Publishing gated</SourceBadge>
      </div>
      <div className="academy-columns">
        <Card className="learning-panel">
          <CardHeader className="panel-section-head">
            <div>
              <div className="eyebrow">Your drafts</div>
              <CardTitle>
                <h2>
                  {drafts.loading
                    ? "Loading saved drafts"
                    : drafts.data.length
                      ? `${drafts.data.length} saved lesson${drafts.data.length === 1 ? "" : "s"}`
                      : "No saved drafts yet"}
                </h2>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {drafts.error ? (
              <Alert variant="destructive"><CircleAlert/><AlertTitle>Could not load saved drafts</AlertTitle><AlertDescription>{drafts.error}</AlertDescription></Alert>
            ) : drafts.data.length ? (
              <div className="case-list">
                {drafts.data.map((draft) => (
                  <Link
                    className="case-row"
                    key={draft.id}
                    to={`/educator/cases/${draft.id}/edit`}
                  >
                    <span className="case-module-icon">
                      <ClipboardList size={17} />
                    </span>
                    <span className="case-primary">
                      <b>{draft.title}</b>
                      <small>
                        {draft.module} · {draft.case_id} · revision{" "}
                        {draft.revision}
                      </small>
                    </span>
                    <span className="case-id">
                      {new Date(
                        `${draft.updated_at.replace(" ", "T")}Z`,
                      ).toLocaleDateString()}
                    </span>
                    <ArrowRight size={16} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-slate">
                <ClipboardList size={18} />
                <span>
                  {drafts.loading
                    ? "Checking your local educator account…"
                    : "Create a draft to begin a source-grounded lesson."}
                </span>
                {!drafts.loading && (
                  <Link to="/educator/cases/new/edit">
                    Create lesson <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            )}
            <div className="path-links">
              <Link to="/educator/assignments">
                <span>
                  <BookOpenCheck size={16} />
                  Assignments
                </span>
                <ArrowRight size={15} />
              </Link>
              <Link to="/educator/submissions">
                <span>
                  <FileLock2 size={16} />
                  Submission review
                </span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card className="learning-aside">
          <CardHeader>
            <div className="eyebrow">Integrity boundary</div>
            <CardTitle>
              <h3>Keep educator answers protected.</h3>
            </CardTitle>
            <CardDescription>
              Drafts are editable only by their owner. Students receive
              published assignment summaries only; the attempt and reveal
              services are not yet enabled.
            </CardDescription>
          </CardHeader>
        </Card>
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
      <Card className="mt-4"><CardHeader><CardTitle>Assignments</CardTitle><CardDescription>Lessons currently delivered to educator-owned cohorts.</CardDescription></CardHeader><CardContent>{busy ? <Skeleton className="h-20"/> : assignments.length ? <div className="mission-rows">{assignments.map(a => <div className="mission-row" key={a.id}><span className="mission-num"><ClipboardList size={16}/></span><span><b>{a.lesson_title}</b><small>{cohorts.find(c => c.id === a.cohort_id)?.name ?? "Cohort"} · {a.student_count} learners{a.due_at ? ` · due ${new Date(a.due_at).toLocaleString()}` : " · no due date"}</small></span><Badge variant="outline">Assigned</Badge></div>)}</div> : <Empty className="min-h-40 rounded-lg border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><ClipboardList/></EmptyMedia><EmptyTitle>{versions.length ? "No assignments yet" : "Publish a lesson to begin"}</EmptyTitle><EmptyDescription>{versions.length ? "Choose a lesson version and cohort above to create the first assignment." : "Save a lesson draft with a learner question, review its source terms and publish it before assigning."}</EmptyDescription></EmptyHeader></Empty>}</CardContent></Card>
    </>
  );
}
export function Submissions() {
  const [assignments, setAssignments] = useState<EducatorAssignment[]>([]);
  const [assignmentId, setAssignmentId] = useState("");
  const [attempts, setAttempts] = useState<EducatorAttemptReview[]>([]);
  const [criterionPoints, setCriterionPoints] = useState<Record<string, Record<string, string>>>({});
  const [criterionNotes, setCriterionNotes] = useState<Record<string, Record<string, string>>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState("");
  const gradeRequestKeys = useRef<Record<string, { payload: string; key: string }>>({});
  useEffect(() => { let live = true; api.educatorAssignments().then(items => { if (live) { setAssignments(items); setAssignmentId(items[0]?.id ?? ""); } }).catch(e => { if (live) setError(e instanceof Error ? e.message : "Assignments could not load"); }).finally(() => { if (live) setBusy(false); }); return () => { live = false; }; }, []);
  useEffect(() => { if (!assignmentId) { setAttempts([]); return; } let live = true; api.educatorAssignmentAttempts(assignmentId).then(items => { if (!live) return; setAttempts(items); setCriterionPoints(current => Object.fromEntries(items.map(item => [item.attempt_id, current[item.attempt_id] ?? Object.fromEntries(item.rubric_criteria.map(criterion => [criterion.id, String(item.criterion_scores.find(score => score.id === criterion.id)?.earned_points ?? "")]))]))); setCriterionNotes(current => Object.fromEntries(items.map(item => [item.attempt_id, current[item.attempt_id] ?? Object.fromEntries(item.criterion_scores.map(score => [score.id, score.note]))]))); }).catch(e => { if (live) setError(e instanceof Error ? e.message : "Submissions could not load"); }); return () => { live = false; }; }, [assignmentId]);
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
      <div className="mt-4 flex flex-col gap-4">{busy ? <Skeleton className="h-28"/> : !assignmentId ? <Empty className="min-h-48 rounded-lg border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><FileLock2/></EmptyMedia><EmptyTitle>No assignment is ready for review</EmptyTitle><EmptyDescription>Publish a lesson, assign it to a cohort, and learner submissions will appear here.</EmptyDescription></EmptyHeader></Empty> : attempts.length ? attempts.map(attempt => <Card key={attempt.attempt_id}><CardHeader><div className="eyebrow">{attempt.state === "graded" ? "Reviewed" : "Awaiting review"}</div><CardTitle>{attempt.student_name}</CardTitle><CardDescription>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "Not submitted"}{attempt.score !== null ? ` · current score ${attempt.score}/100` : ""}</CardDescription></CardHeader><CardContent><div className="flex flex-col gap-4">{attempt.observations.map(observation => <div className="rounded-lg border bg-muted/30 p-3" key={observation.block_id}><div className="eyebrow">Learner response</div><p className="whitespace-pre-wrap">{observation.response || "No response provided."}</p></div>)}{attempt.viewer_evidence && <div className="rounded-lg border bg-muted/20 p-3"><div className="eyebrow">Learner-selected source evidence</div><b>{attempt.viewer_evidence.kind === "dosetwin" ? `OpenKBP voxel x ${attempt.viewer_evidence.voxel[0]} · y ${attempt.viewer_evidence.voxel[1]} · z ${attempt.viewer_evidence.voxel[2]} · ${attempt.viewer_evidence.roi}` : attempt.viewer_evidence.kind === "surgivision" ? `Endoscapes ${attempt.viewer_evidence.frame_id} · pixel x ${attempt.viewer_evidence.selection_x_px}, y ${attempt.viewer_evidence.selection_y_px}` : `FiSaV ${attempt.viewer_evidence.record_id} · ${attempt.viewer_evidence.channel} · ${attempt.viewer_evidence.start_sec.toFixed(1)}–${(attempt.viewer_evidence.start_sec + attempt.viewer_evidence.duration_sec).toFixed(1)} s`}</b></div>}{attempt.state === "review_required" || attempt.state === "graded" ? <><FieldGroup><div className="eyebrow">Published rubric · {attempt.rubric_criteria.reduce((sum, criterion) => sum + criterion.max_points, 0)} points</div>{attempt.rubric_criteria.map(criterion => <div className="rounded-lg border bg-muted/20 p-3" key={criterion.id}><div className="mb-2"><b>{criterion.title} · up to {criterion.max_points} points</b><p className="text-sm text-muted-foreground">{criterion.description}</p></div><Field><FieldLabel htmlFor={`criterion-score-${attempt.attempt_id}-${criterion.id}`}>Points earned</FieldLabel><Input id={`criterion-score-${attempt.attempt_id}-${criterion.id}`} type="number" min="0" max={criterion.max_points} step="1" value={criterionPoints[attempt.attempt_id]?.[criterion.id] ?? ""} onChange={event => setCriterionPoints(current => ({...current,[attempt.attempt_id]:{...current[attempt.attempt_id],[criterion.id]:event.target.value}}))}/></Field><Field className="mt-2"><FieldLabel htmlFor={`criterion-note-${attempt.attempt_id}-${criterion.id}`}>Criterion feedback (optional)</FieldLabel><Textarea id={`criterion-note-${attempt.attempt_id}-${criterion.id}`} rows={2} value={criterionNotes[attempt.attempt_id]?.[criterion.id] ?? ""} onChange={event => setCriterionNotes(current => ({...current,[attempt.attempt_id]:{...current[attempt.attempt_id],[criterion.id]:event.target.value}}))}/></Field></div>)}<div className="text-sm font-medium">Calculated score: {attempt.rubric_criteria.some(criterion => { const saved = attempt.criterion_scores.find(score => score.id === criterion.id)?.earned_points; const raw = criterionPoints[attempt.attempt_id]?.[criterion.id] ?? (saved === undefined ? "" : String(saved)); return raw.trim() === ""; }) ? "—" : attempt.rubric_criteria.reduce((sum, criterion) => sum + Number(criterionPoints[attempt.attempt_id]?.[criterion.id] ?? attempt.criterion_scores.find(score => score.id === criterion.id)?.earned_points ?? 0), 0)}/100</div><Field><FieldLabel htmlFor={`feedback-${attempt.attempt_id}`}>Feedback for learner</FieldLabel><Textarea id={`feedback-${attempt.attempt_id}`} minLength={10} rows={3} value={feedback[attempt.attempt_id] ?? ""} onChange={e => setFeedback(previous => ({...previous, [attempt.attempt_id]: e.target.value}))}/></Field><Field><FieldLabel htmlFor={`reason-${attempt.attempt_id}`}>Review note (recorded with this grade)</FieldLabel><Textarea id={`reason-${attempt.attempt_id}`} minLength={10} rows={2} value={reasons[attempt.attempt_id] ?? ""} onChange={e => setReasons(previous => ({...previous, [attempt.attempt_id]: e.target.value}))}/></Field></FieldGroup><Button disabled={saving === attempt.attempt_id || !attempt.rubric_criteria.length || attempt.rubric_criteria.some(criterion => { const saved = attempt.criterion_scores.find(score => score.id === criterion.id)?.earned_points; const raw = criterionPoints[attempt.attempt_id]?.[criterion.id] ?? (saved === undefined ? "" : String(saved)); const value = Number(raw); return raw.trim() === "" || !Number.isInteger(value) || value < 0 || value > criterion.max_points; }) || (feedback[attempt.attempt_id] ?? "").trim().length < 10 || (reasons[attempt.attempt_id] ?? "").trim().length < 10} onClick={() => void grade(attempt)}>{saving === attempt.attempt_id ? "Saving review…" : attempt.state === "graded" ? "Save revised grade" : "Release review"}</Button></> : <Badge variant="secondary">{attempt.state}</Badge>}</div></CardContent></Card>) : <Empty className="min-h-48 rounded-lg border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><FileLock2/></EmptyMedia><EmptyTitle>No submissions yet</EmptyTitle><EmptyDescription>Learner attempts appear here after they submit an assignment.</EmptyDescription></EmptyHeader></Empty>}</div>
    </>
  );
}
