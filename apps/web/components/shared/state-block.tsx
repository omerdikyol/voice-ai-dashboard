import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingBlock({ height = 280 }: { height?: number }) {
  return (
    <Card className="rounded-[28px] border-border/70 glass-card">
      <CardContent className="space-y-4 p-5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="w-full rounded-3xl" style={{ height }} />
      </CardContent>
    </Card>
  );
}

export function EmptyBlock({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="rounded-[28px] border-dashed border-border/80 glass-card">
      <CardContent className="space-y-2 p-10 text-center">
        <h3 className="font-heading text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mx-auto max-w-xl text-sm leading-7 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <Card className="rounded-[28px] border-destructive/20 bg-destructive/5">
      <CardContent className="space-y-2 p-6">
        <h3 className="font-heading text-lg font-semibold text-destructive">Something broke</h3>
        <p className="text-sm leading-7 text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
