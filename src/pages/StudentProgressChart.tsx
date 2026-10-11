import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StudentProgress } from "@/lib/api";

type RubricHistoryPoint = StudentProgress["rubric_history"][number];
type ChartHistoryPoint = Omit<RubricHistoryPoint, "percent"> & {
  percent: number;
  chartKey: string;
  reviewNumber: number;
};

const chartConfig = {
  percent: { label: "Rubric score", color: "var(--chart-1)" },
} satisfies ChartConfig;

function parseReviewDate(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Date(normalized);
}

function formatReviewDate(value: string) {
  const date = parseReviewDate(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatReviewTime(value: string) {
  const date = parseReviewDate(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatAxisTime(value: string) {
  const date = parseReviewDate(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

function hasRepeatedReviewDay(value: string, repeatedReviewDays: Set<string>) {
  return repeatedReviewDays.has(formatReviewDate(value));
}

function formatAxisReview(value: string, repeatedReviewDays: Set<string>) {
  if (hasRepeatedReviewDay(value, repeatedReviewDays)) return formatAxisTime(value);
  return formatReviewDate(value).replace(/, \d{4}$/, "");
}

function formatTableReview(value: string, repeatedReviewDays: Set<string>) {
  return hasRepeatedReviewDay(value, repeatedReviewDays)
    ? `${formatReviewDate(value)} · ${formatReviewTime(value)}`
    : formatReviewDate(value);
}

export function StudentProgressChart({ history }: { history: RubricHistoryPoint[] }) {
  const [selectedDimensionId, setSelectedDimensionId] = useState("");
  const dimensions = useMemo(() => {
    const unique = new Map<string, { id: string; label: string }>();
    for (const point of history) {
      unique.set(point.dimension_id, {
        id: point.dimension_id,
        label: `${point.lesson_title} · ${point.dimension_title}`,
      });
    }
    return [...unique.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [history]);
  const activeDimensionId = dimensions.some((dimension) => dimension.id === selectedDimensionId)
    ? selectedDimensionId
    : dimensions[0]?.id ?? "";
  const activeDimension = dimensions.find((dimension) => dimension.id === activeDimensionId);
  const points = useMemo(
    () => history
      .filter((point) => point.dimension_id === activeDimensionId && point.percent !== null)
      .map((point) => ({ ...point, percent: point.percent as number }))
      .sort((left, right) => parseReviewDate(left.reviewed_at).getTime() - parseReviewDate(right.reviewed_at).getTime()),
    [activeDimensionId, history],
  );
  const latestPoint = points[points.length - 1];
  const previousPoint = points.length > 1 ? points[points.length - 2] : undefined;
  const scoreChange = latestPoint && previousPoint ? latestPoint.percent - previousPoint.percent : null;
  const chartPoints = useMemo<ChartHistoryPoint[]>(
    () => points.map((point, index) => ({ ...point, chartKey: point.id, reviewNumber: index + 1 })),
    [points],
  );
  const chartPointByKey = useMemo(
    () => new Map(chartPoints.map((point) => [point.chartKey, point])),
    [chartPoints],
  );
  const repeatedReviewDays = useMemo(() => {
    const counts = new Map<string, number>();
    for (const point of points) {
      const day = formatReviewDate(point.reviewed_at);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return new Set([...counts].filter(([, count]) => count > 1).map(([day]) => day));
  }, [points]);
  const axisLabelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const point of chartPoints) {
      const label = formatAxisReview(point.reviewed_at, repeatedReviewDays);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return counts;
  }, [chartPoints, repeatedReviewDays]);
  const tableLabelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const point of chartPoints) {
      const label = formatTableReview(point.reviewed_at, repeatedReviewDays);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return counts;
  }, [chartPoints, repeatedReviewDays]);
  const formatAxisPoint = (value: string) => {
    const point = chartPointByKey.get(value);
    if (!point) return value;
    const label = formatAxisReview(point.reviewed_at, repeatedReviewDays);
    return (axisLabelCounts.get(label) ?? 0) > 1 ? `${label} #${point.reviewNumber}` : label;
  };
  const formatTooltipPoint = (value: string) => {
    const point = chartPointByKey.get(value);
    if (!point) return value;
    const date = formatReviewDate(point.reviewed_at);
    const time = hasRepeatedReviewDay(point.reviewed_at, repeatedReviewDays) ? ` · ${formatReviewTime(point.reviewed_at)}` : "";
    return `${date}${time} · review ${point.reviewNumber}`;
  };
  const formatTablePoint = (point: ChartHistoryPoint) => {
    const label = formatTableReview(point.reviewed_at, repeatedReviewDays);
    return (tableLabelCounts.get(label) ?? 0) > 1 ? `${label} · review ${point.reviewNumber}` : label;
  };
  const selectItems = dimensions.map((dimension) => ({ label: dimension.label, value: dimension.id }));

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Rubric history</CardTitle>
        <CardDescription>Latest educator review for each attempt, shown over time. These results describe coursework, not clinical competence.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!history.length ? (
          <Empty className="min-h-32 rounded-lg border border-dashed">
            <EmptyHeader>
              <EmptyTitle>No review history yet</EmptyTitle>
              <EmptyDescription>After an educator reviews submitted work, rubric results will appear here over time.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <Field className="max-w-xl">
              <FieldLabel htmlFor="rubric-history-dimension">Coursework criterion</FieldLabel>
              <Select
                items={selectItems}
                value={activeDimensionId || null}
                onValueChange={(value) => setSelectedDimensionId(value ?? "")}
              >
                <SelectTrigger id="rubric-history-dimension" className="w-full">
                  <SelectValue placeholder="Choose a reviewed criterion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {dimensions.map((dimension) => (
                      <SelectItem key={dimension.id} value={dimension.id}>{dimension.label}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {activeDimension && points.length ? (
              <>
                <p className="text-sm text-muted-foreground">{activeDimension.label} · {points.length} reviewed {points.length === 1 ? "attempt" : "attempts"}</p>
                {latestPoint ? (
                  <section aria-label="Latest reviewed rubric result" className="grid gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Latest educator review</p>
                      <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-foreground">{latestPoint.percent.toFixed(1)}<span className="text-lg text-muted-foreground">%</span></p>
                      <p className="mt-1 text-sm text-muted-foreground">{latestPoint.earned_points}/{latestPoint.available_points} points · {formatReviewDate(latestPoint.reviewed_at)}</p>
                    </div>
                    {scoreChange !== null ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm lg:justify-end">
                        <span className="rounded-full border border-border bg-background px-3 py-1.5 font-medium tabular-nums text-foreground">
                          {scoreChange > 0 ? "+" : ""}{scoreChange.toFixed(1)} percentage points
                        </span>
                        <span className="text-muted-foreground">since previous review</span>
                      </div>
                    ) : null}
                  </section>
                ) : null}
                <ChartContainer config={chartConfig} className="h-[220px] min-w-0 w-full">
                  <LineChart
                    accessibilityLayer
                    title={`Educator-reviewed rubric history for ${activeDimension.label}`}
                    desc="Each point is the latest educator review of one submitted attempt. The score describes authored coursework and is not clinical mastery. Use the arrow keys to inspect reviewed results."
                    data={chartPoints}
                    margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
                    <XAxis
                      dataKey="chartKey"
                      tickFormatter={(value) => formatAxisPoint(String(value))}
                      interval={points.length <= 2 ? 0 : "preserveStartEnd"}
                      padding={{ left: 8, right: 24 }}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={20}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tickFormatter={(value) => `${value}%`}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={42}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          indicator="line"
                          labelFormatter={(value) => {
                            return formatTooltipPoint(String(value));
                          }}
                          formatter={(value) => <span className="font-mono tabular-nums">{Number(value).toFixed(1)}%</span>}
                        />
                      }
                    />
                    <Line
                      type="linear"
                      dataKey="percent"
                      name="Rubric score"
                      stroke="var(--color-percent)"
                      strokeWidth={2}
                      dot={{ fill: "var(--color-percent)", r: 3 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ChartContainer>
                <details className="rounded-md border border-border/70 px-3">
                  <summary className="cursor-pointer py-2 text-sm text-muted-foreground">View reviewed values · {points.length}</summary>
                  <div className="max-h-64 overflow-auto border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reviewed</TableHead>
                          <TableHead>Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chartPoints.map((point) => (
                          <TableRow key={point.chartKey}>
                            <TableCell>{formatTablePoint(point)}</TableCell>
                            <TableCell className="font-mono tabular-nums">{point.earned_points}/{point.available_points} · {point.percent.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </details>
              </>
            ) : (
              <Empty className="min-h-28 rounded-lg border border-dashed">
                <EmptyHeader>
                  <EmptyTitle>No numeric rubric history for this criterion</EmptyTitle>
                  <EmptyDescription>Only educator-scored criteria with defined point totals can be plotted.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
