import { Badge } from "@/components/ui/badge";

export function PageHeader({
  eyebrow,
  title,
  description,
  badge,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      </div>
      {badge ? (
        <Badge className="rounded-full bg-primary/12 px-4 py-1.5 text-primary hover:bg-primary/12">
          {badge}
        </Badge>
      ) : null}
    </div>
  );
}
