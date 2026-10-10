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

function LessonRow({ lesson, index }: { lesson: StudentLearningPathLesson; index: number }) {
  const status = statePresentation[lesson.state];
  const StatusIcon = status.Icon;
  return (
    <li className="academy-lesson-stop">
      <span className="academy-lesson-marker" aria-hidden="true">{lesson.state === "reviewed" ? <StatusIcon/> : index + 1}</span>
      <div className="academy-lesson-detail">
        <div className="academy-lesson-copy"><span className="academy-lesson-state"><StatusIcon aria-hidden="true"/>{status.label}</span><h3>{lesson.title}</h3><p>{lesson.case_label} <span aria-hidden="true">·</span> Lesson version {lesson.version}{lesson.due_at && <> <span aria-hidden="true">·</span> Due {new Date(lesson.due_at).toLocaleDateString()}</>}</p></div>
        <Button render={<Link to={`/academy/missions/${encodeURIComponent(lesson.assignment_id)}`}/>} nativeButton={false} variant={lesson.state === "in_progress" ? "default" : "outline"} className="academy-lesson-action">{lesson.state === "in_progress" ? "Continue investigation" : lesson.state === "submitted" || lesson.state === "reviewed" ? "View feedback" : "Start investigation"}<ArrowRight data-icon="inline-end"/></Button>
      </div>
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
  return <ol className="academy-lesson-route">{path.lessons.map((lesson, index) => <LessonRow key={lesson.assignment_id} lesson={lesson} index={index} />)}</ol>;
}

function PathContent({ path }: { path: LearningPath }) {
  const field = discipline[path.module];
  const FieldIcon = field.Icon;
  const notStarted = path.assigned_count - path.in_progress_count - path.submitted_count - path.reviewed_count;
  return (
    <main className="academy-path-page">
      <div className="mb-5">
        <Button render={<Link to="/academy" />} nativeButton={false} variant="ghost" size="sm" className="-ml-3">
          <ArrowLeft data-icon="inline-start" />All pathways
        </Button>
      </div>
      <header className="academy-path-hero">
        <div className="max-w-3xl">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline"><FieldIcon data-icon="inline-start" />{field.name}</Badge>
            <span className="text-sm text-muted-foreground">Source: {field.source}</span>
          </div>
          <h1>{path.title}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{path.description}</p>
        </div>
        <dl className="academy-path-counts" aria-label="Assignment progress">
          <dt>Assigned lessons</dt><dd>{path.assigned_count}</dd>
          <dt>In progress</dt><dd>{path.in_progress_count}</dd>
          <dt>Submitted</dt><dd>{path.submitted_count}</dd>
          <dt>Reviewed</dt><dd>{path.reviewed_count}</dd>
        </dl>
      </header>

      <div className="academy-path-layout">
        <Card className="academy-path-lessons">
          <CardHeader>
            <CardTitle>Assigned lessons</CardTitle>
            <CardDescription>Only work released to your cohort is shown. A review marks educator feedback on an assignment, not mastery of a clinical skill.</CardDescription>
          </CardHeader>
          <CardContent>
            <AssignedLessons path={path} />
          </CardContent>
          {path.lessons.length > 0 && <CardFooter className="text-sm text-muted-foreground">{notStarted} not started / {path.reviewed_count} reviewed</CardFooter>}
        </Card>

        <div className="academy-path-notes">
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
