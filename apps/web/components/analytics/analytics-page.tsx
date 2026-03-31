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
