import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DashboardFilters = {
  days: number;
  status: string;
  voice: string;
  direction: string;
  sentiment: string;
  topic: string;
  tag: string;
};

type FilterOptions = {
  statuses?: string[];
  voices?: string[];
  directions?: string[];
  sentiments?: string[];
  topics?: string[];
  tags?: string[];
};

const dayOptions = [7, 30, 90];

export function FilterBar({
  filters,
  options,
  onChange,
  onRefresh,
  refreshing,
}: {
  filters: DashboardFilters;
  options?: FilterOptions;
  onChange: (next: DashboardFilters) => void;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="glass-card rounded-[28px] border border-border/70 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {dayOptions.map((days) => (
            <Button
              key={days}
              variant={filters.days === days ? "default" : "outline"}
              className="rounded-full"
              onClick={() => onChange({ ...filters, days })}
            >
              Last {days} days
            </Button>
          ))}
        </div>
        <Button variant="outline" className="rounded-full" onClick={onRefresh} disabled={refreshing}>
          <RotateCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh dataset
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <FilterSelect
          label="Status"
          value={filters.status}
          values={options?.statuses ?? []}
          onValueChange={(value) => onChange({ ...filters, status: value })}
        />
        <FilterSelect
          label="Voice"
          value={filters.voice}
          values={options?.voices ?? []}
          onValueChange={(value) => onChange({ ...filters, voice: value })}
        />
        <FilterSelect
          label="Direction"
          value={filters.direction}
          values={options?.directions ?? []}
          onValueChange={(value) => onChange({ ...filters, direction: value })}
        />
        <FilterSelect
          label="Sentiment"
          value={filters.sentiment}
          values={options?.sentiments ?? []}
          onValueChange={(value) => onChange({ ...filters, sentiment: value })}
        />
        <FilterSelect
          label="Topic"
          value={filters.topic}
          values={options?.topics ?? []}
          onValueChange={(value) => onChange({ ...filters, topic: value })}
        />
        <FilterSelect
          label="Tag"
          value={filters.tag}
          values={options?.tags ?? []}
          onValueChange={(value) => onChange({ ...filters, tag: value })}
        />
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  values,
  onValueChange,
}: {
  label: string;
  value: string;
  values: string[];
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <Select value={value} onValueChange={(next) => onValueChange(next ?? "all")}>
        <SelectTrigger className="rounded-2xl bg-background/80">
          <SelectValue placeholder={`All ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {values.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
