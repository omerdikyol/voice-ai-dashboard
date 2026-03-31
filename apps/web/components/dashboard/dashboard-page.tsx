"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterBar, type DashboardFilters } from "@/components/shared/filter-bar";
import { MetricCard } from "@/components/shared/metric-card";
import { CallsTable } from "@/components/shared/calls-table";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/shared/state-block";
import { PageHeader } from "@/components/shared/page-header";
import { getDashboardSummary, getDashboardTimeseries } from "@/lib/api";

const initialFilters: DashboardFilters = {
  days: 30,
  status: "all",
  voice: "all",
  direction: "all",
  sentiment: "all",
  topic: "all",
  tag: "all",
};

const pieColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)"];

export function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const [refreshTick, setRefreshTick] = useState(0);

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", filters, refreshTick],
    queryFn: () => getDashboardSummary(filters, refreshTick > 0),
  });

  const timeseriesQuery = useQuery({
    queryKey: ["dashboard-timeseries", filters, refreshTick],
    queryFn: () => getDashboardTimeseries(filters, refreshTick > 0),
  });

  const refreshing = summaryQuery.isFetching || timeseriesQuery.isFetching;
  const statusKeys = useMemo(
    () => summaryQuery.data?.by_status.map((item) => item.key) ?? [],
    [summaryQuery.data?.by_status],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations Command"
        title="Realtime voice operations pulse"
        description="Monitor the synced mock-call feed, understand resolution quality, and surface the topics, costs, and sentiment patterns an operations manager would care about at a glance."
        badge={summaryQuery.data?.synced_at ? `Synced ${new Date(summaryQuery.data.synced_at).toLocaleTimeString()}` : "Waiting for first sync"}
      />

      <FilterBar
        filters={filters}
        options={summaryQuery.data?.filters}
        onChange={setFilters}
        onRefresh={() => setRefreshTick((value) => value + 1)}
        refreshing={refreshing}
      />

      {summaryQuery.isLoading || timeseriesQuery.isLoading ? (
        <div className="section-grid md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <LoadingBlock key={index} height={140} />
          ))}
        </div>
      ) : null}

      {summaryQuery.error ? <ErrorBlock message={(summaryQuery.error as Error).message} /> : null}
      {timeseriesQuery.error ? <ErrorBlock message={(timeseriesQuery.error as Error).message} /> : null}

      {summaryQuery.data ? (
        <div className="section-grid md:grid-cols-2 xl:grid-cols-5">
          {summaryQuery.data.cards.map((card) => (
            <MetricCard key={card.label} label={card.label} value={card.value} tone={card.tone} />
          ))}
        </div>
      ) : null}

      {summaryQuery.data && timeseriesQuery.data ? (
        <>
          <div className="section-grid xl:grid-cols-[1.55fr_1fr]">
            <ChartCard title="Calls over time" description="Daily call volume for the active filter set.">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={timeseriesQuery.data.calls_over_time}>
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area
                    dataKey="count"
                    type="monotone"
                    stroke="var(--color-chart-1)"
                    fill="url(#volumeGradient)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Sentiment distribution" description="Completed conversations that produced sentiment labels.">
              {summaryQuery.data.by_sentiment.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={summaryQuery.data.by_sentiment}
                      dataKey="count"
                      nameKey="key"
                      innerRadius={72}
                      outerRadius={110}
                      paddingAngle={4}
                    >
                      {summaryQuery.data.by_sentiment.map((entry, index) => (
                        <Cell key={entry.key} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyBlock title="No sentiment labels" description="The current filter set has no classified sentiment data." />
              )}
            </ChartCard>
          </div>

          <div className="section-grid xl:grid-cols-[1.35fr_1fr]">
            <ChartCard title="Status by day" description="Stacked status counts for the selected time window.">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={timeseriesQuery.data.status_by_day}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  {statusKeys.map((key, index) => (
                    <Bar key={key} dataKey={key} stackId="status" fill={pieColors[index % pieColors.length]} radius={[8, 8, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Direction split" description="Inbound versus outbound mix.">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={summaryQuery.data.by_direction}
                    dataKey="count"
                    nameKey="key"
                    innerRadius={70}
                    outerRadius={110}
                  >
                    {summaryQuery.data.by_direction.map((entry, index) => (
                      <Cell key={entry.key} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="section-grid xl:grid-cols-[1fr_1fr]">
            <ChartCard title="Top topics" description="Highest-volume reasons for contact across the filtered dataset.">
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={timeseriesQuery.data.top_topics} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis dataKey="key" type="category" tickLine={false} axisLine={false} width={130} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--color-chart-2)" radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Sentiment vs duration" description="Spot risky long calls and unusual conversation scores.">
              <ResponsiveContainer width="100%" height={290}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sentiment_score" name="Sentiment" type="number" tickLine={false} axisLine={false} />
                  <YAxis dataKey="duration_seconds" name="Duration" tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={timeseriesQuery.data.scatter} fill="var(--color-chart-4)" />
                </ScatterChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Recent calls" description="Most recent records persisted in the local database.">
            {summaryQuery.data.recent_calls.length ? (
              <CallsTable calls={summaryQuery.data.recent_calls} />
            ) : (
              <EmptyBlock title="No call records yet" description="Sync the dataset or broaden the filters to populate the table." />
            )}
          </ChartCard>
        </>
      ) : null}
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-[28px] border-border/70 glass-card shadow-lg shadow-slate-200/60">
      <CardHeader className="space-y-2 pb-1">
        <CardTitle className="font-heading text-xl tracking-tight">{title}</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
