import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <Card className="glass-card rounded-[28px] border-border/70 shadow-lg shadow-slate-200/60">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div
            className={cn(
              "rounded-full p-2",
              tone === "success" ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary",
            )}
          >
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
        <div className="font-heading text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
