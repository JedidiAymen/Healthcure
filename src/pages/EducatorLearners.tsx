import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleAlert, Search, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export function EducatorLearnersPage() {
  const cohorts = useQuery({ queryKey: queryKeys.educatorCohorts, queryFn: api.educatorCohorts });
  const [cohortId, setCohortId] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const items = cohorts.data ?? [];
    if (!items.some((cohort) => cohort.id === cohortId)) setCohortId(items[0]?.id ?? "");
  }, [cohorts.data, cohortId]);
  const roster = useQuery({
    queryKey: queryKeys.educatorCohortRoster(cohortId),
    queryFn: () => api.educatorCohortRoster(cohortId),
    enabled: Boolean(cohortId),
  });
  const visibleLearners = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (roster.data?.learners ?? []).filter((learner) => !query || learner.display_name.toLocaleLowerCase().includes(query));
  }, [roster.data?.learners, search]);

  return (
    <main className="grid min-w-0 gap-5">
      <header className="grid gap-3 border-b border-border/70 pb-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="mb-1 text-xs font-medium text-primary">Educator Studio / People</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Learners</h1>
          <p className="mb-0 mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">View learners enrolled in your cohorts. Review decisions and scores stay in Submissions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link to="/educator/assignments" />} nativeButton={false} variant="outline">Assignments<ArrowRight data-icon="inline-end"/></Button>
          <Button render={<Link to="/educator/submissions" />} nativeButton={false}>Submissions<ArrowRight data-icon="inline-end"/></Button>
        </div>
      </header>

      {cohorts.isError ? <Alert variant="destructive"><CircleAlert/><AlertTitle>Learner groups could not load</AlertTitle><AlertDescription>{cohorts.error instanceof Error ? cohorts.error.message : "Try again in a moment."}</AlertDescription></Alert> : null}

      {cohorts.isLoading ? <Skeleton className="h-64"/> : cohorts.data?.length ? <Card className="min-w-0 shadow-none">
        <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-1"><CardTitle>Cohort roster</CardTitle><CardDescription>Only members of a cohort you own are included.</CardDescription></div>
          <div className="grid gap-2 sm:w-[22rem] sm:grid-cols-[minmax(0,1fr)_minmax(10rem,.9fr)]">
            <label className="sr-only" htmlFor="learner-search">Search learners</label>
            <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><Input id="learner-search" className="pl-9" placeholder="Search learner names" value={search} onChange={(event) => setSearch(event.target.value)}/></div>
            <Select items={cohorts.data.map((cohort) => ({ label: `${cohort.name} · ${cohort.student_count}`, value: cohort.id }))} value={cohortId || null} onValueChange={(value) => setCohortId(value ?? "")}>
              <SelectTrigger aria-label="Choose cohort" className="w-full"><SelectValue placeholder="Choose cohort"/></SelectTrigger>
              <SelectContent><SelectGroup>{cohorts.data.map((cohort) => <SelectItem key={cohort.id} value={cohort.id}>{cohort.name} · {cohort.student_count}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {roster.isError ? <Alert variant="destructive"><CircleAlert/><AlertTitle>This cohort roster could not load</AlertTitle><AlertDescription>{roster.error instanceof Error ? roster.error.message : "Try again in a moment."}</AlertDescription></Alert>
            : roster.isLoading ? <div className="grid gap-2"><Skeleton className="h-12"/><Skeleton className="h-12"/><Skeleton className="h-12"/></div>
              : roster.data?.learners.length ? <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3 text-sm"><span className="font-medium">{roster.data.cohort_name}</span><Badge variant="secondary">{roster.data.student_count} {roster.data.student_count === 1 ? "learner" : "learners"}</Badge></div>
                {visibleLearners.length ? <ul className="m-0 grid list-none divide-y p-0" aria-label={`Learners in ${roster.data.cohort_name}`}>
                  {visibleLearners.map((learner, index) => <li key={`${learner.display_name}-${index}`} className="flex min-h-14 min-w-0 items-center gap-3 py-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Users aria-hidden="true" className="size-4"/></span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{learner.display_name}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">Cohort member</span>
                  </li>)}
                </ul> : <Empty className="min-h-36"><EmptyHeader><EmptyMedia variant="icon"><Search/></EmptyMedia><EmptyTitle>No learners match</EmptyTitle><EmptyDescription>Try a different name.</EmptyDescription></EmptyHeader></Empty>}
              </> : <Empty className="min-h-48 rounded-lg border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><Users/></EmptyMedia><EmptyTitle>No learners in this cohort yet</EmptyTitle><EmptyDescription>Add provisioned learners from Assignments to build the roster.</EmptyDescription></EmptyHeader><Button render={<Link to="/educator/assignments"/>} nativeButton={false} variant="outline">Manage cohorts<ArrowRight data-icon="inline-end"/></Button></Empty>}
        </CardContent>
      </Card> : <Card className="shadow-none"><CardContent className="pt-6"><Empty className="min-h-56 rounded-lg border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><Users/></EmptyMedia><EmptyTitle>No cohorts yet</EmptyTitle><EmptyDescription>Create a learning group and add provisioned learners before viewing its roster.</EmptyDescription></EmptyHeader><Button render={<Link to="/educator/assignments"/>} nativeButton={false}>Set up a cohort<ArrowRight data-icon="inline-end"/></Button></Empty></CardContent></Card>}
    </main>
  );
}
