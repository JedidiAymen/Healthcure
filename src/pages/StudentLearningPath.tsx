import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Activity, BookOpenCheck, CalendarClock, Check, CircleDot, Clock3, Database, Microscope, Radio, Stethoscope } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type StudentLearningPath as LearningPath, type StudentLearningPathLesson } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

const discipline = {
  surgivision: { name: "Surgical teams", source: "Endoscapes", Icon: Stethoscope, tone: "border-l-sky-700" },
  dosetwin: { name: "Radiation oncology", source: "OpenKBP", Icon: Activity, tone: "border-l-indigo-700" },
  fistulaguard: { name: "Nephrology and access care", source: "FiSaV", Icon: Radio, tone: "border-l-teal-700" },
} as const;

const statePresentation = {
  not_started: { label: "Not started", variant: "outline" as const, Icon: CircleDot },
  in_progress: { label: "In progress", variant: "secondary" as const, Icon: Clock3 },
  submitted: { label: "Awaiting review", variant: "secondary" as const, Icon: CalendarClock },
  reviewed: { label: "Reviewed", variant: "outline" as const, Icon: Check },
};

function LessonRow({ lesson }: { lesson: StudentLearningPathLesson }) {
  const status = statePresentation[lesson.state];
  const StatusIcon = status.Icon;
  return (
    <li className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <Link
          to={`/academy/missions/${encodeURIComponent(lesson.assignment_id)}`}
          className="inline-flex max-w-full items-center gap-2 rounded-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span className="min-w-0 break-words">{lesson.title}</span>
          <ArrowRight aria-hidden="true" className="shrink-0" />
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{lesson.case_label}</span><span aria-hidden="true">/</span><span>Lesson version {lesson.version}</span>
          {lesson.due_at && <><span aria-hidden="true">/</span><span>Due {new Date(lesson.due_at).toLocaleDateString()}</span></>}
        </div>
      </div>
      <Badge variant={status.variant} className="w-fit">
        <StatusIcon data-icon="inline-start" />{status.label}
      </Badge>
    </li>
  );
}

function AssignedLessons({ path }: { path: LearningPath }) {
  if (!path.lessons.length) {
    return (
      <Empty className="min-h-48 rounded-md border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon"><BookOpenCheck /></EmptyMedia>
          <EmptyTitle>No lessons assigned to this path</EmptyTitle>
          <EmptyDescription>When an educator assigns a published {discipline[path.module].source} lesson to your cohort, it will appear here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return <ul className="divide-y">{path.lessons.map((lesson) => <LessonRow key={lesson.assignment_id} lesson={lesson} />)}</ul>;
}

function PathContent({ path }: { path: LearningPath }) {
  const field = discipline[path.module];
  const FieldIcon = field.Icon;
  const notStarted = path.assigned_count - path.in_progress_count - path.submitted_count - path.reviewed_count;
  return (
    <>
      <div className="mb-5">
        <Button render={<Link to="/academy" />} nativeButton={false} variant="ghost" size="sm" className="-ml-3">
          <ArrowLeft data-icon="inline-start" />All pathways
        </Button>
      </div>
      <header className="mb-7 grid gap-4 border-b pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="max-w-3xl">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline"><FieldIcon data-icon="inline-start" />{field.name}</Badge>
            <span className="text-sm text-muted-foreground">Source: {field.source}</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{path.title}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{path.description}</p>
        </div>
        <div className="grid min-w-56 grid-cols-2 gap-x-5 gap-y-2 border-l-2 border-primary/50 pl-4 text-sm">
          <span className="text-muted-foreground">Assigned lessons</span><span className="text-right font-medium tabular-nums">{path.assigned_count}</span>
          <span className="text-muted-foreground">In progress</span><span className="text-right font-medium tabular-nums">{path.in_progress_count}</span>
          <span className="text-muted-foreground">Awaiting review</span><span className="text-right font-medium tabular-nums">{path.submitted_count}</span>
          <span className="text-muted-foreground">Reviewed</span><span className="text-right font-medium tabular-nums">{path.reviewed_count}</span>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.75fr)]">
        <Card className={`border-l-4 ${field.tone}`}>
          <CardHeader>
            <CardTitle>Assigned lessons</CardTitle>
            <CardDescription>Only work released to your cohort is shown. A review marks educator feedback on an assignment, not mastery of a clinical skill.</CardDescription>
          </CardHeader>
          <CardContent>
            <AssignedLessons path={path} />
          </CardContent>
          {path.lessons.length > 0 && <CardFooter className="text-sm text-muted-foreground">{notStarted} not started / {path.reviewed_count} reviewed</CardFooter>}
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>What you will practice</CardTitle>
              <CardDescription>Objectives reflect evidence review, not clinical certification.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3">
                {path.objectives.map((objective) => <li key={objective} className="flex gap-3 text-sm leading-6"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"/><span>{objective}</span></li>)}
              </ul>
              <Separator className="my-4" />
              <div className="grid gap-1 text-sm"><span className="font-medium">Prerequisites</span><span className="text-muted-foreground">{path.prerequisites}</span></div>
            </CardContent>
          </Card>
          <Alert>
            <Database />
            <AlertTitle>Evidence boundary</AlertTitle>
            <AlertDescription>{path.limitation_notice}</AlertDescription>
          </Alert>
          {path.source_attribution.length > 0 && (
            <Card size="sm">
              <CardHeader>
                <div className="flex items-center gap-2"><Microscope aria-hidden="true"/><CardTitle>Assigned source material</CardTitle></div>
                <CardDescription>Attribution attached to the lessons released for this path.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 text-sm text-muted-foreground">{path.source_attribution.map((source) => <li key={source} className="border-l-2 border-border pl-3">{source}</li>)}</ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

export function StudentLearningPathPage() {
  const { pathId } = useParams();
  const paths = useQuery({ queryKey: queryKeys.studentLearningPaths, queryFn: api.studentLearningPaths });
  const path = paths.data?.find((item) => item.path_id === pathId);

  if (paths.isPending) return <div className="grid gap-4"><Skeleton className="h-9 w-40"/><Skeleton className="h-32"/><Skeleton className="h-72"/></div>;
  if (paths.error) return <Alert variant="destructive"><AlertTitle>Learning pathways could not load</AlertTitle><AlertDescription>{paths.error.message}</AlertDescription></Alert>;
  if (!path) return <Empty className="min-h-64 rounded-md border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><BookOpenCheck/></EmptyMedia><EmptyTitle>Pathway not found</EmptyTitle><EmptyDescription>Return to your Academy to choose one of the available evidence pathways.</EmptyDescription></EmptyHeader><Button render={<Link to="/academy"/>} nativeButton={false} variant="outline">Return to Academy</Button></Empty>;

  return <PathContent path={path} />;
}
