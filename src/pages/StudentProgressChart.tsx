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
                <ChartContainer config={chartConfig} className="h-[220px] min-w-0 w-full">
                  <LineChart
                    accessibilityLayer
                    title={`Educator-reviewed rubric history for ${activeDimension.label}`}
                    desc="Each point is the latest educator review of one submitted attempt. The score describes authored coursework and is not clinical mastery. Use the arrow keys to inspect reviewed results."
                    data={points}
                    margin={{ top: 8, right: 12, bottom: 4, left: -16 }}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
                    <XAxis
                      dataKey="reviewed_at"
                      tickFormatter={(value) => formatReviewDate(String(value)).replace(/, \d{4}$/, "")}
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
                          labelFormatter={(value) => formatReviewDate(String(value))}
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
                        {points.map((point) => (
                          <TableRow key={point.id}>
                            <TableCell>{formatReviewDate(point.reviewed_at)}</TableCell>
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
