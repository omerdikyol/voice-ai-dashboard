"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterBar, type DashboardFilters } from "@/components/shared/filter-bar";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/shared/state-block";
import { PageHeader } from "@/components/shared/page-header";
import { getDashboardSummary, getDashboardTimeseries } from "@/lib/api";

const initialFilters: DashboardFilters = {
  days: 90,
  status: "all",
  voice: "all",
  direction: "all",
  sentiment: "all",
  topic: "all",
  tag: "all",
};

export function AnalyticsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [refreshTick, setRefreshTick] = useState(0);

  const summaryQuery = useQuery({
    queryKey: ["analytics-summary", filters, refreshTick],
    queryFn: () => getDashboardSummary(filters, refreshTick > 0),
  });
  const timeseriesQuery = useQuery({
    queryKey: ["analytics-timeseries", filters, refreshTick],
    queryFn: () => getDashboardTimeseries(filters, refreshTick > 0),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Deep Dive"
        title="Breakdowns for coaching, QA, and routing"
        description="Use the broader analytics view to isolate patterns by outcome, topic, tag, and sentiment so the team can make decisions about scripts, staffing, and escalation paths."
      />

      <FilterBar
        filters={filters}
        options={summaryQuery.data?.filters}
        onChange={setFilters}
        onRefresh={() => setRefreshTick((value) => value + 1)}
        refreshing={summaryQuery.isFetching || timeseriesQuery.isFetching}
      />

      {summaryQuery.isLoading || timeseriesQuery.isLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <LoadingBlock />
          <LoadingBlock />
        </div>
      ) : null}

      {summaryQuery.error ? <ErrorBlock message={(summaryQuery.error as Error).message} /> : null}
      {timeseriesQuery.error ? <ErrorBlock message={(timeseriesQuery.error as Error).message} /> : null}

      {timeseriesQuery.data ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <AnalyticsCard
            title="7x24 activity heatmap"
            description="A weekly view of call volume by weekday and hour so staffing pressure is visible at a glance."
          >
            {timeseriesQuery.data.activity_heatmap.some((cell) => cell.count > 0) ? (
              <ActivityHeatmap data={timeseriesQuery.data.activity_heatmap} />
            ) : (
              <EmptyBlock title="No activity signal yet" description="The filtered rows do not contain enough timestamps to populate the weekly heatmap." />
            )}
          </AnalyticsCard>
          <AnalyticsCard title="Tag frequency" description="Common operational tags, including VIP and urgent clusters.">
            {timeseriesQuery.data.tag_breakdown.length ? (
              <VerticalBarChart data={timeseriesQuery.data.tag_breakdown} dataKey="count" yAxisKey="key" fill="var(--color-chart-3)" />
            ) : (
              <EmptyBlock title="No tags matched" description="Adjust filters to inspect how tags cluster across the call set." />
            )}
          </AnalyticsCard>
          <AnalyticsCard title="Outcome leaderboard" description="What happened after the call, grouped by the provider output.">
            {timeseriesQuery.data.outcome_breakdown.length ? (
              <VerticalBarChart data={timeseriesQuery.data.outcome_breakdown} dataKey="count" yAxisKey="key" fill="var(--color-chart-1)" />
            ) : (
              <EmptyBlock title="No outcomes available" description="The filtered rows do not have outcome metadata yet." />
            )}
          </AnalyticsCard>
          <AnalyticsCard
            title="Sentiment by topic"
            description="Average sentiment score by topic so coaching conversations surface faster."
          >
            {timeseriesQuery.data.sentiment_by_topic.length ? (
              <VerticalBarChart
                data={timeseriesQuery.data.sentiment_by_topic}
                dataKey="average_score"
                yAxisKey="topic"
                fill="var(--color-chart-4)"
              />
            ) : (
              <EmptyBlock
                title="No sentiment-by-topic signal"
                description="The current filter set does not contain scored calls with topics."
              />
            )}
          </AnalyticsCard>
        </div>
      ) : null}
    </div>
  );
}

function AnalyticsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-[28px] border-border/70 glass-card">
      <CardHeader className="space-y-2 pb-1">
        <CardTitle className="font-heading text-xl tracking-tight">{title}</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function VerticalBarChart({
  data,
  dataKey,
  yAxisKey,
  fill,
}: {
  data: Record<string, number | string>[];
  dataKey: string;
  yAxisKey: string;
  fill: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ left: 18 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} />
        <YAxis dataKey={yAxisKey} type="category" tickLine={false} axisLine={false} width={150} />
        <Tooltip />
        <Bar dataKey={dataKey} fill={fill} radius={[0, 12, 12, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ActivityHeatmap({
  data,
}: {
  data: { weekday: number; weekday_label: string; hour: number; count: number }[];
}) {
  const maxCount = Math.max(...data.map((cell) => cell.count), 0);
  const byWeekday = new Map<number, { weekday_label: string; cells: typeof data }>();

  data.forEach((cell) => {
    const existing = byWeekday.get(cell.weekday);
    if (existing) {
      existing.cells.push(cell);
      return;
    }
    byWeekday.set(cell.weekday, { weekday_label: cell.weekday_label, cells: [cell] });
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <span />
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour} className="text-center">
              {hour}
            </span>
          ))}
        </div>
      </div>
      {Array.from(byWeekday.entries())
        .sort(([left], [right]) => left - right)
        .map(([weekday, row]) => (
          <div key={weekday} className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
            <span className="text-sm font-medium text-foreground">{row.weekday_label}</span>
            <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
              {row.cells
                .sort((left, right) => left.hour - right.hour)
                .map((cell) => {
                  const opacity = cell.count === 0 || maxCount === 0 ? 0.08 : 0.18 + (cell.count / maxCount) * 0.82;
                  return (
                    <div
                      key={`${cell.weekday}-${cell.hour}`}
                      className="h-6 rounded-md bg-primary transition-opacity"
                      style={{ opacity }}
                      title={`${row.weekday_label} ${String(cell.hour).padStart(2, "0")}:00 · ${cell.count} call${cell.count === 1 ? "" : "s"}`}
                    />
                  );
                })}
            </div>
          </div>
        ))}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Lighter cells indicate low activity.</span>
        <span>Darker cells indicate the busiest periods in the filtered set.</span>
      </div>
    </div>
  );
}
