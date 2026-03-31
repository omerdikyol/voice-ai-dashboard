import { format } from "date-fns";

export function formatCompactDateTime(value: string | null | undefined) {
  if (!value) return "N/A";
  return format(new Date(value), "MMM d, HH:mm");
}

export function formatLongDateTime(value: string | null | undefined) {
  if (!value) return "Unavailable";
  return format(new Date(value), "MMM d, yyyy HH:mm");
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
