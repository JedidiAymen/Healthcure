import { useEffect, useState } from "react";
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
import { isAssignmentStartClosed } from "@/lib/academy-assignment-state";
import { queryKeys } from "@/lib/query-client";
import "./academy.css";

const discipline = {
  surgivision: { name: "Surgical teams", source: "Endoscapes", Icon: Stethoscope, tone: "border-l-sky-700" },
  dosetwin: { name: "Radiation oncology", source: "OpenKBP", Icon: Activity, tone: "border-l-indigo-700" },
  fistulaguard: { name: "Nephrology and access care", source: "FiSaV", Icon: Radio, tone: "border-l-teal-700" },
} as const;

const statePresentation = {
  not_started: { label: "Available", variant: "outline" as const, Icon: CircleDot },
  in_progress: { label: "In progress", variant: "secondary" as const, Icon: Clock3 },
  submitted: { label: "Submitted", variant: "secondary" as const, Icon: CalendarClock },
  reviewed: { label: "Reviewed", variant: "outline" as const, Icon: Check },
};

function LessonRow({ lesson, index, hasNext }: { lesson: StudentLearningPathLesson; index: number; hasNext: boolean }) {
  const initiallyClosed = isAssignmentStartClosed(lesson.state, lesson.due_at);
  const [deadlinePassed, setDeadlinePassed] = useState<string | null>(() => initiallyClosed ? lesson.due_at : null);
  useEffect(() => {
    if (lesson.state !== "not_started" || !lesson.due_at || isAssignmentStartClosed(lesson.state, lesson.due_at)) return;
    const deadline = Date.parse(lesson.due_at);
    if (!Number.isFinite(deadline)) return;
    const timer = window.setTimeout(() => setDeadlinePassed(lesson.due_at), Math.max(0, deadline - Date.now() + 1));
    return () => window.clearTimeout(timer);
  }, [lesson.due_at, lesson.state]);
  const isClosed = lesson.state === "not_started" && (initiallyClosed || deadlinePassed === lesson.due_at);
  const status = isClosed ? { label: "Closed", variant: "outline" as const, Icon: CalendarClock } : statePresentation[lesson.state];
  const StatusIcon = status.Icon;
  return (
    <li className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 pb-4 last:pb-0 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-4">
      {hasNext && <span aria-hidden="true" className="absolute bottom-0 left-[1.1rem] top-10 w-px bg-border sm:left-[1.35rem]" />}
      <span className="relative z-10 grid size-9 place-items-center self-start rounded-full border border-border bg-sidebar text-sm font-semibold text-primary sm:size-11">{lesson.state === "reviewed" ? <StatusIcon aria-hidden="true" className="size-4 text-primary"/> : String(index + 1).padStart(2, "0")}</span>
      <Card className="min-w-0 rounded-md shadow-none">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Badge variant={lesson.state === "in_progress" ? "secondary" : "outline"}><StatusIcon data-icon="inline-start" aria-hidden="true"/>{status.label}</Badge>
              <span className="text-xs text-muted-foreground">Investigation {index + 1}</span>
            </div>
            <h3 className="m-0 break-words text-base font-semibold leading-snug">{lesson.title}</h3>
            <p className="mb-0 mt-1.5 break-words text-sm leading-5 text-muted-foreground">{lesson.case_label} <span aria-hidden="true">·</span> Lesson version {lesson.version}{lesson.due_at && <> <span aria-hidden="true">·</span> Due {new Date(lesson.due_at).toLocaleDateString()}</>}</p>
          </div>
          <div className="grid gap-1.5">
            {isClosed ? (
              <Button type="button" disabled variant="outline" className="min-h-11 w-full justify-between sm:w-auto">Assignment closed</Button>
            ) : (
              <Button render={<Link to={`/academy/missions/${encodeURIComponent(lesson.assignment_id)}`}/>} nativeButton={false} variant={lesson.state === "in_progress" ? "default" : "outline"} className="min-h-11 w-full justify-between sm:w-auto">{lesson.state === "in_progress" ? "Continue investigation" : lesson.state === "submitted" ? "Check submission status" : lesson.state === "reviewed" ? "View educator feedback" : "Start investigation"}<ArrowRight data-icon="inline-end"/></Button>
            )}
            {isClosed && <p className="m-0 text-xs leading-5 text-muted-foreground">The due date passed. Ask your educator if this lesson should be reopened.</p>}
          </div>
        </CardContent>
      </Card>
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
  return <ol className="grid list-none gap-0 p-0">{path.lessons.map((lesson, index) => <LessonRow key={lesson.assignment_id} lesson={lesson} index={index} hasNext={index < path.lessons.length - 1} />)}</ol>;
}

function PathContent({ path }: { path: LearningPath }) {
  const field = discipline[path.module];
  const FieldIcon = field.Icon;
  const notStarted = path.assigned_count - path.in_progress_count - path.submitted_count - path.reviewed_count;
  return (
    <main className="academy-path-page mx-auto grid w-full max-w-7xl gap-5 sm:gap-7">
      <div>
        <Button render={<Link to="/academy" />} nativeButton={false} variant="ghost" size="sm" className="-ml-3">
          <ArrowLeft data-icon="inline-start" />All pathways
        </Button>
      </div>
      <header className="grid overflow-hidden rounded-lg border bg-card md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex min-w-0 flex-col justify-center bg-sidebar p-5 sm:p-8 lg:p-10">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/25 bg-background"><FieldIcon data-icon="inline-start" />{field.name}</Badge>
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Database aria-hidden="true" className="size-4"/>Research source: {field.source}</span>
          </div>
          <h1 className="m-0 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{path.title}</h1>
          <p className="mb-0 mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{path.description}</p>
          <p className="mb-0 mt-5 flex items-start gap-2 border-l-2 border-primary/40 pl-3 text-sm leading-6 text-muted-foreground"><Microscope aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary"/>Investigations use the original research viewer and keep each source collection separate.</p>
        </div>
        <div className="grid content-center gap-4 bg-primary p-5 text-primary-foreground sm:p-6">
          <div className="border-b border-primary-foreground/20 pb-3">
            <p className="m-0 text-sm text-primary-foreground/75">Released to your cohort</p>
            <p className="mb-0 mt-1 text-4xl font-semibold tabular-nums">{path.assigned_count}<span className="ml-2 text-base font-normal text-primary-foreground/75">lessons</span></p>
          </div>
          <dl className="grid grid-cols-3 gap-2" aria-label="Assignment progress">
            <div><dt className="text-xs leading-4 text-primary-foreground/75">In progress</dt><dd className="m-0 mt-1 text-2xl font-semibold tabular-nums">{path.in_progress_count}</dd></div>
            <div><dt className="text-xs leading-4 text-primary-foreground/75">Submitted</dt><dd className="m-0 mt-1 text-2xl font-semibold tabular-nums">{path.submitted_count}</dd></div>
            <div><dt className="text-xs leading-4 text-primary-foreground/75">Reviewed</dt><dd className="m-0 mt-1 text-2xl font-semibold tabular-nums">{path.reviewed_count}</dd></div>
          </dl>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(17rem,0.8fr)]">
        <Card className="min-w-0 shadow-none">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-xl">Investigation route</CardTitle>
            <CardDescription>Only work released to your cohort is shown. Educator review records feedback, not mastery of a clinical skill.</CardDescription>
          </CardHeader>
          <CardContent>
            <AssignedLessons path={path} />
          </CardContent>
          {path.lessons.length > 0 && <CardFooter className="border-t text-sm text-muted-foreground">{notStarted} available to start <span aria-hidden="true">·</span> {path.reviewed_count} educator reviewed</CardFooter>}
        </Card>

        <div className="grid gap-4">
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Study objectives</CardTitle>
              <CardDescription>Practice reading evidence and describing its limits.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3">
                {path.objectives.map((objective) => <li key={objective} className="flex gap-3 text-sm leading-6"><span className="mt-2 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Check aria-hidden="true" className="size-3"/></span><span>{objective}</span></li>)}
              </ul>
              <Separator className="my-4" />
              <div className="grid gap-1 text-sm"><span className="font-medium">Before you begin</span><span className="text-muted-foreground">{path.prerequisites}</span></div>
            </CardContent>
          </Card>
          <Alert>
            <Database />
            <AlertTitle>Evidence boundary</AlertTitle>
            <AlertDescription>{path.limitation_notice}</AlertDescription>
          </Alert>
          {path.source_attribution.length > 0 && (
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2"><Microscope aria-hidden="true" className="size-4 text-primary"/><CardTitle className="text-base">Assigned source material</CardTitle></div>
                <CardDescription>Attribution attached to the lessons released for this path.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid list-none gap-2 p-0 text-sm leading-5 text-muted-foreground">{path.source_attribution.map((source) => <li key={source} className="border-l-2 border-primary/25 pl-3">{source}</li>)}</ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
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
